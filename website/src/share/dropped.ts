/**
 * Turning a drop into something sendable.
 *
 * A file picker hands back `File` objects that already carry
 * `webkitRelativePath` when a folder was chosen. A drop does not: the
 * DataTransfer exposes a tree of entries instead, and the `File` objects
 * pulled out of it have no path at all. Without one, a dropped folder
 * would flatten and every file would land in the archive root.
 *
 * So the tree is walked, and each file is tagged with the path it was
 * found at. `webkitRelativePath` is read-only on the prototype, but an own
 * property shadows it, which is exactly what the zip writer reads. That
 * keeps `entriesFor` and `folderNameFor` working on dropped folders and
 * picked ones without either knowing the difference.
 */

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (file: File) => void, err: (error: unknown) => void) => void;
  createReader: () => {
    readEntries: (
      cb: (entries: FileSystemEntryLike[]) => void,
      err: (error: unknown) => void,
    ) => void;
  };
}

export interface DroppedPayload {
  files: File[];
  /** True when a directory was dropped, so it sends as one archive. */
  asFolder: boolean;
}

function withPath(file: File, path: string): File {
  if (!path || path === file.name) return file;
  try {
    Object.defineProperty(file, "webkitRelativePath", {
      value: path,
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Some engines seal File instances. The archive then loses the nesting
    // but still sends, which beats refusing the drop.
  }
  return file;
}

function readFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** readEntries returns at most 100 at a time and must be called until empty. */
function readBatch(
  reader: ReturnType<FileSystemEntryLike["createReader"]>,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walk(entry: FileSystemEntryLike, prefix: string): Promise<File[]> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;

  if (entry.isFile) {
    try {
      return [withPath(await readFile(entry), path)];
    } catch {
      // An unreadable file is skipped rather than failing the whole drop.
      return [];
    }
  }

  if (!entry.isDirectory) return [];

  const reader = entry.createReader();
  const out: File[] = [];
  for (;;) {
    let batch: FileSystemEntryLike[];
    try {
      batch = await readBatch(reader);
    } catch {
      break;
    }
    if (batch.length === 0) break;
    for (const child of batch) out.push(...(await walk(child, path)));
  }
  return out;
}

export async function fromDataTransfer(
  transfer: DataTransfer,
): Promise<DroppedPayload> {
  const items = [...transfer.items].filter((item) => item.kind === "file");

  // The entry list has to be captured synchronously: DataTransferItemList
  // is emptied as soon as the drop handler yields.
  const entries = items
    .map((item) =>
      "webkitGetAsEntry" in item
        ? (item.webkitGetAsEntry() as unknown as FileSystemEntryLike | null)
        : null,
    )
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (entries.length === 0) {
    return { files: [...transfer.files], asFolder: false };
  }

  const asFolder = entries.some((entry) => entry.isDirectory);
  const collected = await Promise.all(entries.map((entry) => walk(entry, "")));
  const files = collected.flat();

  // Several loose files dropped together are still several files. Only a
  // directory turns the send into a single archive.
  return { files, asFolder };
}
