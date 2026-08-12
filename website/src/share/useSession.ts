/**
 * All session state for the transfer instrument: who is reachable, what
 * has been offered, what is moving.
 *
 * Kept apart from the components because the relay's event handlers must
 * not be rebuilt every render, and because the rules about consent live
 * here: an incoming offer is metadata until its user approves it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ENVELOPE_KINDS,
  deriveStreamKey,
  fromHex,
  generateKeyPair,
  importAesKey,
  sessionFingerprint,
  toHex,
  type Envelope,
  type KeyPair,
} from "./crypto";
import { RelayClient, describe, type ConnectionStatus, type Peer } from "./relay";
import { useSiblingTabs } from "./tabs";
import {
  cipherSizeFor,
  registerServiceWorker,
  sendOverChannel,
  serviceWorkerSupported,
  startDirectDownload,
  startDownload,
  uploadStream,
  type DownloadSink,
} from "./transfer";
import {
  LinkRegistry,
  isRtcSignalKind,
  rtcSupported,
  type ChannelControl,
} from "./webrtc";
import { entriesFor, folderNameFor, zipSize, zipStream } from "./zip";

export const RELAY_BASE = (
  import.meta.env.VITE_RELAY_URL ?? "https://bonjou.80-225-228-65.sslip.io"
).replace(/\/$/, "");

const RELAY_WS = `${RELAY_BASE.replace(/^http/, "ws")}/ws`;

/**
 * How long to wait for a direct connection before giving up and using the
 * relay. Negotiation starts when the file is offered, so by the time
 * somebody has approved it this has usually already resolved; the wait
 * only matters when approval is instant.
 */
const DIRECT_WAIT_MS = 5000;

/**
 * Which route a transfer took. Worth surfacing: it is the difference
 * between a LAN and a round trip to Mumbai, and otherwise people are left
 * guessing why one send was fast and another was not.
 */
export type TransferPath = "direct" | "relayed";

export type OutgoingState = "offered" | "sending" | "done" | "failed" | "declined";
export type IncomingState =
  | "pending"
  | "approved"
  | "receiving"
  | "done"
  | "failed"
  | "declined";

export interface OutgoingItem {
  requestId: string;
  peerId: string;
  peerName: string;
  /** Plaintext bytes this send will produce. */
  size: number;
  /**
   * Opens the plaintext afresh. A function rather than a stream because
   * each recipient needs its own: a folder is zipped per transfer, and a
   * stream cannot be read twice.
   */
  openStream: () => ReadableStream<Uint8Array>;
  label: string;
  streamId: Uint8Array;
  state: OutgoingState;
  sentBytes: number;
  error?: string;
  at: number;
  /** Set once the route is chosen, at the moment sending starts. */
  path?: TransferPath;
  /**
   * Sending one file to several people fans out into one transfer each,
   * because a shared secret is per pair. groupId ties those back together
   * so the Everyone view can show a single row instead of one per
   * recipient.
   */
  groupId: string;
}

export interface IncomingItem {
  requestId: string;
  from: string;
  fromName: string;
  name: string;
  size: number;
  streamId: string;
  state: IncomingState;
  error?: string;
  at: number;
  /** Extra human detail from the sender, such as a folder's file count. */
  note?: string;
  /** Set once the route is known, at the moment bytes start arriving. */
  path?: TransferPath;
  /**
   * Sealed bytes arrived so far, against `cipherSizeFor(size)`. Counted in
   * ciphertext because that is what this side can actually observe, and
   * the ratio is exact either way.
   *
   * Only the direct path can fill this in: a relayed download is streamed
   * to disk inside the service worker, which the page never sees. Left
   * undefined there rather than estimated, so the progress bar can be
   * honestly indeterminate instead of inventing a number.
   */
  receivedBytes?: number;
}

export interface ChatLine {
  id: string;
  /** Inbound: the sender. Outbound: everyone it was addressed to. */
  peerIds: string[];
  from: string;
  text: string;
  at: number;
  outbound: boolean;
}

/**
 * One entry in a conversation. Messages and transfers share a shape so a
 * thread can sort them into a single true timeline; the previous model
 * kept three parallel lists with no timestamps on two of them, which made
 * correct ordering impossible rather than merely absent.
 */
