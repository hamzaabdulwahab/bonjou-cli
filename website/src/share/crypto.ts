/**
 * Bonjou protocol v2, implemented for the browser.
 *
 * This is the second implementation of a wire format whose first
 * implementation is Go (internal/network). The two must agree byte for
 * byte, which is what `vectors/protocol-v2.json` and `crypto.test.ts`
 * exist to prove.
 *
 * Two details differ from the obvious approach and are worth stating
 * plainly, because both are silent-failure traps:
 *
 *  1. Go uses HKDF-Expand with no extract step (hkdf.Expand, salt nil).
 *     WebCrypto's HKDF always performs extract *and* expand, so
 *     `crypto.subtle.deriveBits({name:'HKDF'})` yields different keys and
 *     must not be used. Expand is implemented here directly over HMAC.
 *
 *  2. The stream key's HKDF info label concatenates the *raw* streamID
 *     bytes, not their hex text.
 */

import { x25519 } from "@noble/curves/ed25519.js";

export const SEALED_VERSION = 2;
export const AAD = "bonjou.v2";
export const ENVELOPE_INFO = "bonjou/v2/envelope";
export const MAC_INFO = "bonjou/v2/mac";
export const STREAM_INFO_PREFIX = "bonjou/v2/stream/";

/** Plaintext bytes per AEAD chunk, matching streamChunkPlainBytes. */
export const STREAM_CHUNK_PLAIN_BYTES = 64 * 1024;
/** Per-chunk wire overhead: 4-byte length header plus a 16-byte GCM tag. */
export const STREAM_CHUNK_OVERHEAD = 4 + 16;
/** Upper bound on one frame, mirroring streamMaxFrameBytes. */
export const STREAM_MAX_FRAME_BYTES = STREAM_CHUNK_PLAIN_BYTES + 1024;

const textEncoder = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex string");
    out[i] = byte;
  }
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * HKDF-Expand per RFC 5869 section 2.3, with the extract step skipped to
 * match Go's `hkdf.Expand`. See the note at the top of this file.
 */
export async function hkdfExpand(
  secret: Uint8Array,
  info: Uint8Array,
  length = 32,
): Promise<Uint8Array> {
  if (secret.length === 0) throw new Error("empty secret");
  if (length <= 0) throw new Error(`invalid length: ${length}`);

  const key = await crypto.subtle.importKey(
    "raw",
    secret as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const out = new Uint8Array(length);
  let previous = new Uint8Array(0);
  let written = 0;
  for (let counter = 1; written < length; counter++) {
    const input = concatBytes(previous, info, Uint8Array.of(counter));
    const block = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, input as BufferSource),
    );
    const take = Math.min(block.length, length - written);
    out.set(block.subarray(0, take), written);
    written += take;
    previous = block;
  }
  return out;
}

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generates an ephemeral session keypair. Unlike the CLI — which derives a
 * long-term key from ~/.bonjou/config.json — the web client throws its key
 * away when the tab closes, so a later compromise cannot decrypt a
 * transfer that already happened.
 */
export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/**
 * Derives the shared secret from an ECDH exchange. The raw X25519 output
 * is hashed with SHA-256 before use, matching crypto.go.
 */
export async function deriveSharedSecret(
  privateKey: Uint8Array,
  peerPublicKey: Uint8Array,
): Promise<Uint8Array> {
  const raw = x25519.getSharedSecret(privateKey, peerPublicKey);
  const hashed = await crypto.subtle.digest("SHA-256", raw as BufferSource);
  return new Uint8Array(hashed);
}

export function deriveEnvelopeKey(shared: Uint8Array): Promise<Uint8Array> {
  return hkdfExpand(shared, textEncoder.encode(ENVELOPE_INFO));
}

export function deriveMacKey(shared: Uint8Array): Promise<Uint8Array> {
  return hkdfExpand(shared, textEncoder.encode(MAC_INFO));
}

/** Note the raw streamID bytes in the info label, not its hex text. */
export function deriveStreamKey(
  shared: Uint8Array,
  streamId: Uint8Array,
): Promise<Uint8Array> {
  if (streamId.length === 0) throw new Error("streamID required");
  const info = concatBytes(textEncoder.encode(STREAM_INFO_PREFIX), streamId);
  return hkdfExpand(shared, info);
}

export function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * The envelope mirrors the Go struct in transfer.go. Field names are the
 * JSON tags; ordering is irrelevant because both sides parse rather than
 * compare bytes.
 */
export interface Envelope {
  kind: string;
  from: string;
  from_ip: string;
  to: string;
  name: string;
  size: number;
  actual_size?: number;
  ts: number;
  message: string;
  checksum: string;
  hmac: string;
  ack_kind?: string;
  ack_status?: string;
  request_id?: string;
  target_path?: string;
  stream_id?: string;
}

export interface SealedEnvelope {
  v: number;
  n: string;
  c: string;
}

export const ENVELOPE_KINDS = {
  message: "message",
  fileOffer: "file_offer",
  fileRequest: "file_request",
  fileReject: "file_reject",
  file: "file",
  ack: "ack",
  // Browser-only. Signalling for a direct connection rides the sealed
  // envelope, so the relay forwards offers and candidates it cannot read
  // and needs no knowledge of WebRTC at all. The Go CLI ignores these:
  // it discovers peers by UDP broadcast and already talks to them
  // directly, so it has nothing to negotiate.
  rtcOffer: "rtc_offer",
  rtcAnswer: "rtc_answer",
  rtcIce: "rtc_ice",
} as const;

/**
 * Seals an envelope. The wire-format version is bound as additional
 * authenticated data so a downgrade is rejected at decryption time rather
 * than silently accepted.
 */
