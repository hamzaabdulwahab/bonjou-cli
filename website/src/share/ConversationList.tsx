import { useState } from "react";

import { EVERYONE } from "./useSession";
import type { Peer } from "./relay";

interface ConversationListProps {
  peers: Peer[];
  labels: Record<string, string>;
  fingerprints: Record<string, string>;
  unread: Record<string, number>;
  receivedCount: number;
  activeId: string;
  networkGrouped: boolean;
  code: string;
  onSelect: (id: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onCopyLink: () => void;
}

export function ConversationList(props: ConversationListProps) {
  const {
    peers,
    labels,
    fingerprints,
    unread,
    receivedCount,
    activeId,
    networkGrouped,
    code,
    onSelect,
    onCreateRoom,
    onJoinRoom,
    onCopyLink,
  } = props;

  const [joinValue, setJoinValue] = useState("");

  return (
    <nav className="rail" aria-label="Conversations">
      <p className="rail-label">Conversations</p>

      <ul className="rail-list">
        <li>
          <button
            type="button"
            className="chip"
            aria-current={activeId === EVERYONE}
            onClick={() => onSelect(EVERYONE)}
          >
            <span className="chip-name">Everyone</span>
            <span className="chip-tag">{peers.length}</span>
          </button>
        </li>

        {peers.map((peer) => (
          <li key={peer.id}>
            <button
              type="button"
              className="chip"
              aria-current={activeId === peer.id}
              onClick={() => onSelect(peer.id)}
              title={
                fingerprints[peer.id]
                  ? `Security fingerprint ${fingerprints[peer.id]}. Read it aloud to each other to confirm nobody is in the middle.`
                  : undefined
              }
            >
              <span className="blip" aria-hidden="true" />
              <span className="chip-name">{labels[peer.id] ?? peer.name}</span>
              {unread[peer.id] ? (
                <span className="chip-unread" aria-label={`${unread[peer.id]} new`}>
                  {unread[peer.id]}
                </span>
              ) : (
                <span className="chip-tag">
                  {peer.source === "network" ? "wi-fi" : "room"}
                </span>
              )}
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            className="chip"
            aria-current={activeId === "received"}
            onClick={() => onSelect("received")}
          >
            <span className="chip-name">Received</span>
            <span className="chip-tag">{receivedCount}</span>
          </button>
        </li>
      </ul>

      {peers.length === 0 ? (
        <p className="rail-note">
          {networkGrouped
            ? "Anyone who opens this page on your Wi-Fi appears here on their own."
            : "Too many devices share your network address to group them safely. Open a room and share the link instead."}
        </p>
      ) : null}

      <div className="rail-foot">
        <p className="rail-label">Someone elsewhere</p>
        {code ? (
          <div className="rail-room">
            <code>{code}</code>
            <button type="button" className="ghost" onClick={onCopyLink}>
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
    </nav>
  );
}
