import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
} from "lucide-react";
import { BY_EXTENSION, BY_NAME } from "./fileIconMap";

/**
 * The icon for a payload, chosen from its name using Lucide React icons.
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

export function FileIcon({
  name = "",
  folder = false,
  open = false,
  size = 16,
  className,
}: FileIconProps) {
  if (folder) {
    return open ? (
      <FolderOpen size={size} className={className} strokeWidth={1.75} aria-hidden="true" />
    ) : (
      <Folder size={size} className={className} strokeWidth={1.75} aria-hidden="true" />
    );
  }

  const type = resolve(name);

  if (["image", "photo"].includes(type)) {
    return <FileImage size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (["video", "movie"].includes(type)) {
    return <FileVideo size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (["audio", "music", "sound"].includes(type)) {
    return <FileAudio size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (["zip", "archive", "tar"].includes(type)) {
    return <FileArchive size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (
    [
      "python",
      "javascript",
      "typescript",
      "go",
      "code",
      "html",
      "css",
      "json",
      "markdown",
      "git",
      "docker",
      "makefile",
      "nodejs",
      "react",
    ].includes(type)
  ) {
    return <FileCode size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (["table", "spreadsheet", "excel"].includes(type)) {
    return <FileSpreadsheet size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
  if (["pdf", "document", "text"].includes(type)) {
    return <FileText size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
  }

  return <File size={size} className={className} strokeWidth={1.75} aria-hidden="true" />;
}

/** Exposed for tests: which icon a name resolves to. */
export const iconNameFor = resolve;
