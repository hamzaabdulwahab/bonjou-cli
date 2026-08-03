import { useEffect, useMemo, useState } from "react";

import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { Thread } from "./Thread";
import type { ConnectionStatus, Peer } from "./relay";
import { EVERYONE, type IncomingItem, type ThreadEvent } from "./useSession";

interface InstrumentProps {
  name: string;
  onName: (value: string) => void;
  status: ConnectionStatus;
  code: string;
  peers: Peer[];
  fingerprints: Record<string, string>;
  events: ThreadEvent[];
  received: IncomingItem[];
  pendingCount: number;
  unread: Record<string, number>;
  markRead: (threadId: string) => void;
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
    events,
    received,
    pendingCount,
    unread,
    markRead,
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

  const [activeId, setActiveId] = useState<string>(EVERYONE);

  // Names come from localStorage, which every tab of a browser profile
  // shares, so several peers legitimately arrive called the same thing.
  // Number the duplicates. Hex would be exact but reads as a serial
  // number, and nobody picks a person out of a list that way.
  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const peer of peers) counts.set(peer.name, (counts.get(peer.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    const out: Record<string, string> = {};
    for (const peer of peers) {
      if ((counts.get(peer.name) ?? 0) > 1) {
        const nth = (seen.get(peer.name) ?? 0) + 1;
        seen.set(peer.name, nth);
        out[peer.id] = `${peer.name} (${nth})`;
      } else {
        out[peer.id] = peer.name;
      }
    }
    return out;
  }, [peers]);

  // A thread whose peer has left would otherwise strand the composer with
  // nobody to send to.
  useEffect(() => {
    if (activeId === EVERYONE || activeId === "received") return;
    if (!peers.some((peer) => peer.id === activeId)) setActiveId(EVERYONE);
  }, [peers, activeId]);

  useEffect(() => {
    markRead(activeId);
  }, [activeId, events.length, markRead]);

  const targets = useMemo(() => {
    if (activeId === "received") return [];
    if (activeId === EVERYONE) return peers.map((peer) => peer.id);
    return peers.some((peer) => peer.id === activeId) ? [activeId] : [];
  }, [activeId, peers]);

  const destination =
    activeId === EVERYONE
      ? peers.length === 1
        ? (labels[peers[0].id] ?? "everyone")
        : "everyone"
      : (labels[activeId] ?? "");

  const title = activeId === EVERYONE ? "Everyone" : (labels[activeId] ?? "Received");
  const subtitle = threadSubtitle(activeId, peers, received.length, pendingCount);

  if (!name) {
    return (
      <div className="instrument">
        <div className="instrument-bar">
          <span>bonjou</span>
          <span>{STATUS_TEXT.idle}</span>
        </div>
        <div className="gate">
          <h2>What should people see you as?</h2>
          <p>Shown to anyone who can reach you. No account, nothing kept.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("name") ?? "",
              ).trim();
              if (value) onName(value);
            }}
          >
            <input
              name="name"
              autoFocus
              maxLength={64}
              placeholder="ada"
              aria-label="Your name"
            />
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
          {pendingCount > 0
            ? `${pendingCount} waiting for you / `
            : ""}
          {STATUS_TEXT[status]}
          {peers.length > 0 ? ` / ${peers.length} reachable` : ""}
        </span>
      </div>

      <div className="instrument-body">
        <ConversationList
          peers={peers}
          labels={labels}
          fingerprints={fingerprints}
          unread={unread}
          receivedCount={received.length}
          activeId={activeId}
          networkGrouped={networkGrouped}
          code={code}
          onSelect={setActiveId}
          onCreateRoom={onCreateRoom}
          onJoinRoom={onJoinRoom}
          onCopyLink={() => {
            void navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
            onNotice("Link copied.");
          }}
        />

        <Thread
          threadId={activeId}
          title={title}
          subtitle={subtitle}
          events={events}
          received={received}
          labels={labels}
          onApprove={onApprove}
          onDecline={onDecline}
        />
      </div>

      {activeId === "received" ? null : (
        <Composer
          targets={targets}
          destination={destination}
          onSendText={onSendText}
          onSendFiles={onSendFiles}
        />
      )}

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

function threadSubtitle(
  activeId: string,
  peers: Peer[],
  receivedCount: number,
  pendingCount: number,
): string {
  if (activeId === "received") {
    return receivedCount === 1 ? "1 file this session" : `${receivedCount} files this session`;
  }
  if (activeId === EVERYONE) {
    if (peers.length === 0) return "Nobody reachable yet";
    const parts = [
      peers.length === 1 ? "1 person" : `${peers.length} people`,
      pendingCount > 0 ? `${pendingCount} waiting for you` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }
  const peer = peers.find((p) => p.id === activeId);
  if (!peer) return "No longer reachable";
  return peer.source === "network" ? "On your Wi-Fi" : "Joined by room code";
}
