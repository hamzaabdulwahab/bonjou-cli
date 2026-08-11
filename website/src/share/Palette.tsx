import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import {
  ArrowDownToLine,
  Contrast,
  FolderClosed,
  Paperclip,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  History as HistoryIcon,
} from "lucide-react";

import type { Peer } from "./relay";
import { EVERYONE } from "./useSession";

interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peers: Peer[];
  labels: Record<string, string>;
  canVerify: boolean;
  onSelectThread: (id: string) => void;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onRoom: () => void;
  onVerify: () => void;
  onToggleTheme: () => void;
  onSettings: () => void;
  onTransfers: () => void;
}

/**
 * The command palette.
 *
 * Built on cmdk rather than by hand: filtering, roving focus, and the
 * listbox semantics a search-and-select control needs are exactly the part
 * that goes wrong when it is hand-rolled, and none of it is the
 * interesting part of this product.
 */
const POS_KEY = "bonjou:palette:pos";

function getInitialPosition(): { x: number; y: number } | null {
  try {
    const stored = localStorage.getItem(POS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        const maxX = Math.max(10, window.innerWidth - 100);
        const maxY = Math.max(10, window.innerHeight - 100);
        return {
          x: Math.min(Math.max(10, parsed.x), maxX),
          y: Math.min(Math.max(10, parsed.y), maxY),
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function Palette(props: PaletteProps) {
  const {
    open,
    onOpenChange,
    peers,
    labels,
    canVerify,
    onSelectThread,
    onPickFiles,
    onPickFolder,
    onRoom,
    onVerify,
    onToggleTheme,
    onSettings,
    onTransfers,
  } = props;

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored = getInitialPosition();
    if (stored) {
      setPosition(stored);
    } else {
      const width = Math.min(520, window.innerWidth - 32);
      const height = 360;
      const x = Math.max(16, (window.innerWidth - width) / 2);
      const y = Math.max(16, (window.innerHeight - height) / 2);
      setPosition({ x, y });
    }
  }, [open]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!shellRef.current) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button")) {
      return;
    }

    isDragging.current = true;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const rect = shellRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !shellRef.current) return;

    const width = shellRef.current.offsetWidth;
    const height = shellRef.current.offsetHeight;

    const newX = Math.min(Math.max(10, e.clientX - dragOffset.current.x), window.innerWidth - width - 10);
    const newY = Math.min(Math.max(10, e.clientY - dragOffset.current.y), window.innerHeight - height - 10);

    const newPos = { x: newX, y: newY };
    setPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (position) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(position));
      } catch {
        // Ignore
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
      onOpenChange(false);
    }
  };

  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  const stylePosition: React.CSSProperties = position
    ? {
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "none",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="palette"
      overlayClassName="scrim"
      contentClassName="palette-shell"
    >
      <div className="palette-backdrop" onClick={handleOverlayClick}>
        <div
          ref={shellRef}
          className="palette-container"
          style={stylePosition}
        >
          <div
            className="palette-head"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <Search size={14} strokeWidth={1.75} className="palette-search-icon" aria-hidden="true" />
            <Command.Input placeholder="Type a command or a name" />
            <span className="bj-kbd" aria-hidden="true">
              esc
            </span>
          </div>

      <Command.List className="bj-scroll">
        <Command.Empty>Nothing matches that.</Command.Empty>

        <Command.Group heading="Actions">
          <Command.Item onSelect={run(onPickFiles)}>
            <Paperclip size={13} strokeWidth={1.75} aria-hidden="true" />
            Send files to this thread
          </Command.Item>
          <Command.Item onSelect={run(onPickFolder)}>
            <FolderClosed size={13} strokeWidth={1.75} aria-hidden="true" />
            Send a folder to this thread
          </Command.Item>
          <Command.Item onSelect={run(onRoom)}>
            <Ticket size={13} strokeWidth={1.75} aria-hidden="true" />
            Open or join a room
          </Command.Item>
          {canVerify ? (
            <Command.Item onSelect={run(onVerify)}>
              <ShieldCheck size={13} strokeWidth={1.75} aria-hidden="true" />
              Verify security fingerprint
            </Command.Item>
          ) : null}
          <Command.Item onSelect={run(onTransfers)}>
            <HistoryIcon size={13} strokeWidth={1.75} aria-hidden="true" />
            Show this session's transfers
          </Command.Item>
          <Command.Item onSelect={run(onToggleTheme)}>
            <Contrast size={13} strokeWidth={1.75} aria-hidden="true" />
            Toggle light and dark
          </Command.Item>
          <Command.Item onSelect={run(onSettings)}>
            <Settings size={13} strokeWidth={1.75} aria-hidden="true" />
            Open settings
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Go to">
          <Command.Item onSelect={run(() => onSelectThread(EVERYONE))}>
            <Radio size={13} strokeWidth={1.75} aria-hidden="true" />
            Everyone here
          </Command.Item>
          <Command.Item onSelect={run(() => onSelectThread("received"))}>
            <ArrowDownToLine size={13} strokeWidth={1.75} aria-hidden="true" />
            Received files
          </Command.Item>
          {peers.map((peer) => (
            <Command.Item
              key={peer.id}
              value={`${labels[peer.id] ?? peer.name} ${peer.source}`}
              onSelect={run(() => onSelectThread(peer.id))}
            >
              <span className="avatar" aria-hidden="true">
                {(labels[peer.id] ?? peer.name).slice(0, 1).toLowerCase()}
              </span>
              {labels[peer.id] ?? peer.name}
              <span className="palette-tag">
                {peer.source === "network" ? "wi-fi" : "room"}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
        </div>
      </div>
    </Command.Dialog>
  );
}
