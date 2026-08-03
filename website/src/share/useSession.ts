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
import {
  cipherSizeFor,
  registerServiceWorker,
  serviceWorkerSupported,
  startDownload,
  uploadFile,
} from "./transfer";

export const RELAY_BASE = (
  import.meta.env.VITE_RELAY_URL ?? "https://bonjou.80-225-228-65.sslip.io"
).replace(/\/$/, "");

const RELAY_WS = `${RELAY_BASE.replace(/^http/, "ws")}/ws`;

export interface OutgoingItem {
  requestId: string;
  peerId: string;
  peerName: string;
  file: File;
  label: string;
  streamId: Uint8Array;
  state: "offered" | "sending" | "done" | "failed" | "declined";
  sentBytes: number;
  error?: string;
}

export interface IncomingItem {
  requestId: string;
  from: string;
  fromName: string;
  name: string;
  size: number;
  streamId: string;
  state: "pending" | "approved" | "receiving" | "done" | "failed" | "declined";
  error?: string;
}

export interface ChatLine {
  id: string;
  from: string;
  text: string;
  at: number;
  outbound: boolean;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
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
  // uploads to the same person would race for the same transfer_ready.
  const busyPeers = useRef(new Set<string>());
  const queued = useRef<string[]>([]);

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
    const client = clientRef.current;
    if (!client) return;
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
      client.beginTransfer(item.peerId, cipherSizeFor(item.file.size));
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

  useEffect(() => {
    if (!active || !name) return;

    const client = new RelayClient(RELAY_WS, identity, name);
    clientRef.current = client;

    const unsubscribe = client.on((event) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;

        case "created":
          setCode(event.code);
          // Entering a room resolves whatever the last complaint was,
          // most often a failed join of an expired code. Leaving it up
          // would have the banner contradict the room shown beside it.
          setNotice("");
          window.history.replaceState(null, "", `/r/${event.code}`);
          break;

        case "joined":
          if (event.code) {
            setCode(event.code);
            setNotice("");
            window.history.replaceState(null, "", `/r/${event.code}`);
          }
          break;

        case "roster": {
          setPeers(event.peers);
          void (async () => {
            const next: Record<string, string> = {};
            for (const peer of event.peers) {
              next[peer.id] = await sessionFingerprint(
                identity.publicKey,
                fromHex(peer.pubkey),
              );
            }
            setFingerprints(next);
          })();
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

      if (envelope.kind === ENVELOPE_KINDS.message) {
        setChat((lines) => [
          ...lines,
          {
            id: `${from}-${envelope.ts}-${lines.length}`,
            from: envelope.from || peerName(from),
            text: envelope.message,
            at: envelope.ts * 1000,
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
        };
        incomingRef.current.set(item.requestId, item);
        syncIncoming();
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
          await uploadFile({
            relayBase: RELAY_BASE,
            transferId: event.transferId,
            token: event.token,
            file: item.file,
            streamKey,
            onProgress: (sent) => patchOutgoing(item.requestId, { sentBytes: sent }),
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
        patchIncoming(item.requestId, { state: "receiving" });
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
          from: name,
          text: trimmed,
          at: at * 1000,
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

      for (const to of targets) {
        for (const file of files) {
          const requestId = toHex(randomBytes(8));
          const streamId = randomBytes(16);
          // webkitRelativePath survives a folder pick, so the receiver
          // sees "photos/2024/a.jpg" rather than a pile of bare names.
          const label =
            asFolder && file.webkitRelativePath
              ? file.webkitRelativePath
              : file.name;

          outgoingRef.current.set(requestId, {
            requestId,
            peerId: to,
            peerName: peerName(to),
            file,
            label,
            streamId,
            state: "offered",
            sentBytes: 0,
          });
          syncOutgoing();

          try {
            await client.sendEnvelope(to, {
              kind: ENVELOPE_KINDS.fileOffer,
              from: name,
              from_ip: "",
              to: peerName(to),
              name: label,
              size: file.size,
              ts: Math.floor(Date.now() / 1000),
              message: "",
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

  return {
    status,
    code,
    peers,
    fingerprints,
    outgoing,
    incoming,
    chat,
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
