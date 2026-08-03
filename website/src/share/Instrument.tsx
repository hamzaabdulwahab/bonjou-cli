import { useEffect, useMemo, useRef, useState } from "react";

import { formatBytes } from "./transfer";
import type { ConnectionStatus, Peer } from "./relay";
import type { ChatLine, IncomingItem, OutgoingItem } from "./useSession";

interface InstrumentProps {
  name: string;
  onName: (value: string) => void;
  status: ConnectionStatus;
  code: string;
  peers: Peer[];
  fingerprints: Record<string, string>;
  outgoing: OutgoingItem[];
  incoming: IncomingItem[];
  chat: ChatLine[];
  notice: string;
  networkGrouped: boolean;
  onNotice: (value: string) => void;
  onSendText: (targets: string[], text: string) => void;
  onSendFiles: (targets: string[], files: File[], asFolder?: boolean) => void;
  onApprove: (item: IncomingItem) => void;
  onDecline: (item: IncomingItem) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: "starting",
  connecting: "connecting",
  connected: "on air",
  reconnecting: "reconnecting",
  closed: "offline",
};

export function Instrument(props: InstrumentProps) {
  const {
    name,
    onName,
    status,
    code,
    peers,
    fingerprints,
    outgoing,
    incoming,
    chat,
    notice,
    networkGrouped,
    onNotice,
    onSendText,
    onSendFiles,
    onApprove,
    onDecline,
    onCreateRoom,
    onJoinRoom,
  } = props;

  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [joinValue, setJoinValue] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  // Drop anyone who has left, and start with everybody selected so the
  // common case, sending to the room, needs no clicks.
  useEffect(() => {
    setSelected((current) => {
      const present = peers.map((p) => p.id);
      const kept = current.filter((id) => present.includes(id));
      return kept.length > 0 || current.length > 0 ? kept : present;
    });
  }, [peers]);

  useEffect(() => {
    if (selected.length === 0 && peers.length > 0) setSelected(peers.map((p) => p.id));
    // Only when peers first appear; deliberate omission of `selected`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers.length]);

  const activity = useMemo(() => {
    const rows = [
      ...chat.map((line) => ({ kind: "chat" as const, at: line.at, line })),
      ...incoming.map((item) => ({ kind: "in" as const, at: 0, item })),
      ...outgoing.map((item) => ({ kind: "out" as const, at: 0, item })),
    ];
    return rows;
  }, [chat, incoming, outgoing]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [activity.length]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const allSelected = peers.length > 0 && selected.length === peers.length;
  const canSend = selected.length > 0;

  if (!name) {
    return (
      <div className="instrument">
        <div className="instrument-bar">
          <span>bonjou</span>
          <span>{STATUS_TEXT.idle}</span>
        </div>
        <div className="gate">
          <h3>What should people see you as?</h3>
          <p className="dim" style={{ fontSize: "0.9rem" }}>
            Shown to anyone who can reach you. No account, nothing kept.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const input = new FormData(event.currentTarget).get("name");
              const value = String(input ?? "").trim();
              if (value) onName(value);
            }}
          >
            <input name="name" autoFocus maxLength={64} placeholder="ada" aria-label="Your name" />
            <button type="submit">Start</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="instrument">
      <div className="instrument-bar">
        <span>
          bonjou / {name}
          {code ? ` / room ${code}` : ""}
        </span>
        <span>
          {STATUS_TEXT[status]}
          {peers.length > 0 ? ` / ${peers.length} reachable` : ""}
        </span>
      </div>

      <div className="instrument-body">
        <div className="pane pane-presence">
          <div>
            <div className="pane-label">Reachable now</div>
            <div className="presence">
            {peers.length === 0 ? (
              <p className="presence-empty">
                {networkGrouped
                  ? "Nobody else yet. Anyone who opens this page on your Wi-Fi appears here on their own. To reach someone elsewhere, open a room and send them the link."
                  : "Too many devices share your network address to group them safely, which usually means mobile data or a large campus network. Open a room and share the link instead."}
              </p>
            ) : (
              <>
                {peers.map((peer) => (
                  <button
                    key={peer.id}
                    type="button"
                    className="node"
                    aria-pressed={selected.includes(peer.id)}
                    onClick={() => toggle(peer.id)}
                  >
                    <span className="blip" aria-hidden="true" />
                    <span className="node-name">
                      {peer.name}
                      <span className="fingerprint">{fingerprints[peer.id] ?? "…"}</span>
                    </span>
                    <span className="node-tag">
                      {peer.source === "network" ? "wi-fi" : "room"}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="link everyone"
                  onClick={() => setSelected(allSelected ? [] : peers.map((p) => p.id))}
                >
                  {allSelected ? "Clear selection" : "Select everyone"}
                </button>
              </>
            )}
            </div>
          </div>

          <div className="reach-more">
            <div className="pane-label">Someone else</div>
            {code ? (
              <div className="room-live">
                <code>{code}</code>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
                    onNotice("Link copied.");
                  }}
                >
                  Copy link
                </button>
              </div>
            ) : (
              <>
                <button type="button" className="ghost" onClick={onCreateRoom}>
                  Open a room
                </button>
                <input
                  value={joinValue}
                  onChange={(event) => setJoinValue(event.target.value)}
                  placeholder="or enter a code"
                  aria-label="Room code"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && joinValue.trim()) {
                      onJoinRoom(joinValue.trim());
                      setJoinValue("");
                    }
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="pane">
          <div className="composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                canSend ? "Type a message" : "Select someone to send to"
              }
              aria-label="Message"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (canSend && draft.trim()) {
                    onSendText(selected, draft);
                    setDraft("");
                  }
                }
              }}
            />
            <div className="actions">
              <button
                type="button"
                disabled={!canSend || !draft.trim()}
                onClick={() => {
                  onSendText(selected, draft);
                  setDraft("");
                }}
              >
                Send message
              </button>

              {/* A label wrapping the input is one control, not a button
                  sitting on top of an invisible second one. */}
              <label className={canSend ? "file-btn" : "file-btn is-disabled"}>
                <input
                  type="file"
                  multiple
                  disabled={!canSend}
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    if (files.length) onSendFiles(selected, files);
                    event.target.value = "";
                  }}
                />
                Send files
              </label>

              <label className={canSend ? "file-btn" : "file-btn is-disabled"}>
                <input
                  type="file"
                  multiple
                  disabled={!canSend}
                  // Folder picking is vendor-prefixed with no standard
                  // equivalent, so React needs it passed through.
                  {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    if (files.length) onSendFiles(selected, files, true);
                    event.target.value = "";
                  }}
                />
                Send folder
              </label>
            </div>
            {canSend ? (
              <p className="state">
                Sending to {selected.length === peers.length && peers.length > 1
                  ? `everyone (${peers.length})`
                  : selected
                      .map((id) => peers.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
              </p>
            ) : null}
          </div>

          <div className="pane-label" style={{ marginTop: "1.25rem" }}>
            Activity
          </div>
          <div className="log" ref={logRef}>
            {activity.length === 0 ? (
              <p className="log-empty">
                Nothing yet. Messages arrive instantly. Files wait for you to
                approve them, so nothing lands on your disk uninvited.
              </p>
            ) : (
              <>
                {chat.map((line) => (
                  <div key={line.id} className={line.outbound ? "entry outbound" : "entry"}>
                    <div className="entry-head">
                      <span className="entry-who">{line.outbound ? "you" : line.from}</span>
                      <span className="entry-size">
                        {new Date(line.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="entry-text">{line.text}</div>
                  </div>
                ))}

                {incoming.map((item) => (
                  <div key={item.requestId} className="entry">
                    <div className="entry-head">
                      <span className="entry-who">from {item.fromName}</span>
                      <span className="entry-size">{formatBytes(item.size)}</span>
                    </div>
                    <div className="entry-name">{item.name}</div>
                    {item.state === "pending" ? (
                      <div className="actions">
                        <button type="button" onClick={() => onApprove(item)}>
                          Approve
                        </button>
                        <button type="button" className="ghost" onClick={() => onDecline(item)}>
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className={`state is-${item.state}`}>
                        {incomingLabel(item)}
                      </span>
                    )}
                  </div>
                ))}

                {outgoing.map((item) => (
                  <div key={item.requestId} className="entry">
                    <div className="entry-head">
                      <span className="entry-who">to {item.peerName}</span>
                      <span className="entry-size">{formatBytes(item.file.size)}</span>
                    </div>
                    <div className="entry-name">{item.label}</div>
                    <span className={`state is-${item.state}`}>{outgoingLabel(item)}</span>
                    {item.state === "sending" ? (
                      <div className="bar">
                        <span
                          style={{
                            transform: `scaleX(${
                              item.file.size > 0 ? item.sentBytes / item.file.size : 0
                            })`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>


      {notice ? (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" className="link" onClick={() => onNotice("")}>
            dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

function incomingLabel(item: IncomingItem): string {
  switch (item.state) {
    case "approved":
      return "starting";
    case "receiving":
      return "downloading";
    case "done":
      return "saved";
    case "declined":
      return "declined";
    case "failed":
      return item.error ? `failed: ${item.error}` : "failed";
    default:
      return item.state;
  }
}

function outgoingLabel(item: OutgoingItem): string {
  switch (item.state) {
    case "offered":
      return "waiting for approval";
    case "sending":
      return `sending ${Math.round(
        item.file.size > 0 ? (item.sentBytes / item.file.size) * 100 : 0,
      )}%`;
    case "done":
      return "sent";
    case "declined":
      return "declined";
    case "failed":
      return item.error ? `failed: ${item.error}` : "failed";
    default:
      return item.state;
  }
}
