import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, FolderClosed, Paperclip } from "lucide-react";

import { fromDataTransfer } from "./dropped";

interface ComposerProps {
  /** Who this will reach, already resolved from the active thread. */
  targets: string[];
  destination: string;
  onSendText: (targets: string[], text: string) => void;
  onSendFiles: (targets: string[], files: File[], asFolder?: boolean) => void;
}

/** Grows with the draft instead of scrolling inside two fixed rows. */
const MAX_ROWS_PX = 168;

export function Composer({
  targets,
  destination,
  onSendText,
  onSendFiles,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  // Drag events fire for every child element entered, so a plain
  // enter/leave pair flickers. Counting them is the standard fix.
  const depth = useRef(0);

  const canSend = targets.length > 0;

  const fit = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const wanted = Math.min(el.scrollHeight, MAX_ROWS_PX);
    // An element inside a display:none subtree measures zero, and the
    // narrow layout hides the stage while the rail is up. Writing that
    // zero back would pin the field shut at its padding until the first
    // keystroke, which is exactly what it used to do on a phone.
    if (wanted === 0) return;
    el.style.height = `${wanted}px`;
  }, []);

  useEffect(fit, [draft, fit]);

  // Re-measure the first time it actually has a box. Only the
  // hidden-to-visible edge triggers this, so the writes above cannot
  // feed back into the observer.
  useEffect(() => {
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let hadBox = el.offsetWidth > 0;
    const observer = new ResizeObserver(() => {
      const hasBox = el.offsetWidth > 0;
      if (hasBox && !hadBox) fit();
      hadBox = hasBox;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  const send = () => {
    if (!canSend || !draft.trim()) return;
    onSendText(targets, draft);
    setDraft("");
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (!canSend) return;
    const transfer = event.dataTransfer;
    void fromDataTransfer(transfer).then(({ files, asFolder }) => {
      if (files.length > 0) onSendFiles(targets, files, asFolder);
    });
  };

  return (
    <div className="composer">
      <div
        className={dragging ? "composer-box is-dragging" : "composer-box"}
        onDragEnter={(event) => {
          event.preventDefault();
          depth.current += 1;
          if (canSend) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <textarea
          ref={areaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            canSend
              ? `Message ${destination}, or drop a file in here`
              : "Nobody to send to yet"
          }
          aria-label={canSend ? `Message ${destination}` : "Message"}
          disabled={!canSend}
          rows={2}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. The convention in
            // every messaging app.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />

        <div className="composer-actions">
          <label className={canSend ? "attach" : "attach is-disabled"}>
            <Paperclip size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Files</span>
            <input
              type="file"
              multiple
              disabled={!canSend}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) onSendFiles(targets, files);
                event.target.value = "";
              }}
            />
          </label>

          <label className={canSend ? "attach" : "attach is-disabled"}>
            <FolderClosed size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>Folder</span>
            <input
              type="file"
              multiple
              disabled={!canSend}
              // Folder picking is vendor-prefixed with no standard
              // equivalent, so React needs it passed through.
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (files.length) onSendFiles(targets, files, true);
                event.target.value = "";
              }}
            />
          </label>

          <span className="spacer" />

          <span className="composer-dest">
            {canSend ? `goes to ${destination}` : "nobody reachable"}
          </span>

          <button
            type="button"
            className="btn-accent"
            disabled={!canSend || !draft.trim()}
            onClick={send}
          >
            Send
            <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {dragging ? (
          <div className="composer-drop" aria-hidden="true">
            Drop to offer it to {destination}
          </div>
        ) : null}
      </div>
    </div>
  );
}
