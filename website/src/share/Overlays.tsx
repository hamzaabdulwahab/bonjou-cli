import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, X } from "lucide-react";

import { FileIcon } from "./FileIcon";
import { formatBytes } from "./transfer";
import type { Settings } from "./settings";
import type { ThemeChoice } from "./theme";
import type { IncomingItem, OutgoingItem, ThreadEvent } from "./useSession";

/* ------------------------------------------------------------------ */
/* Shared shells                                                       */
/* ------------------------------------------------------------------ */

/** A drawer against the right edge. Settings and Transfers both use it. */
function SidePanel({
  open,
  onOpenChange,
  title,
  note,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="side-panel" aria-describedby={undefined}>
          <div className="side-head">
            <Dialog.Title className="side-title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close">
              <X size={13} strokeWidth={1.75} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {note ? <p className="side-note">{note}</p> : null}
          <div className="side-body bj-scroll">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A centred modal. Verify and Room both use it. */
function Modal({
  open,
  onOpenChange,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content
          className={wide ? "modal is-wide" : "modal"}
          aria-describedby={undefined}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return [
    copied,
    (text: string) => {
      void navigator.clipboard.writeText(text).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Verify                                                              */
/* ------------------------------------------------------------------ */

export function VerifyDialog({
  open,
  onOpenChange,
  peerName,
  fingerprint,
  verified,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerName: string;
  fingerprint: string;
  verified: boolean;
  onConfirm: () => void;
}) {
  // The session formats the fingerprint colon-separated ("c2:a8:..."),
  // and it is shown as eight separate tiles because reading a run of
  // sixteen hex characters aloud is exactly where people lose their place.
  const bytes = fingerprint ? fingerprint.split(/[\s:]+/).filter(Boolean) : [];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <p className="bj-label is-accent">Trust on first use</p>
      <Dialog.Title className="modal-title">
        Read this aloud to each other.
      </Dialog.Title>
      <p className="modal-lede">
        Public keys arrive through the relay, so a hostile relay could
        substitute its own. If both screens show the same eight bytes, nobody
        sat in the middle of your key exchange with {peerName}.
      </p>

      {bytes.length > 0 ? (
        <div className="fingerprint">
          {bytes.map((byte, index) => (
            <span key={`${byte}-${index}`}>{byte}</span>
          ))}
        </div>
      ) : (
        <p className="modal-lede">No key has arrived for this person yet.</p>
      )}

      <div className="modal-actions">
        {verified ? (
          <span className="verified-note">
            <Check size={13} strokeWidth={1.75} aria-hidden="true" />
            You confirmed this key already
          </span>
        ) : null}
        <span className="spacer" />
        <Dialog.Close className="btn-quiet">Not now</Dialog.Close>
        <button
          type="button"
          className="btn-accent"
          disabled={bytes.length === 0}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          They match
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

export function RoomDialog({
  open,
  onOpenChange,
  code,
  onCreate,
  onJoin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [entry, setEntry] = useState("");
  const [copiedCode, copyCode] = useCopy();
  const [copiedLink, copyLink] = useCopy();

  const link = code ? `${window.location.origin}/r/${code}` : "";

  return (
    <Modal open={open} onOpenChange={onOpenChange} wide>
      <p className="bj-label is-accent">Someone elsewhere</p>
      <Dialog.Title className="modal-title">
        {code ? "Your room is open." : "Open a room."}
      </Dialog.Title>
      <p className="modal-lede">
        {code
          ? "Anyone with the link joins for as long as this tab stays open. Close it and the room stops existing."
          : "Not on the same Wi-Fi? A room introduces you by code instead of by address. Everything else works the same."}
      </p>

      {code ? (
        <>
          <div className="room-code">
            <code>{code}</code>
            <button type="button" className="btn-quiet" onClick={() => copyCode(code)}>
              {copiedCode ? "Copied" : "Copy code"}
            </button>
            <button type="button" className="btn-accent" onClick={() => copyLink(link)}>
              {copiedLink ? (
                <>
                  <Check size={13} strokeWidth={1.75} aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={13} strokeWidth={1.75} aria-hidden="true" />
                  Copy link
                </>
              )}
            </button>
          </div>

          <div className="room-qr">
            {/*
              Fixed light plate in both themes. The format assumes dark
              modules on a light ground, and plenty of phone cameras will
              not read an inverted code at all, so this one thing does not
              follow the theme.
            */}
            <span className="qr-plate">
              <QRCodeSVG
                value={link}
                size={92}
                level="M"
                bgColor="#ffffff"
                fgColor="#101319"
              />
            </span>
            <p>
              Or point a phone at this. The code is in the link, so nobody has to
              type anything.
            </p>
          </div>
        </>
      ) : (
        <div className="room-start">
          <button type="button" className="btn-accent is-large" onClick={onCreate}>
            Open a room
          </button>
          <p className="room-or">or join one</p>
          <form
            className="room-join"
            onSubmit={(event) => {
              event.preventDefault();
              const value = entry.trim();
              if (value) {
                onJoin(value);
                setEntry("");
              }
            }}
          >
            <input
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              placeholder="enter a code"
              aria-label="Room code"
            />
            <button type="submit" className="btn-quiet" disabled={!entry.trim()}>
              Join
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function SettingsPanel({
  open,
  onOpenChange,
  name,
  onName,
  themeChoice,
  onTheme,
  settings,
  onSetting,
  onEnableNotifications,
  sentBytes,
  receivedBytes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onName: (value: string) => void;
  themeChoice: ThemeChoice;
  onTheme: (choice: ThemeChoice) => void;
  settings: Settings;
  onSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onEnableNotifications: () => Promise<boolean>;
  sentBytes: number;
  receivedBytes: number;
}) {
  const [draft, setDraft] = useState(name);
  const [denied, setDenied] = useState(false);

  useEffect(() => setDraft(name), [name, open]);

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title="Settings">
      <p className="bj-label">Identity</p>
      <form
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
          const value = draft.trim();
          if (value && value !== name) onName(value);
        }}
      >
        <label htmlFor="settings-name">Name others see</label>
        <div className="field-row">
          <input
            id="settings-name"
            value={draft}
            maxLength={64}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn-quiet"
            disabled={!draft.trim() || draft.trim() === name}
          >
            Save
          </button>
        </div>
        <p className="field-note">Stored in this browser only. No account exists.</p>
      </form>

      <p className="bj-label is-spaced">Appearance</p>
      <div className="segmented" role="group" aria-label="Theme">
        {(["light", "dark", "system"] as ThemeChoice[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={themeChoice === option}
            onClick={() => onTheme(option)}
          >
            {option === "light" ? "Light" : option === "dark" ? "Dark" : "System"}
          </button>
        ))}
      </div>

      <Toggle
        label="Compact rows"
        note="Tighter spacing, for watching a busy room on a small screen."
        on={settings.compact}
        onChange={(value) => onSetting("compact", value)}
      />
      <Toggle
        label="Show transfer route tags"
        note="Marks each finished transfer direct or relayed."
        on={settings.routeTags}
        onChange={(value) => onSetting("routeTags", value)}
      />

      <p className="bj-label is-spaced">Notifications</p>
      <Toggle
        label="A file is offered to you"
        note={
          denied
            ? "Your browser has blocked notifications for this site."
            : "Only fires while this tab is in the background."
        }
        on={settings.notifyOffers}
        onChange={(value) => {
          if (!value) {
            onSetting("notifyOffers", false);
            return;
          }
          void onEnableNotifications().then((granted) => setDenied(!granted));
        }}
      />

      <p className="bj-label is-spaced">This session</p>
      <dl className="totals">
        <div>
          <dt>Sent</dt>
          <dd>{formatBytes(sentBytes)}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>{formatBytes(receivedBytes)}</dd>
        </div>
        <div>
          <dt>Kept on a server</dt>
          <dd className="is-accent">0 bytes</dd>
        </div>
      </dl>
    </SidePanel>
  );
}

function Toggle({
  label,
  note,
  on,
  onChange,
}: {
  label: string;
  note: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span className="toggle-copy">
        <span className="toggle-label">{label}</span>
        <span className="toggle-note">{note}</span>
      </span>
      <span className={on ? "switch is-on" : "switch"} aria-hidden="true">
        <span className="switch-knob" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

interface HistoryEntry {
  key: string;
  name: string;
  line: string;
  size: number;
  path?: string;
  ok: boolean;
  at: number;
  folder: boolean;
}

export function transferHistory(
  events: ThreadEvent[],
  labels: Record<string, string>,
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const groups = new Map<string, { items: OutgoingItem[]; at: number }>();

  for (const event of events) {
    if (event.kind === "incoming") {
      const item: IncomingItem = event.item;
      if (item.state === "pending") continue;
      out.push({
        key: item.requestId,
        name: item.name,
        line: `From ${labels[item.from] ?? item.fromName}`,
        size: item.size,
        path: item.path,
        ok: item.state === "done",
        at: item.at,
        folder: Boolean(item.note),
      });
      continue;
    }
    if (event.kind !== "outgoing") continue;
    const group = groups.get(event.item.groupId);
    if (group) group.items.push(event.item);
    else groups.set(event.item.groupId, { items: [event.item], at: event.at });
  }

  for (const [groupId, { items, at }] of groups) {
    const names = items.map((i) => labels[i.peerId] ?? i.peerName);
    const failed = items.filter(
      (i) => i.state === "failed" || i.state === "declined",
    );
    const paths = new Set(items.map((i) => i.path));
    out.push({
      key: groupId,
      name: items[0].label,
      line:
        failed.length === items.length
          ? `${failed[0].state === "declined" ? "Declined by" : "Failed to"} ${names.join(", ")}`
          : `To ${names.join(", ")}`,
      size: items[0].size,
      path: paths.size === 1 ? items[0].path : undefined,
      ok: items.every((i) => i.state === "done"),
      at,
      folder: false,
    });
  }

  return out.sort((a, b) => b.at - a.at);
}

export function TransfersPanel({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: HistoryEntry[];
}) {
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Transfers"
      note="This session only. Closing the tab forgets all of it."
    >
      {entries.length === 0 ? (
        <p className="empty">Nothing has moved yet.</p>
      ) : (
        <ul className="history">
          {entries.map((entry) => (
            <li key={entry.key}>
              <span
                className={entry.ok ? "dot is-ok" : "dot is-bad"}
                aria-hidden="true"
              />
              <FileIcon name={entry.name} folder={entry.folder} size={17} />
              <span className="history-copy">
                <span className="history-name">{entry.name}</span>
                <span className="history-line">
                  {entry.line} ·{" "}
                  {new Date(entry.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
              <span className="history-side">
                <span className="history-size">{formatBytes(entry.size)}</span>
                {entry.path ? (
                  <span className="history-path">{entry.path}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}