export async function sealEnvelope(
  envelope: Envelope,
  shared: Uint8Array,
  nonceOverride?: Uint8Array,
): Promise<string> {
  const key = await importAesKey(await deriveEnvelopeKey(shared));
  const nonce = nonceOverride ?? crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(envelope));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce as BufferSource,
        additionalData: textEncoder.encode(AAD) as BufferSource,
        tagLength: 128,
      },
      key,
      plaintext as BufferSource,
    ),
  );
  const sealed: SealedEnvelope = {
    v: SEALED_VERSION,
    n: toHex(nonce),
    c: toBase64(ciphertext),
  };
  return JSON.stringify(sealed);
}

export async function openEnvelope(
  frame: string,
  shared: Uint8Array,
): Promise<Envelope> {
  const sealed = JSON.parse(frame) as SealedEnvelope;
  if (sealed.v !== SEALED_VERSION) {
    throw new Error(
      `unsupported envelope version: ${sealed.v} (need ${SEALED_VERSION})`,
    );
  }
  const key = await importAesKey(await deriveEnvelopeKey(shared));
  const nonce = fromHex(sealed.n);
  if (nonce.length !== 12) {
    throw new Error(`envelope nonce length = ${nonce.length}, want 12`);
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce as BufferSource,
      additionalData: textEncoder.encode(AAD) as BufferSource,
      tagLength: 128,
    },
    key,
    fromBase64(sealed.c) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as Envelope;
}

/**
 * Builds the 12-byte nonce for a stream chunk: a fixed 4-byte direction
 * prefix followed by a big-endian 8-byte counter. Nonces are never
 * transmitted; both sides count from zero, and the per-stream subkey is
 * what makes that safe.
 */
export function chunkNonce(counter: bigint): Uint8Array {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x426f6e6a, false); // "Bonj"
  view.setBigUint64(4, counter, false);
  return out;
}

/** Total ciphertext bytes a plaintext of `size` produces once framed. */
export function framedLength(size: number): number {
  if (size <= 0) return 0;
  const chunks = Math.ceil(size / STREAM_CHUNK_PLAIN_BYTES);
  return size + chunks * STREAM_CHUNK_OVERHEAD;
}

/**
 * Seals plaintext into the chunked-AEAD wire format, splitting anything
 * larger than one chunk. Stateful: the caller must feed a stream in order
 * and use one writer per transfer.
 */
export class ChunkedFrameWriter {
  private counter = 0n;

  constructor(private readonly key: CryptoKey) {}

  async seal(plaintext: Uint8Array): Promise<Uint8Array> {
    if (plaintext.length === 0) return new Uint8Array(0);
    const frames: Uint8Array[] = [];
    for (
      let offset = 0;
      offset < plaintext.length;
      offset += STREAM_CHUNK_PLAIN_BYTES
    ) {
      const chunk = plaintext.subarray(
        offset,
        Math.min(offset + STREAM_CHUNK_PLAIN_BYTES, plaintext.length),
      );
      const nonce = chunkNonce(this.counter);
      this.counter += 1n;
      const sealed = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
          this.key,
          chunk as BufferSource,
        ),
      );
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, sealed.length, false);
      frames.push(header, sealed);
    }
    return concatBytes(...frames);
  }
}

/**
 * The mirror of ChunkedFrameWriter, used by tests. The service worker
 * carries its own copy of this logic because it must run without the
 * bundler.
 */
export class ChunkedFrameReader {
  private counter = 0n;
  private buffer: Uint8Array = new Uint8Array(0);

  constructor(private readonly key: CryptoKey) {}

  async push(bytes: Uint8Array): Promise<Uint8Array> {
    this.buffer = concatBytes(this.buffer, bytes);
    const output: Uint8Array[] = [];
    for (;;) {
      if (this.buffer.length < 4) break;
      const view = new DataView(
        this.buffer.buffer,
        this.buffer.byteOffset,
        this.buffer.byteLength,
      );
      const frameLength = view.getUint32(0, false);
      if (frameLength === 0) throw new Error("zero-length frame");
      if (frameLength > STREAM_MAX_FRAME_BYTES) {
        throw new Error(
          `rejecting chunk: frame size ${frameLength} exceeds max ${STREAM_MAX_FRAME_BYTES}`,
        );
      }
      if (this.buffer.length < 4 + frameLength) break;

      const frame = this.buffer.subarray(4, 4 + frameLength);
      const nonce = chunkNonce(this.counter);
      let plain: ArrayBuffer;
      try {
        plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 },
          this.key,
          frame as BufferSource,
        );
      } catch {
        throw new Error(`chunk authentication failed (chunk ${this.counter})`);
      }
      this.counter += 1n;
      output.push(new Uint8Array(plain));
      this.buffer = this.buffer.slice(4 + frameLength);
    }
    return concatBytes(...output);
  }

  get pending(): number {
    return this.buffer.length;
  }
}

/**
 * A short fingerprint over both session public keys, for out-of-band
 * comparison. The relay hands each side the other's key, so a malicious
 * relay could substitute its own; reading eight bytes aloud is what
 * closes that gap until a PAKE replaces it. Format matches the CLI's
 * @fingerprint output.
 */
export async function sessionFingerprint(
  a: Uint8Array,
  b: Uint8Array,
): Promise<string> {
  const [first, second] =
    toHex(a) < toHex(b) ? [a, b] : ([b, a] as [Uint8Array, Uint8Array]);
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      concatBytes(first, second) as BufferSource,
    ),
  );
  return Array.from(digest.subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
}
