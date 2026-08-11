import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";

import { Composer } from "./Composer";
import { FileIcon } from "./FileIcon";
import { NameGate } from "./NameGate";
import { Palette } from "./Palette";
import { Rail } from "./Rail";
import { Thread } from "./Thread";
import {
  RoomDialog,
  SettingsPanel,
  TransfersPanel,
  VerifyDialog,
  transferHistory,
} from "./Overlays";
import { formatBytes } from "./transfer";
import { notifyOffer, useSettings } from "./settings";
import { useVerified } from "./verified";
import type { Peer } from "./relay";
import { useMediaQuery, type ThemeChoice, type ResolvedTheme } from "./theme";
import { EVERYONE, type IncomingItem, type useSession } from "./useSession";

interface WorkspaceProps {
  name: string;
  onName: (value: string) => void;
  session: ReturnType<typeof useSession>;
  themeChoice: ThemeChoice;
  theme: ResolvedTheme;
  onThemeChoice: (choice: ThemeChoice) => void;
  onToggleTheme: () => void;
}

export function Workspace(props: WorkspaceProps) {
  const { name, onName, session, themeChoice, theme, onThemeChoice, onToggleTheme } =
    props;

  const [activeId, setActiveId] = useState<string>(EVERYONE);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [palette, setPalette] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);

  const { settings, set: setSetting, enableNotifications } = useSettings();
  const { confirm, isVerified } = useVerified();
  // The offer sheet is a phone affordance. On a desktop the offer already
  // sits in the thread, and a second copy in a modal would be an
  // interruption rather than a help.
  const narrow = useMediaQuery("(max-width: 860px)");

  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const announced = useRef(new Set<string>());

  const selectThread = useCallback((id: string) => {
    setActiveId(id);
    setMobileView("thread");
  }, []);

  // Names come from localStorage, which every tab of a browser profile
  // shares, so several peers legitimately arrive called the same thing.
  // Number the duplicates. Hex would be exact but reads as a serial
  // number, and nobody picks a person out of a list that way.
  const labels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const peer of session.peers) {
      counts.set(peer.name, (counts.get(peer.name) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    const out: Record<string, string> = {};
    for (const peer of session.peers) {
      if ((counts.get(peer.name) ?? 0) > 1) {
        const nth = (seen.get(peer.name) ?? 0) + 1;
        seen.set(peer.name, nth);
        out[peer.id] = `${peer.name} (${nth})`;
      } else {
        out[peer.id] = peer.name;
      }
    }
    return out;
  }, [session.peers]);

  // A thread whose peer has left would otherwise strand the composer with
  // nobody to send to.
  useEffect(() => {
    if (activeId === EVERYONE || activeId === "received") return;
    if (!session.peers.some((peer) => peer.id === activeId)) setActiveId(EVERYONE);
  }, [session.peers, activeId]);

  const { markRead } = session;
  useEffect(() => {
    markRead(activeId);
  }, [activeId, session.events.length, markRead]);

  // A file offered while the tab is in the background is the one event
  // worth interrupting somebody for, and the only one wired to a system
  // notification.
  useEffect(() => {
    if (!settings.notifyOffers) return;
    for (const event of session.events) {
      if (event.kind !== "incoming") continue;
      const item = event.item;
      if (item.state !== "pending" || announced.current.has(item.requestId)) continue;
      announced.current.add(item.requestId);
      notifyOffer(labels[item.from] ?? item.fromName, item.name);
    }
  }, [session.events, settings.notifyOffers, labels]);

  // Everyone on one Wi-Fi is already in a shared room, so a code room used
  // to add people rather than narrow to them: a broadcast reached the
  // neighbour who never entered the code. Once there is a room, a
  // broadcast means the room. Neighbours stay listed and individually
  // reachable, they just stop receiving what was addressed to the room.
  const roomPeers = useMemo(
    () => session.peers.filter((peer) => peer.source === "code"),
    [session.peers],
  );
  const inRoom = Boolean(session.code);
  const broadcast = inRoom ? roomPeers : session.peers;

  const targets = useMemo(() => {
    if (activeId === "received") return [];
    if (activeId === EVERYONE) return broadcast.map((peer) => peer.id);
    return session.peers.some((peer) => peer.id === activeId) ? [activeId] : [];
  }, [activeId, session.peers, broadcast]);

  const activePeer = session.peers.find((peer) => peer.id === activeId);

  const destination =
    activeId === EVERYONE
      ? broadcast.length === 1
        ? (labels[broadcast[0].id] ?? "everyone")
        : inRoom
          ? `room ${session.code}`
          : "everyone"
      : (labels[activeId] ?? "");

  const title =
    activeId === EVERYONE
      ? inRoom
        ? `Room ${session.code}`
        : "Everyone here"
      : activeId === "received"
        ? "Received files"
        : (labels[activeId] ?? "Received");

  const subtitle = threadSubtitle(
    activeId,
    session.peers,
    broadcast,
    inRoom,
    session.received.length,
    session.pendingCount,
    activePeer,
  );

  const { sent, received } = useMemo(() => {
    let sentTotal = 0;
    let receivedTotal = 0;
    for (const event of session.events) {
      if (event.kind === "outgoing") sentTotal += event.item.sentBytes;
      if (event.kind === "incoming" && event.item.state === "done") {
        receivedTotal += event.item.size;
      }
    }
    return { sent: sentTotal, received: receivedTotal };
  }, [session.events]);

  const history = useMemo(
    () => transferHistory(session.events, labels),
    [session.events, labels],
  );

  // The newest offer still waiting on an answer. On a phone it is raised
  // into a sheet, because a decision buried in a scrolled thread is one
  // people miss.
  const pendingOffer = useMemo(() => {
    let latest: IncomingItem | null = null;
    for (const event of session.events) {
      if (event.kind !== "incoming") continue;
      if (event.item.state !== "pending") continue;
      if (!latest || event.item.at > latest.at) latest = event.item;
    }
    return latest;
  }, [session.events]);

  const copyLink = useCallback(() => {
    void navigator.clipboard.writeText(
      `${window.location.origin}/r/${session.code}`,
    );
    session.setNotice("Room link copied.");
  }, [session]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!name) return <NameGate onName={onName} />;

  const canVerify = Boolean(activePeer);
  const classes = [
    "workspace",
    `is-${mobileView}`,
    settings.compact ? "is-compact" : "",
    settings.routeTags ? "" : "no-route-tags",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <Rail
        name={name}
        status={session.status}
        peers={session.peers}
        labels={labels}
        unread={session.unread}
        receivedCount={session.received.length}
        activeId={activeId}
        networkGrouped={session.networkGrouped}
        code={session.code}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onSelect={selectThread}
        onOpenPalette={() => setPalette(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRoom={() => setRoomOpen(true)}
        onCopyLink={copyLink}
      />

      <div className="stage">
        <Thread
          threadId={activeId}
          title={title}
          subtitle={subtitle}
          events={session.events}
          received={session.received}
          labels={labels}
          canVerify={canVerify}
          onApprove={session.approve}
          onDecline={session.decline}
          onVerify={() => setVerifyOpen(true)}
          onHistory={() => setTransfersOpen(true)}
          onBack={() => setMobileView("list")}
        />

        {activeId === "received" ? null : (
          <Composer
            targets={targets}
            destination={destination}
            onSendText={session.sendText}
            onSendFiles={session.sendFiles}
          />
        )}
      </div>

      {/* Driven from the palette, which has no file control of its own. */}
      <input
        ref={fileInput}
        type="file"
        multiple
        className="bj-sr"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) session.sendFiles(targets, files);
          event.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="bj-sr"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length) session.sendFiles(targets, files, true);
          event.target.value = "";
        }}
      />

      <Palette
        open={palette}
        onOpenChange={setPalette}
        peers={session.peers}
        labels={labels}
        canVerify={canVerify}
        onSelectThread={selectThread}
        onPickFiles={() => fileInput.current?.click()}
        onPickFolder={() => folderInput.current?.click()}
        onRoom={() => setRoomOpen(true)}
        onVerify={() => setVerifyOpen(true)}
        onToggleTheme={onToggleTheme}
        onSettings={() => setSettingsOpen(true)}
        onTransfers={() => setTransfersOpen(true)}
      />

      <VerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        peerName={activePeer ? (labels[activePeer.id] ?? activePeer.name) : ""}
        fingerprint={activePeer ? (session.fingerprints[activePeer.id] ?? "") : ""}
        verified={Boolean(activePeer && isVerified(activePeer.pubkey))}
        onConfirm={() => activePeer && confirm(activePeer.pubkey)}
      />

      <RoomDialog
        open={roomOpen}
        onOpenChange={setRoomOpen}
        code={session.code}
        onCreate={session.createRoom}
        onJoin={(value) => {
          session.joinRoom(value);
          setRoomOpen(false);
        }}
      />

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        name={name}
        onName={onName}
        themeChoice={themeChoice}
        onTheme={onThemeChoice}
        settings={settings}
        onSetting={setSetting}
        onEnableNotifications={enableNotifications}
        sentBytes={sent}
        receivedBytes={received}
      />

      <TransfersPanel
        open={transfersOpen}
        onOpenChange={setTransfersOpen}
        entries={history}
      />

      {pendingOffer && narrow ? (
        <Drawer.Root open shouldScaleBackground={false} dismissible={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="sheet-scrim" />
            <Drawer.Content className="sheet">
              <Drawer.Handle className="sheet-grip" />
              <Drawer.Title className="bj-label is-accent">
                {labels[pendingOffer.from] ?? pendingOffer.fromName} is offering
              </Drawer.Title>
              <p className="sheet-name">
                <FileIcon
                  name={pendingOffer.name}
                  folder={Boolean(pendingOffer.note)}
                  size={22}
                />
                {pendingOffer.name}
              </p>
              <Drawer.Description className="sheet-meta">
                {formatBytes(pendingOffer.size)}
                {pendingOffer.note ? ` · ${pendingOffer.note}` : ""}
              </Drawer.Description>
              <p className="sheet-note">
                Nothing has downloaded yet. The bytes are still on their machine,
                and approving is what starts the transfer.
              </p>
              <div className="sheet-actions">
                <button
                  type="button"
                  className="btn-accent is-large"
                  onClick={() => session.approve(pendingOffer)}
                >
                  Approve and download
                </button>
                <button
                  type="button"
                  className="btn-quiet is-large"
                  onClick={() => session.decline(pendingOffer)}
                >
                  Decline
                </button>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : null}
    </div>
  );
}

function threadSubtitle(
  activeId: string,
  peers: Peer[],
  broadcast: Peer[],
  inRoom: boolean,
  receivedCount: number,
  pendingCount: number,
  activePeer?: Peer,
): string {
  if (activeId === "received") {
    return receivedCount === 1
      ? "1 file this session · nothing kept after you close the tab"
      : `${receivedCount} files this session · nothing kept after you close the tab`;
  }
  if (activeId === EVERYONE) {
    if (broadcast.length === 0) {
      return inRoom ? "Nobody has joined yet, share the code" : "Nobody reachable yet";
    }
    // Naming the people left out is the whole point: without it, someone
    // visible in the list but not receiving the broadcast looks like a bug.
    const outside = inRoom ? peers.length - broadcast.length : 0;
    return [
      broadcast.length === 1 ? "1 person" : `${broadcast.length} people`,
      pendingCount > 0 ? `${pendingCount} waiting for you` : "",
      outside > 0 ? `${outside} more on your Wi-Fi, message them one to one` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (!activePeer) return "No longer reachable";
  return activePeer.source === "network"
    ? "On your Wi-Fi · direct when the connection allows it"
    : "Joined by room code";
}
