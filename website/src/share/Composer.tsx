import { useState } from "react";

interface ComposerProps {
  /** Who this will reach, already resolved from the active thread. */
  targets: string[];
  destination: string;
  onSendText: (targets: string[], text: string) => void;
  onSendFiles: (targets: string[], files: File[], asFolder?: boolean) => void;
}

export function Composer({
  targets,
  destination,
  onSendText,
  onSendFiles,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const canSend = targets.length > 0;

  const send = () => {
    if (!canSend || !draft.trim()) return;
    onSendText(targets, draft);
    setDraft("");
  };

  return (
    <div className="composer">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={canSend ? `Message ${destination}` : "Nobody to send to yet"}
        aria-label={canSend ? `Message ${destination}` : "Message"}
        disabled={!canSend}
        rows={1}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter breaks the line. The convention in
          // every messaging app, and the reason the field starts one row
          // tall rather than looking like a form.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />

      <div className="composer-actions">
        <label className={canSend ? "attach" : "attach is-disabled"} title="Send files">
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
          Files
        </label>

        <label className={canSend ? "attach" : "attach is-disabled"} title="Send a folder">
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
          Folder
        </label>

        <button type="button" disabled={!canSend || !draft.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