export type ThreadEvent =
  | { kind: "message"; id: string; at: number; peerIds: string[]; line: ChatLine }
  | {
      kind: "incoming";
      id: string;
      at: number;
      peerIds: string[];
      item: IncomingItem;
    }
  | {
      kind: "outgoing";
      id: string;
      at: number;
      peerIds: string[];
      item: OutgoingItem;
    };

export const EVERYONE = "everyone";

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Progress arrives once per 64 KiB frame, which on a direct connection is
 * several hundred React renders a second for a number nobody can read that
 * fast. Coalesce to roughly ten a second, leading and trailing, so the
 * last value always lands and a finished transfer never rests a frame
 * short of complete.
 */
const PROGRESS_INTERVAL_MS = 100;

function throttleProgress(emit: (bytes: number) => void): (bytes: number) => void {
  let lastAt = 0;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (bytes: number) => {
    latest = bytes;
    const now = Date.now();
    const since = now - lastAt;
    if (since >= PROGRESS_INTERVAL_MS) {
      lastAt = now;
      emit(latest);
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      lastAt = Date.now();
      emit(latest);
    }, PROGRESS_INTERVAL_MS - since);
  };
}

function roomCodeFromLocation(): string {
  const fromPath = /^\/r\/([^/]+)/.exec(window.location.pathname);
  if (fromPath) return decodeURIComponent(fromPath[1]);
  return new URLSearchParams(window.location.search).get("r") ?? "";
}

