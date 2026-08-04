/**
 * A streaming, store-only ZIP writer.
 *
 * Sending a folder used to raise one approval per file. Approving forty
 * times is not consent, it is attrition. It also could not preserve the
 * folder anyway: a browser strips path separators out of a download
 * filename, so every file landed flat regardless.
 *
 * One archive solves both. Store-only because payloads are usually
 * already compressed, and because deflate would make the final size
 * unknowable in advance, which the data plane needs up front to set
 * Content-Length.
 *
 * Streaming means CRCs cannot be known when a local header is written, so
 * entries use data descriptors (general purpose bit 3) and carry their
 * CRC after the data. ZIP64 kicks in past the 4 GiB and 65535 entry
 * limits, since the page claims any file size and should mean it.
 */

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const DESCRIPTOR_SIG = 0x08074b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;

const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;

/** Flag bit 3: sizes and CRC follow the data. Bit 11: the name is UTF-8. */
const FLAG_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;

export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  name: string;
  size: number;
  lastModified: number;
  /** Anything sliceable; a File satisfies this. */
  data: Blob;
}

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/** Running CRC32. Feed the previous result back in as `seed`. */
export function crc32(bytes: Uint8Array, seed = 0): number {
  let c = (~seed) >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (~c) >>> 0;
}

/**
 * `force` exists so the ZIP64 path is testable. Triggering it honestly
 * needs 4 GiB of input, so without a seam it would ship unexercised,
 * which is how a rarely-taken branch stays broken for years.
 */
function needsZip64(entries: ZipEntry[], payloadTotal: number, force = false): boolean {
  return (
    force ||
    entries.length >= U16_MAX ||
    payloadTotal >= U32_MAX ||
    entries.some((entry) => entry.size >= U32_MAX)
  );
}

/**
 * Exact byte length of the archive `zipStream` will produce. The data
 * plane fixes Content-Length before the first byte moves, so this has to
 * be right rather than approximate.
 */
export function zipSize(entries: ZipEntry[], forceZip64 = false): number {
  let payload = 0;
  for (const entry of entries) payload += entry.size;
  const zip64 = needsZip64(entries, payload, forceZip64);

  let total = 0;
  for (const entry of entries) {
    const nameLen = encoder.encode(entry.name).length;
    total += 30 + nameLen + (zip64 ? 20 : 0); // local header + zip64 extra
    total += entry.size;
    total += zip64 ? 24 : 16; // data descriptor
    total += 46 + nameLen + (zip64 ? 28 : 0); // central directory entry
  }
  total += 22; // end of central directory
  if (zip64) total += 56 + 20; // zip64 end record + locator
  return total;
}

/** DOS date and time, which ZIP still uses. */
function dosStamp(millis: number): { time: number; date: number } {
  const d = new Date(millis);
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

class Writer {
  private parts: Uint8Array[] = [];

  u16(value: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, value, true);
    this.parts.push(b);
  }

  u32(value: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value >>> 0, true);
    this.parts.push(b);
  }

  u64(value: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, BigInt(value), true);
    this.parts.push(b);
  }

  raw(bytes: Uint8Array) {
    this.parts.push(bytes);
  }

  done(): Uint8Array {
    let length = 0;
    for (const part of this.parts) length += part.length;
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    this.parts = [];
    return out;
  }
}

