/**
 * Direct browser-to-browser connections.
 *
 * Two devices on one Wi-Fi were sending their bytes to a relay in Mumbai
 * and back, roughly 1,500 km each way, while sitting inches apart. This
 * lets them talk across the router instead.
 *
 * Signalling rides the existing sealed control channel, so the relay
 * forwards offers and candidates it cannot read and needs no changes at
 * all. No TURN server is needed either: TURN exists to relay traffic when
 * a direct path fails, and there is already a relay for that, so a failed
 * negotiation simply falls back to the HTTP path.
 */

/** Public STUN only. The relay is the fallback, so TURN is unnecessary. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/**
 * Pause sending above this many buffered bytes. A file read from disk
 * outruns any network, and without a ceiling the channel's queue grows
 * until the tab dies.
 */
const HIGH_WATER = 4 * 1024 * 1024;
const LOW_WATER = 1 * 1024 * 1024;

export type RtcSignalKind = "rtc_offer" | "rtc_answer" | "rtc_ice";

export interface RtcSignal {
  kind: RtcSignalKind;
  /** JSON: an RTCSessionDescription for offer/answer, a candidate for ice. */
  payload: string;
}

export function isRtcSignalKind(kind: string): kind is RtcSignalKind {
  return kind === "rtc_offer" || kind === "rtc_answer" || kind === "rtc_ice";
}

export function rtcSupported(): boolean {
  return typeof RTCPeerConnection !== "undefined";
}

/**
 * One channel carries both control and payload, distinguished by a leading
 * byte. Two channels would avoid the prefix but give no ordering guarantee
 * between them, and "begin" arriving after its first data frame is exactly
 * the race worth designing out.
 */
const TAG_CONTROL = 0x01;
const TAG_DATA = 0x02;

/** Control messages. Payload frames are opaque sealed bytes. */
export type ChannelControl =
  | { t: "begin"; requestId: string; size: number }
  | { t: "ready"; requestId: string }
  | { t: "end"; requestId: string }
  | { t: "abort"; requestId: string; error: string };

export interface ChannelHandlers {
  onControl: (message: ChannelControl) => void | Promise<void>;
  onData: (bytes: Uint8Array) => void | Promise<void>;
}

type Send = (signal: RtcSignal) => void;

/**
 * One connection to one peer, following the perfect-negotiation pattern.
 *
 * Both sides may try to open a channel at the same moment. Rather than
 * coordinate, one side is designated polite and yields when offers
 * collide, so a simultaneous start resolves without another round trip.
 */
export class PeerLink {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private makingOffer = false;
  private ignoringOffer = false;
  private openWaiters: ((ok: boolean) => void)[] = [];
  private handlers: ChannelHandlers | null = null;
  private onClosed: (() => void) | null = null;
  private closed = false;
  /**
   * Inbound messages are handled in order through one chain. Handling is
   * asynchronous (the receiver awaits backpressure from the download), and
   * the frame counter in the AEAD stream is positional, so overlapping two
   * handlers would fail authentication rather than merely reorder.
   */
  private tail: Promise<void> = Promise.resolve();

  constructor(
    readonly peerId: string,
    private readonly polite: boolean,
    private readonly send: Send,
  ) {}

  get open(): boolean {
    return this.channel?.readyState === "open";
  }

  listen(handlers: ChannelHandlers): void {
    this.handlers = handlers;
  }

  onDisconnect(handler: () => void): void {
    this.onClosed = handler;
  }