export function useSession(name: string, active: boolean) {
  const identity = useMemo<KeyPair>(() => generateKeyPair(), []);
  const clientRef = useRef<RelayClient | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [code, setCode] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  // This tab's own relay id, and the ids of this browser's other tabs.
  // The relay cannot tell those apart from other people on the same
  // address, so they are filtered here rather than there. See tabs.ts.
  const [selfPeerId, setSelfPeerId] = useState("");
  const siblingTabs = useSiblingTabs(selfPeerId);
  const siblingTabsRef = useRef(siblingTabs);
  siblingTabsRef.current = siblingTabs;
  // The roster exactly as the relay sent it, kept so the visible list can
  // be recomputed when a sibling tab opens or closes without waiting for
  // the relay to send a fresh one.
  const rosterRef = useRef<Peer[]>([]);
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({});
  const [outgoing, setOutgoing] = useState<OutgoingItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingItem[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [notice, setNotice] = useState("");
  const [networkGrouped, setNetworkGrouped] = useState(true);

  const outgoingRef = useRef(new Map<string, OutgoingItem>());
  const incomingRef = useRef(new Map<string, IncomingItem>());
  const transferOwner = useRef(new Map<string, string>());
  // One transfer at a time per peer; the rest wait. Two concurrent
  // uploads to the same person would race for the same transfer_ready,
  // and would interleave frames on a shared data channel.
  const busyPeers = useRef(new Set<string>());
  const queued = useRef<string[]>([]);

  const linksRef = useRef<LinkRegistry | null>(null);
  /** The one direct download in flight per peer, and where its bytes go. */
  const activeReceive = useRef(
    new Map<
      string,
      {
        requestId: string;
        sink: DownloadSink;
        /** Sealed bytes taken in so far, for the progress bar. */
        received: number;
        report: (bytes: number) => void;
      }
    >(),
  );
  /** Senders waiting for the receiver to confirm its download is open. */
  const readyWaiters = useRef(
    new Map<string, { resolve: () => void; reject: (err: Error) => void }>(),
  );
  // pumpQueue starts a send, and a finished send pumps the queue again.
  // One of the two references has to be late-bound; this is it.
  const beginSend = useRef<(requestId: string) => void>(() => {});

  const syncOutgoing = () => setOutgoing([...outgoingRef.current.values()]);
  const syncIncoming = () => setIncoming([...incomingRef.current.values()]);

  const patchOutgoing = useCallback(
    (requestId: string, patch: Partial<OutgoingItem>) => {
      const current = outgoingRef.current.get(requestId);
      if (!current) return;
      outgoingRef.current.set(requestId, { ...current, ...patch });
      syncOutgoing();
    },
    [],
  );

  const patchIncoming = useCallback(
    (requestId: string, patch: Partial<IncomingItem>) => {
      const current = incomingRef.current.get(requestId);
      if (!current) return;
      incomingRef.current.set(requestId, { ...current, ...patch });
      syncIncoming();
    },
    [],
  );

  /** Starts the next queued send for a peer that has gone idle. */
  const pumpQueue = useCallback(() => {
    if (!clientRef.current) return;
    const stillQueued: string[] = [];
    for (const requestId of queued.current) {
      const item = outgoingRef.current.get(requestId);
      if (!item || item.state !== "offered") continue;
      if (busyPeers.current.has(item.peerId)) {
        stillQueued.push(requestId);
        continue;
      }
      busyPeers.current.add(item.peerId);
      patchOutgoing(requestId, { state: "sending" });
      beginSend.current(requestId);
    }
    queued.current = stillQueued;
  }, [patchOutgoing]);

  const releasePeer = useCallback(
    (peerId: string) => {
      busyPeers.current.delete(peerId);
      pumpQueue();
    },
    [pumpQueue],
  );

  /**
   * Turn the relay's roster into the list of actual other people.
   *
   * Runs both when a roster arrives and when the set of sibling tabs
   * changes, because opening a second tab has to remove a name from the
   * first tab's list without the relay having anything new to say.
   */
  const applyRoster = useCallback(() => {
    const visible = rosterRef.current.filter(
      (peer) => !siblingTabsRef.current.has(peer.id),
    );
    setPeers(visible);
    // A peer that left and came back has a new id and new keys, so its
    // old connection is worthless and must be renegotiated. Sibling tabs
    // are excluded here too: there is no reason to negotiate a direct
    // connection with another tab of this same browser.
    linksRef.current?.retain(visible.map((peer) => peer.id));
    void (async () => {
      const next: Record<string, string> = {};
      for (const peer of visible) {
        next[peer.id] = await sessionFingerprint(
          identity.publicKey,
          fromHex(peer.pubkey),
        );
      }
      setFingerprints(next);
    })();
  }, [identity]);

  useEffect(() => {
    applyRoster();
  }, [siblingTabs, applyRoster]);

  useEffect(() => {
    if (!active || !name) return;

    const client = new RelayClient(RELAY_WS, identity, name);
    clientRef.current = client;

    // Signalling is just another sealed envelope, so the relay forwards
    // offers and candidates without being able to read them and learns
    // nothing it did not already know.
    if (rtcSupported()) {
      const selfKey = toHex(identity.publicKey);
      linksRef.current = new LinkRegistry(
        (peerId) => selfKey < (client.peer(peerId)?.pubkey ?? ""),
        (peerId, signal) => {
          void client
            .sendEnvelope(peerId, {
              kind: signal.kind,
              from: name,
              from_ip: "",
              to: "",
              name: "",
              size: 0,
              ts: Math.floor(Date.now() / 1000),
              message: signal.payload,
              checksum: "",
              hmac: "",
            })
            .catch(() => {
              // A candidate that cannot be delivered just means this
              // connection will not form, and the relay path still will.
            });
        },
        (link) => {
          link.listen({
            onControl: (message) => handleChannelControl(link.peerId, message),
            onData: (bytes) => handleChannelData(link.peerId, bytes),
          });
          link.onDisconnect(() => handleLinkClosed(link.peerId));
        },
      );
    }

    const unsubscribe = client.on((event) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;

        case "created":
          setSelfPeerId(event.peerId);
          setCode(event.code);
          // Entering a room resolves whatever the last complaint was,
          // most often a failed join of an expired code. Leaving it up
          // would have the banner contradict the room shown beside it.
          setNotice("");
          window.history.replaceState(null, "", `/r/${event.code}`);
          break;

        case "joined":
          setSelfPeerId(event.peerId);
          if (event.code) {
            setCode(event.code);
            setNotice("");
            window.history.replaceState(null, "", `/r/${event.code}`);
          }
          break;

        case "roster": {
          rosterRef.current = event.peers;
          applyRoster();
          break;
        }

        case "envelope":
          void handleEnvelope(event.from, event.envelope);
          break;

        case "transferReady":
          void handleTransferReady(event);
          break;

        case "transferEnd": {
          const requestId = transferOwner.current.get(event.transferId);
          if (requestId && incomingRef.current.has(requestId)) {
            patchIncoming(requestId, { state: "failed", error: event.status });
          }
          break;
        }

        case "peerLeft":
          break;

        case "error":
          if (event.code === "network_busy") {
            setNetworkGrouped(false);
            break;
          }
          if (event.code === "no_room") {
            // The code in the address bar is dead. Drop it so a reload
            // does not fail the same way, and so "Open a room" is offered.
            window.history.replaceState(null, "", "/");
            setCode("");
          }
          setNotice(event.message);
          break;
      }
    });

    client.connect();
    const initial = roomCodeFromLocation();
    client.hello();
    if (initial) client.joinRoom(initial);

    return () => {
      unsubscribe();
      client.close();
      clientRef.current = null;
      linksRef.current?.closeAll();
      linksRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, name]);

  const peerName = useCallback(
    (id: string) => clientRef.current?.peer(id)?.name ?? "someone",
    [],
  );

  const handleEnvelope = useCallback(
    async (from: string, envelope: Envelope) => {
      const client = clientRef.current;
      if (!client) return;

      if (isRtcSignalKind(envelope.kind)) {
        // An offer arriving is itself the signal that this peer wants a
        // connection, so creating the link here is what answers it.
        await linksRef.current
          ?.get(from)
          .accept({ kind: envelope.kind, payload: envelope.message });
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.message) {
        setChat((lines) => [
          ...lines,
          {
            id: `${from}-${envelope.ts}-${lines.length}`,
            peerIds: [from],
            from: envelope.from || peerName(from),
            text: envelope.message,
            // Trust the local clock for ordering. A peer's timestamp
            // orders their own messages fine but can sit anywhere
            // relative to ours if their clock is off.
            at: Date.now(),
            outbound: false,
          },
        ]);
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.fileOffer) {
        const item: IncomingItem = {
          requestId: envelope.request_id ?? "",
          from,
          fromName: envelope.from || peerName(from),
          name: envelope.name,
          size: envelope.size,
          streamId: envelope.stream_id ?? "",
          state: "pending",
          at: Date.now(),
          note: envelope.message || undefined,
        };
        incomingRef.current.set(item.requestId, item);
        syncIncoming();
        // Negotiate now, while this is being read. Connecting takes a
        // moment, and starting it at approval would spend that moment
        // with somebody watching a stalled progress bar.
        linksRef.current?.get(from).start();
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.fileRequest) {
        // Approved. Only now does the relay learn a transfer is about to
        // happen, and only now do any bytes move.
        const requestId = envelope.request_id ?? "";
        const item = outgoingRef.current.get(requestId);
        if (!item) return;
        queued.current.push(requestId);
        pumpQueue();
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.fileReject) {
        patchOutgoing(envelope.request_id ?? "", { state: "declined" });
      }
    },
    [patchOutgoing, peerName, pumpQueue],
  );

  const handleTransferReady = useCallback(
    async (event: {
      transferId: string;
      token: string;
      role: "sender" | "receiver";
      peerId: string;
      size: number;
    }) => {
      const client = clientRef.current;
      if (!client) return;

      if (event.role === "sender") {
        const item = [...outgoingRef.current.values()].find(
          (o) => o.peerId === event.peerId && o.state === "sending",
        );
        if (!item) return;
        transferOwner.current.set(event.transferId, item.requestId);
        try {
          const shared = await client.sharedWith(event.peerId);
          const streamKey = await importAesKey(
            await deriveStreamKey(shared, item.streamId),
          );
          await uploadStream({
            relayBase: RELAY_BASE,
            transferId: event.transferId,
            token: event.token,
            source: item.openStream(),
            totalBytes: item.size,
            streamKey,
            onProgress: throttleProgress((sent) =>
              patchOutgoing(item.requestId, { sentBytes: sent }),
            ),
          });
          patchOutgoing(item.requestId, { state: "done" });
        } catch (err) {
          patchOutgoing(item.requestId, { state: "failed", error: describe(err) });
        } finally {
          releasePeer(event.peerId);
        }
        return;
      }

      const item = [...incomingRef.current.values()].find(
        (o) => o.from === event.peerId && o.state === "approved",
      );
      if (!item) return;
      transferOwner.current.set(event.transferId, item.requestId);
      try {
        const shared = await client.sharedWith(event.peerId);
        const streamKey = await deriveStreamKey(shared, fromHex(item.streamId));
        patchIncoming(item.requestId, { state: "receiving", path: "relayed" });
        await startDownload({
          relayBase: RELAY_BASE,
          transferId: event.transferId,
          token: event.token,
          filename: item.name,
          plaintextSize: item.size,
          streamKey,
        });
        patchIncoming(item.requestId, { state: "done" });
      } catch (err) {
        patchIncoming(item.requestId, { state: "failed", error: describe(err) });
      }
    },
    [patchIncoming, patchOutgoing, releasePeer],
  );

  /**
   * Sends one approved transfer, direct if a connection is up and over
   * the relay if not.
   *
   * The relay branch stops here: `transfer_ready` arrives separately and
   * `handleTransferReady` owns the rest of it, including releasing the
   * peer. The direct branch runs to completion inside this call.
   */
  const startSend = useCallback(
    async (requestId: string) => {
      const client = clientRef.current;
      const item = outgoingRef.current.get(requestId);
      if (!client || !item) return;

      const link = linksRef.current?.peek(item.peerId);
      const direct = link ? await link.waitOpen(DIRECT_WAIT_MS) : false;

      if (!link || !direct) {
        patchOutgoing(requestId, { path: "relayed" });
        client.beginTransfer(item.peerId, cipherSizeFor(item.size));
        return;
      }

      patchOutgoing(requestId, { path: "direct" });
      try {
        const shared = await client.sharedWith(item.peerId);
        const streamKey = await importAesKey(
          await deriveStreamKey(shared, item.streamId),
        );

        // The receiver's download has to exist before any bytes move: the
        // port feeding it queues without limit, so this is the one hop
        // backpressure could not otherwise reach.
        const ready = new Promise<void>((resolve, reject) => {
          readyWaiters.current.set(requestId, { resolve, reject });
        });
        link.sendControl({ t: "begin", requestId, size: item.size });
        await withTimeout(
          ready,
          DIRECT_WAIT_MS,
          "the other side never started the download",
        );

        await sendOverChannel({
          channel: link,
          source: item.openStream(),
          streamKey,
          onProgress: throttleProgress((sent) =>
            patchOutgoing(requestId, { sentBytes: sent }),
          ),
        });
        link.sendControl({ t: "end", requestId });
        patchOutgoing(requestId, { state: "done" });
      } catch (err) {
        // Deliberately not retried over the relay. Splicing a
        // half-delivered stream onto a second transport is how a file
        // gets quietly corrupted rather than loudly failed.
        patchOutgoing(requestId, { state: "failed", error: describe(err) });
        try {
          link.sendControl({ t: "abort", requestId, error: describe(err) });
        } catch {
          // The channel is what failed. Nothing left to tell.
        }
      } finally {
        readyWaiters.current.delete(requestId);
        releasePeer(item.peerId);
      }
    },
    [patchOutgoing, releasePeer],
  );

  useEffect(() => {
    beginSend.current = (requestId) => void startSend(requestId);
  }, [startSend]);

  /** Control messages from a peer's data channel. */
  const handleChannelControl = useCallback(
    async (peerId: string, message: ChannelControl) => {
      const client = clientRef.current;
      const link = linksRef.current?.peek(peerId);
      if (!client || !link) return;

      if (message.t === "ready") {
        readyWaiters.current.get(message.requestId)?.resolve();
        return;
      }

      if (message.t === "begin") {
        const item = incomingRef.current.get(message.requestId);
        // The consent rule is the same on both paths: bytes only move for
        // an offer this person explicitly approved. A direct connection
        // does not get to skip that.
        if (!item || item.state !== "approved") {
          link.sendControl({
            t: "abort",
            requestId: message.requestId,
            error: "that transfer was not approved",
          });
          return;
        }
        try {
          const shared = await client.sharedWith(peerId);
          const streamKey = await deriveStreamKey(shared, fromHex(item.streamId));
          const sink = await startDirectDownload({
            transferId: item.requestId,
            filename: item.name,
            plaintextSize: item.size,
            streamKey,
          });
          activeReceive.current.set(peerId, {
            requestId: item.requestId,
            sink,
            received: 0,
            report: throttleProgress((bytes) =>
              patchIncoming(item.requestId, { receivedBytes: bytes }),
            ),
          });
          patchIncoming(item.requestId, {
            state: "receiving",
            path: "direct",
            receivedBytes: 0,
          });
          link.sendControl({ t: "ready", requestId: item.requestId });
        } catch (err) {
          patchIncoming(item.requestId, {
            state: "failed",
            error: describe(err),
          });
          link.sendControl({
            t: "abort",
            requestId: item.requestId,
            error: describe(err),
          });
        }
        return;
      }

      const active = activeReceive.current.get(peerId);
      if (!active || active.requestId !== message.requestId) return;
      activeReceive.current.delete(peerId);

      if (message.t === "end") {
        active.sink.close();
        patchIncoming(message.requestId, { state: "done" });
        return;
      }
      active.sink.abort(message.error);
      patchIncoming(message.requestId, {
        state: "failed",
        error: message.error,
      });
    },
    [patchIncoming],
  );

  /**
   * Payload frames from a peer's data channel. Awaiting the write is what
   * applies backpressure: the link handles messages one at a time, so a
   * slow disk slows the reads, which fills the channel buffer, which
   * pauses the sender.
   */
  const handleChannelData = useCallback(
    async (peerId: string, bytes: Uint8Array) => {
      const active = activeReceive.current.get(peerId);
      if (!active) return;
      try {
        await active.sink.write(bytes);
        active.received += bytes.length;
        active.report(active.received);
      } catch (err) {
        activeReceive.current.delete(peerId);
        active.sink.abort(describe(err));
        patchIncoming(active.requestId, {
          state: "failed",
          error: describe(err),
        });
      }
    },
    [patchIncoming],
  );

  /** A dropped connection fails whatever was riding on it, both ways. */
  const handleLinkClosed = useCallback(
    (peerId: string) => {
      const active = activeReceive.current.get(peerId);
      if (active) {
        activeReceive.current.delete(peerId);
        const error = "the direct connection dropped";
        active.sink.abort(error);
        patchIncoming(active.requestId, { state: "failed", error });
      }
      for (const [requestId, waiter] of readyWaiters.current) {
        if (outgoingRef.current.get(requestId)?.peerId !== peerId) continue;
        waiter.reject(new Error("the direct connection dropped"));
      }
    },
    [patchIncoming],
  );

  /** Sends a text message. No data plane: the text rides in the envelope. */
  const sendText = useCallback(
    async (targets: string[], text: string) => {
      const client = clientRef.current;
      const trimmed = text.trim();
      if (!client || !trimmed || targets.length === 0) return;

      const at = Math.floor(Date.now() / 1000);
      for (const to of targets) {
        try {
          await client.sendEnvelope(to, {
            kind: ENVELOPE_KINDS.message,
            from: name,
            from_ip: "",
            to: peerName(to),
            name: "",
            size: 0,
            ts: at,
            message: trimmed,
            checksum: "",
            hmac: "",
          });
        } catch (err) {
          setNotice(describe(err));
        }
      }
      setChat((lines) => [
        ...lines,
        {
          id: `me-${at}-${lines.length}`,
          peerIds: [...targets],
          from: name,
          text: trimmed,
          at: Date.now(),
          outbound: true,
        },
      ]);
    },
    [name, peerName],
  );

  /**
   * Offers files. Every recipient gets their own offer, sealed to them,
   * because a shared secret is per-pair — there is no way to encrypt once
   * and send to everybody.
   */
  const sendFiles = useCallback(
    async (targets: string[], files: File[], asFolder = false) => {
      const client = clientRef.current;
      if (!client || targets.length === 0 || files.length === 0) return;

      // A folder becomes exactly one payload. Offering each file
      // separately meant one approval per file, and it could not preserve
      // the folder anyway: browsers strip path separators out of download
      // filenames, so everything landed flat. One archive fixes both.
      const payloads = asFolder
        ? [
            (() => {
              const entries = entriesFor(files);
              return {
                label: folderNameFor(files),
                size: zipSize(entries),
                note: `${files.length} ${files.length === 1 ? "file" : "files"}`,
                open: () => zipStream(entries),
              };
            })(),
          ]
        : files.map((file) => ({
            label: file.name,
            size: file.size,
            note: "",
            open: () => file.stream() as ReadableStream<Uint8Array>,
          }));

      // One group per payload, spanning its recipients.
      const groups = payloads.map(() => toHex(randomBytes(6)));

      // Start connecting before anything is offered, so the negotiation
      // overlaps with the time somebody spends deciding.
      for (const to of targets) linksRef.current?.get(to).start();

      for (const to of targets) {
        for (const [index, payload] of payloads.entries()) {
          const requestId = toHex(randomBytes(8));
          const streamId = randomBytes(16);

          outgoingRef.current.set(requestId, {
            requestId,
            peerId: to,
            peerName: peerName(to),
            size: payload.size,
            openStream: payload.open,
            label: payload.label,
            streamId,
            state: "offered",
            sentBytes: 0,
            at: Date.now(),
            groupId: groups[index],
          });
          syncOutgoing();

          try {
            await client.sendEnvelope(to, {
              kind: ENVELOPE_KINDS.fileOffer,
              from: name,
              from_ip: "",
              to: peerName(to),
              name: payload.label,
              size: payload.size,
              ts: Math.floor(Date.now() / 1000),
              // Carries the folder's file count so the receiver can judge
              // the offer before approving it.
              message: payload.note,
              // Per-chunk AEAD authenticates every byte in flight, so a
              // whole-file digest would only cost a full read of a
              // possibly enormous file before anything could start.
              checksum: "",
              hmac: "",
              request_id: requestId,
              stream_id: toHex(streamId),
            });
          } catch (err) {
            patchOutgoing(requestId, { state: "failed", error: describe(err) });
          }
        }
      }
    },
    [name, patchOutgoing, peerName],
  );

  const approve = useCallback(
    async (item: IncomingItem) => {
      const client = clientRef.current;
      if (!client) return;
      if (!serviceWorkerSupported()) {
        patchIncoming(item.requestId, {
          state: "failed",
          error: "this browser cannot stream downloads to disk",
        });
        return;
      }
      try {
        await registerServiceWorker();
        patchIncoming(item.requestId, { state: "approved" });
        await client.sendEnvelope(item.from, {
          kind: ENVELOPE_KINDS.fileRequest,
          from: name,
          from_ip: "",
          to: item.fromName,
          name: item.name,
          size: item.size,
          ts: Math.floor(Date.now() / 1000),
          message: "",
          checksum: "",
          hmac: "",
          request_id: item.requestId,
        });
      } catch (err) {
        patchIncoming(item.requestId, { state: "failed", error: describe(err) });
      }
    },
    [name, patchIncoming],
  );

  const decline = useCallback(
    async (item: IncomingItem) => {
      const client = clientRef.current;
      if (!client) return;
      patchIncoming(item.requestId, { state: "declined" });
      await client.sendEnvelope(item.from, {
        kind: ENVELOPE_KINDS.fileReject,
        from: name,
        from_ip: "",
        to: item.fromName,
        name: item.name,
        size: item.size,
        ts: Math.floor(Date.now() / 1000),
        message: "",
        checksum: "",
        hmac: "",
        request_id: item.requestId,
      });
    },
    [name, patchIncoming],
  );

  const createRoom = useCallback(() => clientRef.current?.createRoom(), []);
  const joinRoom = useCallback((value: string) => clientRef.current?.joinRoom(value), []);

  /**
   * Every message and transfer as one time-ordered list. Threads are a
   * filter over this rather than separate stores, so a message and the
   * file it refers to cannot drift apart in the display.
   */
  const events = useMemo<ThreadEvent[]>(() => {
    const merged: ThreadEvent[] = [
      ...chat.map((line) => ({
        kind: "message" as const,
        id: line.id,
        at: line.at,
        peerIds: line.peerIds,
        line,
      })),
      ...incoming.map((item) => ({
        kind: "incoming" as const,
        id: item.requestId,
        at: item.at,
        peerIds: [item.from],
        item,
      })),
      ...outgoing.map((item) => ({
        kind: "outgoing" as const,
        id: item.requestId,
        at: item.at,
        peerIds: [item.peerId],
        item,
      })),
    ];
    return merged.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }, [chat, incoming, outgoing]);

  /** Files that actually arrived, newest first. */
  const received = useMemo(
    () => incoming.filter((item) => item.state === "done").sort((a, b) => b.at - a.at),
    [incoming],
  );

  const pendingCount = useMemo(
    () => incoming.filter((item) => item.state === "pending").length,
    [incoming],
  );

  // Unread is per thread and time based, so it survives a peer list that
  // reorders and needs no per-event read flags.
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const markRead = useCallback((threadId: string) => {
    setSeenAt((current) => ({ ...current, [threadId]: Date.now() }));
  }, []);

  const unread = useMemo(() => {
    const out: Record<string, number> = {};
    for (const event of events) {
      if (event.kind === "message" && event.line.outbound) continue;
      if (event.kind === "outgoing") continue;
      for (const peerId of event.peerIds) {
        if (event.at > (seenAt[peerId] ?? 0)) out[peerId] = (out[peerId] ?? 0) + 1;
      }
    }
    return out;
  }, [events, seenAt]);

  return {
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
    setNotice,
    sendText,
    sendFiles,
    approve,
    decline,
    createRoom,
    joinRoom,
  };
}
