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
  formatBytes,
  registerServiceWorker,
  serviceWorkerSupported,
  startDownload,
  uploadFile,
} from "./transfer";

const RELAY_BASE = (
  import.meta.env.VITE_RELAY_URL ?? "https://bonjou.80-225-228-65.sslip.io"
).replace(/\/$/, "");

const RELAY_WS = `${RELAY_BASE.replace(/^http/, "ws")}/ws`;

/** A file the local user offered, held until the peer approves or declines. */
interface OutgoingOffer {
  requestId: string;
  file: File;
  streamId: Uint8Array;
  peerId: string;
  state: "offered" | "sending" | "done" | "failed" | "declined";
  sentBytes: number;
  error?: string;
}

/** An offer from a peer, shown as metadata only until the user approves. */
interface IncomingOffer {
  requestId: string;
  from: string;
  name: string;
  size: number;
  streamId: string;
  state: "pending" | "approved" | "receiving" | "done" | "failed" | "declined";
  error?: string;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function roomCodeFromLocation(): string {
  const fromPath = /^\/r\/([^/]+)/.exec(window.location.pathname);
  if (fromPath) return decodeURIComponent(fromPath[1]);
  return new URLSearchParams(window.location.search).get("r") ?? "";
}

function loadName(): string {
  return localStorage.getItem("bonjou.name") ?? "";
}

export default function App() {
  const identity = useMemo<KeyPair>(() => generateKeyPair(), []);
  const clientRef = useRef<RelayClient | null>(null);

  const [name, setName] = useState(loadName);
  const [nameCommitted, setNameCommitted] = useState(() => loadName() !== "");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState(roomCodeFromLocation);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({});
  const [outgoing, setOutgoing] = useState<OutgoingOffer[]>([]);
  const [incoming, setIncoming] = useState<IncomingOffer[]>([]);
  const [notice, setNotice] = useState<string>("");
  const [selectedPeer, setSelectedPeer] = useState<string>("");

  // Transfer bookkeeping lives in refs: these are read inside relay event
  // handlers, which must not be re-created whenever React state changes.
  const outgoingRef = useRef(new Map<string, OutgoingOffer>());
  const incomingRef = useRef(new Map<string, IncomingOffer>());
  const transferOwnerRef = useRef(new Map<string, string>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateOutgoing = useCallback(
    (requestId: string, patch: Partial<OutgoingOffer>) => {
      const current = outgoingRef.current.get(requestId);
      if (!current) return;
      const next = { ...current, ...patch };
      outgoingRef.current.set(requestId, next);
      setOutgoing([...outgoingRef.current.values()]);
    },
    [],
  );

  const updateIncoming = useCallback(
    (requestId: string, patch: Partial<IncomingOffer>) => {
      const current = incomingRef.current.get(requestId);
      if (!current) return;
      const next = { ...current, ...patch };
      incomingRef.current.set(requestId, next);
      setIncoming([...incomingRef.current.values()]);
    },
    [],
  );

  useEffect(() => {
    if (!nameCommitted) return;

    const client = new RelayClient(RELAY_WS, identity, name);
    clientRef.current = client;

    const unsubscribe = client.on((event) => {
      switch (event.type) {
        case "status":
          setStatus(event.status);
          break;

        case "created":
          setCode(event.code);
          window.history.replaceState(null, "", `/r/${event.code}`);
          break;

        case "joined":
          setCode(event.code);
          window.history.replaceState(null, "", `/r/${event.code}`);
          break;

        case "roster": {
          const others = event.peers.filter((p) => p.id !== client.selfId);
          setPeers(others);
          setSelectedPeer((current) =>
            others.some((p) => p.id === current) ? current : (others[0]?.id ?? ""),
          );
          void (async () => {
            const next: Record<string, string> = {};
            for (const peer of others) {
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
          const requestId = transferOwnerRef.current.get(event.transferId);
          if (requestId && incomingRef.current.has(requestId)) {
            updateIncoming(requestId, { state: "failed", error: event.status });
          }
          break;
        }

        case "peerLeft":
          setNotice("A peer left the room.");
          break;

        case "error":
          setNotice(event.message);
          break;
      }
    });

    client.connect();
    const initial = roomCodeFromLocation();
    if (initial) client.joinRoom(initial);
    else client.createRoom();

    return () => {
      unsubscribe();
      client.close();
      clientRef.current = null;
    };
    // The client is intentionally created once per committed identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameCommitted]);

  const handleEnvelope = useCallback(
    async (from: string, envelope: Envelope) => {
      const client = clientRef.current;
      if (!client) return;

      if (envelope.kind === ENVELOPE_KINDS.fileOffer) {
        const offer: IncomingOffer = {
          requestId: envelope.request_id ?? "",
          from,
          name: envelope.name,
          size: envelope.size,
          streamId: envelope.stream_id ?? "",
          state: "pending",
        };
        incomingRef.current.set(offer.requestId, offer);
        setIncoming([...incomingRef.current.values()]);
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.fileRequest) {
        // The peer approved. Only now does the relay learn a transfer is
        // about to happen, and only now do any bytes move.
        const requestId = envelope.request_id ?? "";
        const offer = outgoingRef.current.get(requestId);
        if (!offer) return;
        updateOutgoing(requestId, { state: "sending" });
        client.beginTransfer(offer.peerId, cipherSizeFor(offer.file.size));
        return;
      }

      if (envelope.kind === ENVELOPE_KINDS.fileReject) {
        updateOutgoing(envelope.request_id ?? "", { state: "declined" });
      }
    },
    [updateOutgoing],
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
        const offer = [...outgoingRef.current.values()].find(
          (o) => o.peerId === event.peerId && o.state === "sending",
        );
        if (!offer) return;
        transferOwnerRef.current.set(event.transferId, offer.requestId);
        try {
          const shared = await client.sharedWith(event.peerId);
          const streamKey = await importAesKey(
            await deriveStreamKey(shared, offer.streamId),
          );
          await uploadFile({
            relayBase: RELAY_BASE,
            transferId: event.transferId,
            token: event.token,
            file: offer.file,
            streamKey,
            onProgress: (sent) =>
              updateOutgoing(offer.requestId, { sentBytes: sent }),
          });
          updateOutgoing(offer.requestId, { state: "done" });
        } catch (err) {
          updateOutgoing(offer.requestId, {
            state: "failed",
            error: describe(err),
          });
        }
        return;
      }

      const offer = [...incomingRef.current.values()].find(
        (o) => o.from === event.peerId && o.state === "approved",
      );
      if (!offer) return;
      transferOwnerRef.current.set(event.transferId, offer.requestId);
      try {
        const shared = await client.sharedWith(event.peerId);
        const streamKey = await deriveStreamKey(
          shared,
          fromHex(offer.streamId),
        );
        updateIncoming(offer.requestId, { state: "receiving" });
        await startDownload({
          relayBase: RELAY_BASE,
          transferId: event.transferId,
          token: event.token,
          filename: offer.name,
          plaintextSize: offer.size,
          streamKey,
        });
        updateIncoming(offer.requestId, { state: "done" });
      } catch (err) {
        updateIncoming(offer.requestId, {
          state: "failed",
          error: describe(err),
        });
      }
    },
    [updateIncoming, updateOutgoing],
  );

  const sendFile = useCallback(
    async (file: File) => {
      const client = clientRef.current;
      if (!client || !selectedPeer) {
        setNotice("Pick someone to send to first.");
        return;
      }
      const requestId = toHex(randomBytes(8));
      const streamId = randomBytes(16);
      const offer: OutgoingOffer = {
        requestId,
        file,
        streamId,
        peerId: selectedPeer,
        state: "offered",
        sentBytes: 0,
      };
      outgoingRef.current.set(requestId, offer);
      setOutgoing([...outgoingRef.current.values()]);

      const envelope: Envelope = {
        kind: ENVELOPE_KINDS.fileOffer,
        from: name,
        from_ip: "",
        to: client.peer(selectedPeer)?.name ?? "",
        name: file.name,
        size: file.size,
        ts: Math.floor(Date.now() / 1000),
        message: "",
        // Per-chunk AEAD authenticates every byte in flight, so a
        // whole-file digest would add nothing but a full read of a
        // possibly multi-gigabyte file before the transfer could start.
        checksum: "",
        hmac: "",
        request_id: requestId,
        stream_id: toHex(streamId),
      };
      try {
        await client.sendEnvelope(selectedPeer, envelope);
      } catch (err) {
        updateOutgoing(requestId, { state: "failed", error: describe(err) });
      }
    },
    [name, selectedPeer, updateOutgoing],
  );

  const approve = useCallback(
    async (offer: IncomingOffer) => {
      const client = clientRef.current;
      if (!client) return;
      if (!serviceWorkerSupported()) {
        updateIncoming(offer.requestId, {
          state: "failed",
          error: "this browser cannot stream downloads to disk",
        });
        return;
      }
      try {
        await registerServiceWorker();
        updateIncoming(offer.requestId, { state: "approved" });
        await client.sendEnvelope(offer.from, {
          kind: ENVELOPE_KINDS.fileRequest,
          from: name,
          from_ip: "",
          to: "",
          name: offer.name,
          size: offer.size,
          ts: Math.floor(Date.now() / 1000),
          message: "",
          checksum: "",
          hmac: "",
          request_id: offer.requestId,
        });
      } catch (err) {
        updateIncoming(offer.requestId, {
          state: "failed",
          error: describe(err),
        });
      }
    },
    [name, updateIncoming],
  );

  const decline = useCallback(
    async (offer: IncomingOffer) => {
      const client = clientRef.current;
      if (!client) return;
      updateIncoming(offer.requestId, { state: "declined" });
      await client.sendEnvelope(offer.from, {
        kind: ENVELOPE_KINDS.fileReject,
        from: name,
        from_ip: "",
        to: "",
        name: offer.name,
        size: offer.size,
        ts: Math.floor(Date.now() / 1000),
        message: "",
        checksum: "",
        hmac: "",
        request_id: offer.requestId,
      });
    },
    [name, updateIncoming],
  );

  const shareUrl = code ? `${window.location.origin}/r/${code}` : "";

  if (!nameCommitted) {
    return (
      <main className="shell">
        <Header />
        <section className="card gate">
          <h2>What should people call you?</h2>
          <p className="muted">
            Shown to whoever you share with. No account, nothing stored.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              localStorage.setItem("bonjou.name", trimmed);
              setName(trimmed);
              setNameCommitted(true);
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder="ada"
              aria-label="Display name"
            />
            <button type="submit" disabled={!name.trim()}>
              Continue
            </button>
          </form>
          {joinCode ? (
            <p className="muted small">
              You'll join room <code>{joinCode}</code>.
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <Header />

      <section className="card">
        <div className="row between">
          <div>
            <span className="label">Room</span>
            <div className="code">{code || "…"}</div>
          </div>
          <StatusPill status={status} />
        </div>

        {shareUrl ? (
          <div className="share-row">
            <input readOnly value={shareUrl} aria-label="Share link" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                setNotice("Link copied.");
              }}
            >
              Copy link
            </button>
          </div>
        ) : null}

        <p className="muted small">
          Send this link to the other device. Both of you need to stay on the
          page — nothing is stored on the server, so files stream directly
          between you.
        </p>
      </section>

      {notice ? (
        <div className="notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <section className="card">
        <span className="label">In this room</span>
        {peers.length === 0 ? (
          <p className="muted">
            Nobody else yet. Share the link above and they'll appear here.
          </p>
        ) : (
          <ul className="peers">
            {peers.map((peer) => (
              <li key={peer.id}>
                <label>
                  <input
                    type="radio"
                    name="peer"
                    checked={selectedPeer === peer.id}
                    onChange={() => setSelectedPeer(peer.id)}
                  />
                  <span className="peer-name">{peer.name}</span>
                </label>
                <code
                  className="fingerprint"
                  title="Compare this out loud with the other person to rule out a relay in the middle"
                >
                  {fingerprints[peer.id] ?? "…"}
                </code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <span className="label">Send</span>
        <input
          ref={fileInputRef}
          type="file"
          disabled={peers.length === 0}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void sendFile(file);
            event.target.value = "";
          }}
        />
        {peers.length === 0 ? (
          <p className="muted small">Waiting for someone to join.</p>
        ) : (
          <p className="muted small">
            They'll see the name and size first, and nothing transfers until
            they approve.
          </p>
        )}

        {outgoing.length > 0 ? (
          <ul className="transfers">
            {outgoing.map((offer) => (
              <li key={offer.requestId}>
                <div className="row between">
                  <span className="filename">{offer.file.name}</span>
                  <span className="muted small">
                    {formatBytes(offer.file.size)}
                  </span>
                </div>
                <Progress
                  state={offer.state}
                  done={offer.sentBytes}
                  total={offer.file.size}
                  error={offer.error}
                  labels={{
                    offered: "Waiting for approval",
                    sending: "Sending",
                    done: "Sent",
                    declined: "Declined",
                    failed: "Failed",
                  }}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {incoming.length > 0 ? (
        <section className="card">
          <span className="label">Incoming</span>
          <ul className="transfers">
            {incoming.map((offer) => (
              <li key={offer.requestId}>
                <div className="row between">
                  <span className="filename">{offer.name}</span>
                  <span className="muted small">{formatBytes(offer.size)}</span>
                </div>
                {offer.state === "pending" ? (
                  <div className="row gap">
                    <button type="button" onClick={() => void approve(offer)}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void decline(offer)}
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <Progress
                    state={offer.state}
                    done={0}
                    total={offer.size}
                    error={offer.error}
                    labels={{
                      approved: "Starting",
                      receiving: "Downloading",
                      done: "Saved",
                      declined: "Declined",
                      failed: "Failed",
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="foot muted small">
        Files are encrypted in your browser with AES-256-GCM before they reach
        the relay, which forwards them without storing anything and has no key
        to read them. Same protocol as the Bonjou CLI.
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className="head">
      <a className="brand" href="/">
        bonjou
      </a>
      <span className="muted small">encrypted browser-to-browser transfer</span>
    </header>
  );
}

function StatusPill({ status }: { status: ConnectionStatus }) {
  const text: Record<ConnectionStatus, string> = {
    idle: "starting",
    connecting: "connecting",
    connected: "connected",
    reconnecting: "reconnecting",
    closed: "disconnected",
  };
  return <span className={`pill pill-${status}`}>{text[status]}</span>;
}

function Progress({
  state,
  done,
  total,
  error,
  labels,
}: {
  state: string;
  done: number;
  total: number;
  error?: string;
  labels: Record<string, string>;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const active = state === "sending";
  return (
    <div className="progress-block">
      <div className="row between">
        <span className={`muted small state-${state}`}>
          {labels[state] ?? state}
          {active ? ` · ${pct}%` : ""}
        </span>
        {error ? <span className="error small">{error}</span> : null}
      </div>
      {active ? (
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
