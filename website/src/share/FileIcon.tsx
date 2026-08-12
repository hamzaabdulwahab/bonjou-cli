import { BY_EXTENSION, BY_NAME, ICONS } from "./fileIconMap";

/**
 * The icon for a payload, chosen from its name.
 *
 * Resolution follows the Material Icon Theme's own order, which is what
 * makes a filename here look the way it looks in an editor: an exact
 * filename beats an extension, so `package.json` is a Node icon rather
 * than a JSON one, and the longest suffix wins, so `archive.tar.gz` reads
 * as an archive rather than as a `.gz`.
 */
function resolve(fileName: string): string {
  const lower = fileName.toLowerCase().replace(/\/+$/, "");
  const base = lower.slice(lower.lastIndexOf("/") + 1);

  const exact = BY_NAME[base];
  if (exact) return exact;

  const parts = base.split(".");
  for (let i = 1; i < parts.length; i += 1) {
    const suffix = parts.slice(i).join(".");
    const hit = BY_EXTENSION[suffix];
    if (hit) return hit;
  }

  return "file";
}

interface FileIconProps {
  /** The payload's name. Ignored when `folder` is set. */
  name?: string;
  /** Render a folder rather than a file. */
  folder?: boolean;
  /** Folders open while their transfer is actually moving. */
  open?: boolean;
  size?: number;
  className?: string;
}

/**
 * Polychrome on purpose.
 *
 * A transfer list is a column of filenames, and colour is the fastest way
 * to find the one you want while scrolling past it. The markup is the
 * theme's own SVG, injected rather than rebuilt as JSX: these are 68
 * build-time constants from a package, never anything a peer sent, and
 * hand-porting them would mean maintaining a fork of an icon set.
 */
export function FileIcon({
  name = "",
  folder = false,
  open = false,
  size = 16,
  className,
}: FileIconProps) {
  const icon = folder ? (open ? "folder-open" : "folder") : resolve(name);
  const svg = ICONS[icon] ?? ICONS.file;

  return (
    <span
      className={className ? `file-icon ${className}` : "file-icon"}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Exposed for tests: which icon a name resolves to. */
export const iconNameFor = resolve;