  private ensure(): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.send({ kind: "rtc_ice", payload: JSON.stringify(candidate) });
      }
    };

    pc.onnegotiationneeded = () => {
      void (async () => {
        try {
          this.makingOffer = true;
          await pc.setLocalDescription();
          this.send({
            kind: "rtc_offer",
            payload: JSON.stringify(pc.localDescription),
          });
        } catch {
          // A failed negotiation is not fatal; the relay path remains.
        } finally {
          this.makingOffer = false;
        }
      })();
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        this.settle(false);
        this.onClosed?.();
      }
    };

    pc.ondatachannel = ({ channel }) => this.adopt(channel);
    return pc;
  }

  private adopt(channel: RTCDataChannel): void {
    // Only one channel is ever used. Replacing a live one would leave this
    // side sending on a channel the other side is not reading.
    if (this.channel) {
      channel.close();
      return;
    }
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATER;
    this.channel = channel;

    channel.onopen = () => this.settle(true);
    channel.onclose = () => {
      this.settle(false);
      this.onClosed?.();
    };
    channel.onerror = () => this.settle(false);
    channel.onmessage = (event) => {
      const data = event.data;
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0) return;
      const bytes = new Uint8Array(data);
      const tag = bytes[0];
      const body = bytes.subarray(1);
      this.tail = this.tail
        .then(() => {
          if (tag === TAG_CONTROL) {
            return this.handlers?.onControl(
              JSON.parse(new TextDecoder().decode(body)) as ChannelControl,
            );
          }
          if (tag === TAG_DATA) return this.handlers?.onData(body);
        })
        .catch(() => {
          // Handlers report their own failures onto the transfer they
          // belong to. Swallowing here only keeps the chain alive.
        });
    };
  }

  private settle(ok: boolean): void {
    const waiters = this.openWaiters;
    this.openWaiters = [];
    for (const resolve of waiters) resolve(ok);
  }

  /**
   * Starts negotiating. Safe to call repeatedly, and called on both sides:
   * the sender when it offers a file, the receiver when one arrives.
   *
   * Only the impolite side creates the channel. If both did, SCTP would
   * assign them different stream ids and there would be two channels, with
   * each side sending on one and listening on the other — a connection
   * that reports itself open and delivers nothing. Perfect negotiation
   * settles competing offers but not competing channels, so the tie is
   * broken here instead.
   */
  start(): void {
    if (this.closed) return;
    const pc = this.ensure();
    if (this.channel || this.polite) return;
    // Ordered, because the frame counter in the AEAD stream is positional:
    // a reordered frame fails authentication rather than sorting itself out.
    this.adopt(pc.createDataChannel("bonjou", { ordered: true }));
  }

  /** Resolves true once the channel is usable, false on timeout. */
  waitOpen(timeoutMs: number): Promise<boolean> {
    if (this.open) return Promise.resolve(true);
    if (this.closed) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.openWaiters.push((ok) => {
        clearTimeout(timer);
        resolve(ok);
      });
    });
  }

  async accept(signal: RtcSignal): Promise<void> {
    if (this.closed) return;
    const pc = this.ensure();

    if (signal.kind === "rtc_ice") {
      try {
        await pc.addIceCandidate(JSON.parse(signal.payload));
      } catch {
        // Candidates arriving for an offer we ignored are expected.
      }
      return;
    }

    const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
    const collision =
      description.type === "offer" &&
      (this.makingOffer || pc.signalingState !== "stable");

    // The impolite side keeps its own offer and drops the other's, so a
    // simultaneous start resolves without either end retrying.
    this.ignoringOffer = !this.polite && collision;
    if (this.ignoringOffer) return;

    await pc.setRemoteDescription(description);
    if (description.type === "offer") {
      await pc.setLocalDescription();
      this.send({ kind: "rtc_answer", payload: JSON.stringify(pc.localDescription) });
    }
  }

  private ready(): RTCDataChannel {
    const channel = this.channel;
    if (!channel || channel.readyState !== "open") {
      throw new Error("the direct connection closed");
    }
    return channel;
  }

  /** Control messages are small and never wait on backpressure. */
  sendControl(message: ChannelControl): void {
    const body = new TextEncoder().encode(JSON.stringify(message));
    const framed = new Uint8Array(body.length + 1);
    framed[0] = TAG_CONTROL;
    framed.set(body, 1);
    this.ready().send(framed);
  }

  /**
   * Sends one payload frame, waiting if the channel is already saturated.
   * The caller's read loop is throttled by this promise, which is what
   * keeps a fast disk from burying a slower link.
   */
  async sendData(bytes: Uint8Array): Promise<void> {
    const channel = this.ready();
    if (channel.bufferedAmount > HIGH_WATER) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          channel.removeEventListener("bufferedamountlow", onLow);
          channel.removeEventListener("close", onClose);
        };
        const onLow = () => {
          done();
          resolve();
        };
        const onClose = () => {
          done();
          reject(new Error("the direct connection closed mid-transfer"));
        };
        channel.addEventListener("bufferedamountlow", onLow);
        // Without this the wait never settles when the peer disappears
        // exactly while the buffer is full.
        channel.addEventListener("close", onClose);
        if (channel.readyState !== "open") onClose();
      });
    }
    const framed = new Uint8Array(bytes.length + 1);
    framed[0] = TAG_DATA;
    framed.set(bytes, 1);
    this.ready().send(framed);
  }

  close(): void {
    this.closed = true;
    this.settle(false);
    try {
      this.channel?.close();
      this.pc?.close();
    } catch {
      // Already torn down.
    }
    this.channel = null;
    this.pc = null;
  }
}

/** One link per peer, created on demand and dropped when a peer leaves. */
export class LinkRegistry {
  private links = new Map<string, PeerLink>();

  constructor(
    /**
     * Whether this side yields on an offer collision. Both ends must
     * disagree, so decide it by comparing session public keys: they are
     * known from the roster before any negotiation and are unique.
     */
    private readonly polite: (peerId: string) => boolean,
    private readonly send: (peerId: string, signal: RtcSignal) => void,
    /** Attaches handlers to a newly created link. */
    private readonly configure: (link: PeerLink) => void,
  ) {}

  get(peerId: string): PeerLink {
    let link = this.links.get(peerId);
    if (!link) {
      link = new PeerLink(peerId, this.polite(peerId), (signal) =>
        this.send(peerId, signal),
      );
      this.links.set(peerId, link);
      this.configure(link);
    }
    return link;
  }

  peek(peerId: string): PeerLink | undefined {
    return this.links.get(peerId);
  }

  drop(peerId: string): void {
    this.links.get(peerId)?.close();
    this.links.delete(peerId);
  }

  /** Drops links for peers no longer present, so a rejoin renegotiates. */
  retain(peerIds: string[]): void {
    const keep = new Set(peerIds);
    for (const id of [...this.links.keys()]) {
      if (!keep.has(id)) this.drop(id);
    }
  }

  closeAll(): void {
    for (const id of [...this.links.keys()]) this.drop(id);
  }
}
