/**
 * Control-plane client for the Bonjou relay.
 *
 * Everything meaningful this class sends is sealed before it leaves the
 * browser: the relay routes on a destination peer id and forwards an
 * opaque payload. Room membership and transfer setup are the only things
 * it can observe.
 */

import {
  deriveSharedSecret,
  fromHex,
  openEnvelope,
  sealEnvelope,
  toHex,
  type Envelope,
  type KeyPair,
} from "./crypto";

export interface Peer {
  id: string;
  name: string;
  pubkey: string;
  /**
   * Where this peer came from: "network" means the relay saw them arrive
   * from the same public address as you, "code" means they entered a
   * shared code. The distinction matters — a code is a deliberate
   * invitation, a shared address is only a hint.
   */
  source: "network" | "code";
}

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export type RelayEvent =
  | { type: "status"; status: ConnectionStatus }
  | { type: "created"; code: string; peerId: string }
  | { type: "joined"; code: string; peerId: string }
  | { type: "roster"; peers: Peer[] }
  | { type: "envelope"; from: string; envelope: Envelope }
  | {
      type: "transferReady";
      transferId: string;
      token: string;
      role: "sender" | "receiver";
      peerId: string;
      size: number;
    }
  | { type: "transferEnd"; transferId: string; status: string; from: string }
  | { type: "peerLeft"; peerId: string }
  | { type: "error"; code: string; message: string };

type Handler = (event: RelayEvent) => void;

interface ServerFrame {
  type: string;
  code?: string;
  peer_id?: string;
  peers?: Peer[];
  from?: string;
  payload?: string;
  transfer_id?: string;
  token?: string;
  role?: string;
  peer?: string;
  size?: number;
  status?: string;
  code_error?: string;
  message?: string;
}

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;

