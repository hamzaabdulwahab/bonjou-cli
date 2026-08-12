import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Command as CommandIcon,
  Copy,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
} from "lucide-react";

import { Logo } from "./Logo";
import type { ConnectionStatus, Peer } from "./relay";
import { EVERYONE } from "./useSession";
import type { ResolvedTheme } from "./theme";
import { usePlatform } from "./usePlatform";

interface RailProps {
  name: string;
  status: ConnectionStatus;
  peers: Peer[];
  labels: Record<string, string>;
  unread: Record<string, number>;
  receivedCount: number;
  activeId: string;
  networkGrouped: boolean;
  code: string;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onSelect: (id: string) => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
  onOpenRoom: () => void;
  onCopyLink: () => void;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: "starting",
  connecting: "connecting",
  connected: "on air",
  reconnecting: "reconnecting",
  closed: "offline",
};

export function Rail(props: RailProps) {
  const {
    name,
    status,
    peers,
    labels,
    unread,
    receivedCount,
    activeId,
    networkGrouped,
    code,
    theme,
    onToggleTheme,
    onSelect,
    onOpenPalette,
    onOpenSettings,
    onOpenRoom,
    onCopyLink,
  } = props;

  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // "/" focuses search, the way it does in every tool with a list this
  // long. Ignored while already typing, or the character never arrives.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const needle = query.trim().toLowerCase();
  const match = (peer: Peer) =>
    !needle || (labels[peer.id] ?? peer.name).toLowerCase().includes(needle);

  const wifi = useMemo(
    () => peers.filter((peer) => peer.source === "network" && match(peer)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peers, labels, needle],
  );
  const room = useMemo(
    () => peers.filter((peer) => peer.source === "code" && match(peer)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peers, labels, needle],
  );

  const noMatches = Boolean(needle) && wifi.length === 0 && room.length === 0;

  const { isMac, isMobile } = usePlatform();

  return (
    <aside className="rail" aria-label="Conversations">
      <div className="rail-brand">
        <Logo size={17} />
        <span className="rail-name">bonjou</span>
        <span className="wordmark-tag">web</span>
        <span className="spacer" />
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? (
            <Sun size={13} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon size={13} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="rail-status">
        <span className={`blip is-${status}`} aria-hidden="true" />
        <span className={`rail-live is-${status}`}>{STATUS_TEXT[status]}</span>
        <span className="rail-sep">·</span>
        <span className="rail-count">
          {peers.length} reachable
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="rail-cmd"
          onClick={onOpenPalette}
          aria-label="Open the command palette"
        >
          {isMobile ? (
            <Search size={12} strokeWidth={1.75} aria-hidden="true" />
          ) : isMac ? (
            <>
              <CommandIcon size={11} strokeWidth={1.75} aria-hidden="true" />
              <span>K</span>
            </>
          ) : (
            <span>Ctrl K</span>
          )}
        </button>
      </div>

      <div className="rail-search">
        <Search size={13} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people"
          aria-label="Search people"
        />
        <span className="bj-kbd" aria-hidden="true">
          /
        </span>
      </div>

      <div className="rail-list bj-scroll">
        <p className="bj-label">Rooms</p>
        <button
          type="button"
          className="chip is-group"
          aria-current={activeId === EVERYONE}
          onClick={() => onSelect(EVERYONE)}
        >
          <span className="chip-mark" aria-hidden="true">
            <Radio size={12} strokeWidth={1.75} />
          </span>
          <span className="chip-name">{code ? `Room ${code}` : "Everyone here"}</span>
          <span className="chip-tag">{peers.length}</span>
        </button>
        <button
          type="button"
          className="chip is-group"
          aria-current={activeId === "received"}
          onClick={() => onSelect("received")}
        >
          <span className="chip-mark" aria-hidden="true">
            <ArrowDownToLine size={12} strokeWidth={1.75} />
          </span>
          <span className="chip-name">Received files</span>
          <span className="chip-tag">{receivedCount}</span>
        </button>

        <PeerGroup
          label="On your Wi-Fi"
          peers={wifi}
          labels={labels}
          unread={unread}
          activeId={activeId}
          onSelect={onSelect}
          tag="wi-fi"
        />
        <PeerGroup
          label="Joined by code"
          peers={room}
          labels={labels}
          unread={unread}
          activeId={activeId}
          onSelect={onSelect}
          tag="room"
        />

        {noMatches ? <p className="rail-note">Nobody here matches that.</p> : null}

        {peers.length === 0 && !needle ? (
          <div className="rail-empty">
            {status === "closed" || status === "reconnecting" ? (
              <>
                <p className="bj-label is-warn">Offline</p>
                <p>
                  Reconnecting. Anything half-sent restarts from the beginning,
                  because nothing partial is ever kept.
                </p>
              </>
            ) : networkGrouped ? (
              <>
                <p className="bj-label">Nobody yet</p>
                <p>
                  Anyone who opens this page on your Wi-Fi appears here on their
                  own. No code, no invite.
                </p>
              </>
            ) : (
              <>
                <p className="bj-label is-warn">Network too large</p>
                <p>
                  Too many devices share your network address to group them
                  safely. A campus or carrier network can put a whole region
                  behind one address.
                </p>
                <button type="button" className="btn-accent" onClick={onOpenRoom}>
                  Open a room instead
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="rail-foot">
        {/*
          Two controls, not one with a nested second: a button inside a
          button is invalid, and screen readers flatten it into a single
          confusing target.
        */}
        <div className="rail-room">
          <button type="button" className="rail-room-open" onClick={onOpenRoom}>
            <span className="bj-label">Room</span>
            <code>{code || "not open"}</code>
          </button>
          {code ? (
            <button
              type="button"
              className="icon-btn"
              onClick={onCopyLink}
              aria-label="Copy the room link"
            >
              <Copy size={13} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <button type="button" className="rail-me" onClick={onOpenSettings}>
          <span className="avatar" aria-hidden="true">
            {name.slice(0, 1).toLowerCase()}
          </span>
          <span className="rail-me-name">{name}</span>
          <span className="spacer" />
          <Settings size={13} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function PeerGroup({
  label,
  peers,
  labels,
  unread,
  activeId,
  onSelect,
  tag,
}: {
  label: string;
  peers: Peer[];
  labels: Record<string, string>;
  unread: Record<string, number>;
  activeId: string;
  onSelect: (id: string) => void;
  tag: string;
}) {
  if (peers.length === 0) return null;
  return (
    <>
      <p className="bj-label is-spaced">{label}</p>
      {peers.map((peer) => (
        <button
          key={peer.id}
          type="button"
          className="chip"
          aria-current={activeId === peer.id}
          onClick={() => onSelect(peer.id)}
        >
          <span className="avatar" aria-hidden="true">
            {(labels[peer.id] ?? peer.name).slice(0, 1).toLowerCase()}
          </span>
          <span className="chip-name">{labels[peer.id] ?? peer.name}</span>
          {unread[peer.id] ? (
            <span className="chip-tag is-unread" aria-label={`${unread[peer.id]} new`}>
              {unread[peer.id]}
            </span>
          ) : (
            <span className="chip-tag">{tag}</span>
          )}
        </button>
      ))}
    </>
  );
}
