import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useMediaQuery } from "./theme";
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

/** Kept clear of every edge by this much, dragged or restored. */
const MARGIN = 10;

/** How far a press travels before it counts as a drag and not a click. */
const DRAG_SLOP = 4;

/**
 * Hold a position inside the viewport.
 *
 * Against the palette's own box, not a fixed inset: clamping x to
 * `innerWidth - 100` let a position saved on a laptop put a 358px palette
 * at x=290 on a 390px phone, leaving a tenth of it on screen.
 */
function clampToViewport(
  pos: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - height - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, pos.x), maxX),
    y: Math.min(Math.max(MARGIN, pos.y), maxY),
  };
}

function storedPosition(): { x: number; y: number } | null {
  try {
    const stored = localStorage.getItem(POS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Unparseable or storage refused. Fall back to centred.
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

  // A phone gets a centred sheet, never a dragged one: there is no room
  // to move it to, and a stored laptop position is meaningless here.
  const narrow = useMediaQuery("(max-width: 860px)");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const pressedBackdrop = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // Layout, not effect: the correction lands before the frame paints, so
  // a restored position never flashes in the wrong place.
  useLayoutEffect(() => {
    if (!open) return;
    if (narrow) {
      setPosition(null);
      return;
    }
    const stored = storedPosition();
    if (!stored) {
      setPosition(null);
      return;
    }
    const el = shellRef.current;
    setPosition(
      clampToViewport(stored, el?.offsetWidth ?? 520, el?.offsetHeight ?? 360),
    );
  }, [open, narrow]);

  // Rotating a phone or dragging a window smaller must not strand it
  // half off the screen.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      const el = shellRef.current;
      if (!el) return;
      setPosition((current) =>
        current
          ? clampToViewport(current, el.offsetWidth, el.offsetHeight)
          : current,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  /*
   * The field fills the header, so refusing to drag from it left a 37px
   * strip beside the icon as the only handle. Spotlight drags from the
   * whole bar and still takes a caret on a plain click, and the way to
   * have both is to wait for the pointer to travel: under the threshold
   * the press is a click, past it the press becomes a drag.
   */
  const handlePointerDown = (e: React.PointerEvent) => {
    if (narrow || !shellRef.current) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) return;

    const rect = shellRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pressOrigin.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const origin = pressOrigin.current;
    if (!origin || !shellRef.current) return;

    if (!isDragging.current) {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_SLOP) {
        return;
      }
      isDragging.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Capture is an optimisation here, not a requirement.
      }
      // A press that began in the field started selecting text on its way
      // out of the slop radius. Drop it rather than drag a highlight.
      document.getSelection()?.removeAllRanges();
    }

    setPosition(
      clampToViewport(
        {
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        },
        shellRef.current.offsetWidth,
        shellRef.current.offsetHeight,
      ),
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pressOrigin.current = null;
    if (!isDragging.current) return;
    isDragging.current = false;
    document.getSelection()?.removeAllRanges();
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

  /*
   * Dismiss on a click that both began and ended on the backdrop.
   *
   * A click's target is the common ancestor of where the press went down
   * and where it came up, so a drag that ended past the palette's edge
   * reported the backdrop and closed the thing being dragged.
   */
  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    pressedBackdrop.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    const startedOutside = pressedBackdrop.current;
    pressedBackdrop.current = false;
    if (!startedOutside || isDragging.current) return;
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
      <div
        className="palette-backdrop"
        onPointerDown={handleBackdropPointerDown}
        onClick={handleOverlayClick}
      >
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