interface Placed {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

/**
 * Produces the archive as a stream. Nothing larger than one read chunk is
 * held at a time, so a folder of any size never materialises in memory.
 */
export function zipStream(
  entries: ZipEntry[],
  chunkSize = 1 << 20,
  forceZip64 = false,
): ReadableStream<Uint8Array> {
  let payload = 0;
  for (const entry of entries) payload += entry.size;
  const zip64 = needsZip64(entries, payload, forceZip64);
  const version = zip64 ? 45 : 20;

  const placed: Placed[] = [];
  let offset = 0;
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index < entries.length) {
        const entry = entries[index];
        const name = encoder.encode(entry.name);
        const { time, date } = dosStamp(entry.lastModified);
        const start = offset;

        const head = new Writer();
        head.u32(LOCAL_SIG);
        head.u16(version);
        head.u16(FLAG_DESCRIPTOR | FLAG_UTF8);
        head.u16(0); // stored
        head.u16(time);
        head.u16(date);
        head.u32(0); // crc, in the descriptor
        head.u32(0); // compressed size, in the descriptor
        head.u32(0); // uncompressed size, in the descriptor
        head.u16(name.length);
        head.u16(zip64 ? 20 : 0);
        head.raw(name);
        if (zip64) {
          head.u16(0x0001);
          head.u16(16);
          head.u64(0);
          head.u64(0);
        }
        const header = head.done();
        controller.enqueue(header);
        offset += header.length;

        let crc = 0;
        for (let at = 0; at < entry.size; at += chunkSize) {
          const slice = entry.data.slice(at, Math.min(at + chunkSize, entry.size));
          const bytes = new Uint8Array(await slice.arrayBuffer());
          crc = crc32(bytes, crc);
          controller.enqueue(bytes);
          offset += bytes.length;
        }

        const tail = new Writer();
        tail.u32(DESCRIPTOR_SIG);
        tail.u32(crc);
        if (zip64) {
          tail.u64(entry.size);
          tail.u64(entry.size);
        } else {
          tail.u32(entry.size);
          tail.u32(entry.size);
        }
        const descriptor = tail.done();
        controller.enqueue(descriptor);
        offset += descriptor.length;

        placed.push({ name, crc, size: entry.size, offset: start, time, date });
        index++;
        return;
      }

      // Central directory, then the end records.
      const dirStart = offset;
      const dir = new Writer();
      for (const entry of placed) {
        dir.u32(CENTRAL_SIG);
        dir.u16(version);
        dir.u16(version);
        dir.u16(FLAG_DESCRIPTOR | FLAG_UTF8);
        dir.u16(0);
        dir.u16(entry.time);
        dir.u16(entry.date);
        dir.u32(entry.crc);
        dir.u32(zip64 ? U32_MAX : entry.size);
        dir.u32(zip64 ? U32_MAX : entry.size);
        dir.u16(entry.name.length);
        dir.u16(zip64 ? 28 : 0);
        dir.u16(0); // comment
        dir.u16(0); // disk
        dir.u16(0); // internal attrs
        dir.u32(0); // external attrs
        dir.u32(zip64 ? U32_MAX : entry.offset);
        dir.raw(entry.name);
        if (zip64) {
          dir.u16(0x0001);
          dir.u16(24);
          dir.u64(entry.size);
          dir.u64(entry.size);
          dir.u64(entry.offset);
        }
      }

      const dirBytes = dir.done();
      const end = new Writer();
      end.raw(dirBytes);

      if (zip64) {
        end.u32(ZIP64_EOCD_SIG);
        end.u64(44); // size of this record, less its first 12 bytes
        end.u16(version);
        end.u16(version);
        end.u32(0);
        end.u32(0);
        end.u64(placed.length);
        end.u64(placed.length);
        end.u64(dirBytes.length);
        end.u64(dirStart);

        end.u32(ZIP64_LOCATOR_SIG);
        end.u32(0);
        end.u64(dirStart + dirBytes.length);
        end.u32(1);
      }

      end.u32(EOCD_SIG);
      end.u16(0);
      end.u16(0);
      end.u16(zip64 ? U16_MAX : placed.length);
      end.u16(zip64 ? U16_MAX : placed.length);
      end.u32(zip64 ? U32_MAX : dirBytes.length);
      end.u32(zip64 ? U32_MAX : dirStart);
      end.u16(0);

      controller.enqueue(end.done());
      controller.close();
    },
  });
}

/**
 * Derives the archive name from a folder pick. Browsers report every file
 * with a `webkitRelativePath` rooted at the chosen folder, so its first
 * segment is the folder's own name.
 */
export function folderNameFor(files: File[]): string {
  const first = files.find((file) => file.webkitRelativePath)?.webkitRelativePath;
  const root = first?.split("/")[0]?.trim();
  return root ? `${root}.zip` : "folder.zip";
}

export function entriesFor(files: File[]): ZipEntry[] {
  return files.map((file) => ({
    name: file.webkitRelativePath || file.name,
    size: file.size,
    lastModified: file.lastModified,
    data: file,
  }));
}