export class RelayClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private sharedSecrets = new Map<string, Uint8Array>();
  private roster = new Map<string, Peer>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  /** Set once the room is known, so a reconnect can rejoin it. */
  private saidHello = false;
  private pendingIntent: { action: "create" | "join"; code?: string } | null =
    null;

  selfId = "";

  constructor(
    private readonly url: string,
    private readonly identity: KeyPair,
    private displayName: string,
  ) {}

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: RelayEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  get peers(): Peer[] {
    return [...this.roster.values()].filter((p) => p.id !== this.selfId);
  }

  peer(id: string): Peer | undefined {
    return this.roster.get(id);
  }

  connect(): void {
    this.closedByUser = false;
    this.emit({
      type: "status",
      status: this.reconnectAttempt === 0 ? "connecting" : "reconnecting",
    });

    const socket = new WebSocket(this.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit({ type: "status", status: "connected" });
      // A reconnect lands in a fresh relay session, so re-announce.
      if (this.saidHello) this.sendHello();
      if (this.pendingIntent?.action === "create") this.sendCreate();
      else if (this.pendingIntent?.action === "join" && this.pendingIntent.code)
        this.sendJoin(this.pendingIntent.code);
    };

    socket.onmessage = (event) => {
      void this.handleFrame(event.data as string);
    };

    socket.onclose = () => {
      this.socket = null;
      if (this.closedByUser) {
        this.emit({ type: "status", status: "closed" });
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose always follows, and it owns the reconnect decision.
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt += 1;
    this.emit({ type: "status", status: "reconnecting" });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private send(frame: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(frame));
  }

  /**
   * Announces this browser and joins the room shared by everyone on the
   * same public address. It is the browser's stand-in for the CLI's UDP
   * broadcast, which no browser is allowed to send.
   */
  hello(): void {
    this.saidHello = true;
    this.sendHello();
  }

  private sendHello(): void {
    this.send({
      type: "hello",
      name: this.displayName,
      pubkey: toHex(this.identity.publicKey),
    });
  }

  createRoom(): void {
    this.pendingIntent = { action: "create" };
    this.sendCreate();
  }

  joinRoom(code: string): void {
    this.pendingIntent = { action: "join", code };
    this.sendJoin(code);
  }

  private sendCreate(): void {
    this.send({
      type: "create",
      name: this.displayName,
      pubkey: toHex(this.identity.publicKey),
    });
  }

  private sendJoin(code: string): void {
    this.send({
      type: "join",
      code,
      name: this.displayName,
      pubkey: toHex(this.identity.publicKey),
    });
  }

  setDisplayName(name: string): void {
    this.displayName = name;
  }

  /** Seals an envelope for one peer and hands the ciphertext to the relay. */
  async sendEnvelope(to: string, envelope: Envelope): Promise<void> {
    const shared = await this.sharedWith(to);
    this.send({
      type: "relay",
      to,
      payload: await sealEnvelope(envelope, shared),
    });
  }

  beginTransfer(to: string, cipherSize: number): void {
    this.send({ type: "transfer_begin", to, size: cipherSize });
  }

  endTransfer(to: string, transferId: string, status: string): void {
    this.send({ type: "transfer_end", to, transfer_id: transferId, status });
  }

  /** Shared secret with a peer, derived once and cached per session. */
  async sharedWith(peerId: string): Promise<Uint8Array> {
    const cached = this.sharedSecrets.get(peerId);
    if (cached) return cached;
    const peer = this.roster.get(peerId);
    if (!peer) throw new Error("that peer is no longer in the room");
    const shared = await deriveSharedSecret(
      this.identity.privateKey,
      fromHex(peer.pubkey),
    );
    this.sharedSecrets.set(peerId, shared);
    return shared;
  }

  private async handleFrame(raw: string): Promise<void> {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(raw) as ServerFrame;
    } catch {
      return;
    }

    switch (frame.type) {
      case "created":
        this.selfId = frame.peer_id ?? "";
        this.pendingIntent = { action: "join", code: frame.code };
        this.emit({
          type: "created",
          code: frame.code ?? "",
          peerId: this.selfId,
        });
        break;

      case "joined":
        this.selfId = frame.peer_id ?? "";
        this.emit({
          type: "joined",
          code: frame.code ?? "",
          peerId: this.selfId,
        });
        break;

      case "roster": {
        const peers = frame.peers ?? [];
        // A peer that rejoins gets a new id and a new ephemeral key, so
        // drop cached secrets for anyone no longer listed.
        const present = new Set(peers.map((p) => p.id));
        for (const id of [...this.sharedSecrets.keys()]) {
          if (!present.has(id)) this.sharedSecrets.delete(id);
        }
        this.roster = new Map(peers.map((p) => [p.id, p]));
        this.emit({ type: "roster", peers });
        break;
      }

      case "relay": {
        const from = frame.from ?? "";
        if (!frame.payload) return;
        try {
          const shared = await this.sharedWith(from);
          const envelope = await openEnvelope(frame.payload, shared);
          this.emit({ type: "envelope", from, envelope });
        } catch (err) {
          this.emit({
            type: "error",
            code: "decrypt_failed",
            message: `could not decrypt a message from a peer: ${describe(err)}`,
          });
        }
        break;
      }

      case "transfer_ready":
        this.emit({
          type: "transferReady",
          transferId: frame.transfer_id ?? "",
          token: frame.token ?? "",
          role: frame.role === "sender" ? "sender" : "receiver",
          peerId: frame.peer ?? "",
          size: frame.size ?? 0,
        });
        break;

      case "transfer_end":
        this.emit({
          type: "transferEnd",
          transferId: frame.transfer_id ?? "",
          status: frame.status ?? "",
          from: frame.from ?? "",
        });
        break;

      case "peer_left":
        this.emit({ type: "peerLeft", peerId: frame.peer_id ?? "" });
        break;

      case "error":
        this.emit({
          type: "error",
          code: frame.code_error ?? "unknown",
          message: frame.message ?? "the relay reported an error",
        });
        break;

      default:
        break;
    }
  }
}

export function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
