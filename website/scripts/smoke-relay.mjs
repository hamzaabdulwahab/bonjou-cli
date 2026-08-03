/**
 * End-to-end smoke test against a running Bonjou relay.
 *
 * Drives two independent peers through the whole flow — room creation,
 * key exchange, the metadata-first offer/approve handshake, and a real
 * chunked upload and streaming download — then checks the bytes that came
 * out match the bytes that went in.
 *
 * The crypto here is written out longhand rather than imported from
 * crypto.ts, which makes it a genuinely independent third implementation:
 * if it agrees with both the browser and Go, the wire format is real.
 *
 *   node scripts/smoke-relay.mjs
 *   RELAY=https://... SIZE_MB=64 node scripts/smoke-relay.mjs
 */

import { x25519 } from "@noble/curves/ed25519.js";

const RELAY = (process.env.RELAY ?? "https://bonjou.80-225-228-65.sslip.io").replace(/\/$/, "");
const WS_URL = `${RELAY.replace(/^http/, "ws")}/ws`;
const SIZE_MB = Number(process.env.SIZE_MB ?? 12);
const PAYLOAD_BYTES = Math.round(SIZE_MB * 1024 * 1024);

const CHUNK = 64 * 1024;
const UPLOAD_TARGET = 8 * 1024 * 1024;
const AAD = new TextEncoder().encode("bonjou.v2");

const hex = (b) => Buffer.from(b).toString("hex");
const unhex = (s) => new Uint8Array(Buffer.from(s, "hex"));

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** HKDF-Expand only, matching Go's hkdf.Expand (no extract step). */
async function hkdfExpand(secret, info, length = 32) {
  const key = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const out = new Uint8Array(length);
  let previous = new Uint8Array(0);
  let written = 0;
  for (let counter = 1; written < length; counter++) {
    const block = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, concat(previous, info, Uint8Array.of(counter))),
    );
    const take = Math.min(block.length, length - written);
    out.set(block.subarray(0, take), written);
    written += take;
    previous = block;
  }
  return out;
}

async function sharedSecret(priv, peerPubHex) {
  const raw = x25519.getSharedSecret(priv, unhex(peerPubHex));
  return new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
}

function chunkNonce(counter) {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x426f6e6a, false);
  view.setBigUint64(4, counter, false);
  return out;
}

const enc = new TextEncoder();

async function sealEnvelope(envelope, shared) {
  const key = await crypto.subtle.importKey(
    "raw", await hkdfExpand(shared, enc.encode("bonjou/v2/envelope")), "AES-GCM", false, ["encrypt"],
  );
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: AAD, tagLength: 128 },
      key, enc.encode(JSON.stringify(envelope)),
    ),
  );
  return JSON.stringify({
    v: 2, n: hex(nonce), c: Buffer.from(ciphertext).toString("base64"),
  });
}

async function openEnvelope(frame, shared) {
  const sealed = JSON.parse(frame);
  if (sealed.v !== 2) throw new Error(`unsupported envelope version ${sealed.v}`);
  const key = await crypto.subtle.importKey(
    "raw", await hkdfExpand(shared, enc.encode("bonjou/v2/envelope")), "AES-GCM", false, ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unhex(sealed.n), additionalData: AAD, tagLength: 128 },
    key, new Uint8Array(Buffer.from(sealed.c, "base64")),
  );
  return JSON.parse(Buffer.from(plain).toString("utf8"));
}

function connect(name, keypair) {
  const socket = new WebSocket(WS_URL);
  const waiters = [];
  const backlog = [];

  socket.addEventListener("message", (event) => {
    const frame = JSON.parse(event.data);
    const index = waiters.findIndex((w) => w.match(frame));
    if (index >= 0) waiters.splice(index, 1)[0].resolve(frame);
    else backlog.push(frame);
  });

  const peer = {
    name,
    keypair,
    socket,
    selfId: "",
    send: (frame) => socket.send(JSON.stringify(frame)),
    expect(match, label, timeoutMs = 20000) {
      const index = backlog.findIndex(match);
      if (index >= 0) return Promise.resolve(backlog.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`${name}: timed out waiting for ${label}`)),
          timeoutMs,
        );
        waiters.push({
          match,
          resolve: (frame) => { clearTimeout(timer); resolve(frame); },
        });
      });
    },
  };

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(peer));
    socket.addEventListener("error", () => reject(new Error(`${name}: websocket failed`)));
  });
}

function keypair() {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`relay: ${RELAY}`);
  const health = await fetch(`${RELAY}/healthz`).then((r) => r.json());
  check("health endpoint responds", health.status === "ok", JSON.stringify(health));

  const alice = await connect("alice", keypair());
  const bob = await connect("bob", keypair());

  alice.send({ type: "create", name: "alice", pubkey: hex(alice.keypair.publicKey) });
  const created = await alice.expect((f) => f.type === "created", "created");
  alice.selfId = created.peer_id;
  check("room created", Boolean(created.code), created.code);

  bob.send({ type: "join", code: created.code, name: "bob", pubkey: hex(bob.keypair.publicKey) });
  const joined = await bob.expect((f) => f.type === "joined", "joined");
  bob.selfId = joined.peer_id;
  check("second peer joined", joined.code === created.code);

  const roster = await alice.expect(
    (f) => f.type === "roster" && f.peers.length === 2, "roster with two peers",
  );
  const bobEntry = roster.peers.find((p) => p.id === bob.selfId);
  check("roster carries the peer public key", bobEntry?.pubkey === hex(bob.keypair.publicKey));

  const aliceShared = await sharedSecret(alice.keypair.privateKey, hex(bob.keypair.publicKey));
  const bobShared = await sharedSecret(bob.keypair.privateKey, hex(alice.keypair.publicKey));
  check("both sides derive the same secret", hex(aliceShared) === hex(bobShared));

  // Metadata-first: the offer describes the file, and carries no payload.
  // getRandomValues caps at 64 KiB per call, so fill in blocks.
  const payload = new Uint8Array(PAYLOAD_BYTES);
  for (let offset = 0; offset < payload.length; offset += 65536) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65536, payload.length)));
  }
  const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)));
  const streamId = crypto.getRandomValues(new Uint8Array(16));
  const requestId = hex(crypto.getRandomValues(new Uint8Array(8)));

  alice.send({
    type: "relay",
    to: bob.selfId,
    payload: await sealEnvelope({
      kind: "file_offer", from: "alice", from_ip: "", to: "bob",
      name: "smoke-test.bin", size: payload.length,
      ts: Math.floor(Date.now() / 1000), message: "", checksum: "", hmac: "",
      request_id: requestId, stream_id: hex(streamId),
    }, aliceShared),
  });

  const offerFrame = await bob.expect((f) => f.type === "relay", "file offer");
  const offer = await openEnvelope(offerFrame.payload, bobShared);
  check("offer decrypts on the far side", offer.kind === "file_offer");
  check("offer carries only metadata", offer.name === "smoke-test.bin" && offer.size === payload.length);

  // Approve — the equivalent of the user clicking Approve.
  bob.send({
    type: "relay",
    to: alice.selfId,
    payload: await sealEnvelope({
      kind: "file_request", from: "bob", from_ip: "", to: "alice",
      name: offer.name, size: offer.size, ts: Math.floor(Date.now() / 1000),
      message: "", checksum: "", hmac: "", request_id: requestId,
    }, bobShared),
  });
  const approvalFrame = await alice.expect((f) => f.type === "relay", "approval");
  const approval = await openEnvelope(approvalFrame.payload, aliceShared);
  check("approval reaches the sender", approval.kind === "file_request");

  const chunks = Math.ceil(payload.length / CHUNK);
  const cipherSize = payload.length + chunks * 20;
  alice.send({ type: "transfer_begin", to: bob.selfId, size: cipherSize });

  const senderReady = await alice.expect((f) => f.type === "transfer_ready", "sender transfer_ready");
  const receiverReady = await bob.expect((f) => f.type === "transfer_ready", "receiver transfer_ready");
  check("both sides get the same transfer id", senderReady.transfer_id === receiverReady.transfer_id);
  check("tokens differ per role", senderReady.token !== receiverReady.token);
  check("relay echoes the declared size", senderReady.size === cipherSize);

  const streamKeyRaw = await hkdfExpand(
    aliceShared, concat(enc.encode("bonjou/v2/stream/"), streamId),
  );
  const encryptKey = await crypto.subtle.importKey("raw", streamKeyRaw, "AES-GCM", false, ["encrypt"]);
  const decryptKey = await crypto.subtle.importKey("raw", streamKeyRaw, "AES-GCM", false, ["decrypt"]);

  const started = Date.now();

  // Receiver attaches first, exactly as the service worker does.
  const downloadPromise = (async () => {
    const response = await fetch(`${RELAY}/t/${receiverReady.transfer_id}`, {
      headers: { "X-Bonjou-Token": receiverReady.token },
    });
    if (!response.ok) throw new Error(`download failed: ${response.status}`);
    check("download declares Content-Length", response.headers.get("content-length") === String(cipherSize));

    const received = [];
    let buffer = new Uint8Array(0);
    let counter = 0n;
    for await (const part of response.body) {
      buffer = concat(buffer, new Uint8Array(part));
      for (;;) {
        if (buffer.length < 4) break;
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const frameLength = view.getUint32(0, false);
        if (buffer.length < 4 + frameLength) break;
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: chunkNonce(counter), tagLength: 128 },
          decryptKey, buffer.subarray(4, 4 + frameLength),
        );
        counter += 1n;
        received.push(new Uint8Array(plain));
        buffer = buffer.slice(4 + frameLength);
      }
    }
    if (buffer.length !== 0) throw new Error("stream ended mid-frame");
    return concat(...received);
  })();

  // Sender uploads sequentially, as the browser does.
  let counter = 0n;
  let pending = [];
  let pendingBytes = 0;
  let sequence = 0;

  const flush = async () => {
    if (pendingBytes === 0) return;
    const body = concat(...pending);
    pending = [];
    pendingBytes = 0;
    const response = await fetch(`${RELAY}/t/${senderReady.transfer_id}/${sequence}`, {
      method: "POST",
      headers: { "X-Bonjou-Token": senderReady.token, "Content-Type": "application/octet-stream" },
      body,
    });
    if (!response.ok) throw new Error(`chunk ${sequence} rejected: ${response.status} ${await response.text()}`);
    sequence++;
  };

  for (let offset = 0; offset < payload.length; offset += CHUNK) {
    const slice = payload.subarray(offset, Math.min(offset + CHUNK, payload.length));
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: chunkNonce(counter), tagLength: 128 }, encryptKey, slice,
      ),
    );
    counter += 1n;
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, sealed.length, false);
    pending.push(header, sealed);
    pendingBytes += header.length + sealed.length;
    if (pendingBytes >= UPLOAD_TARGET) await flush();
  }
  await flush();

  const endResponse = await fetch(`${RELAY}/t/${senderReady.transfer_id}/end`, {
    method: "POST", headers: { "X-Bonjou-Token": senderReady.token },
  });
  check("relay accepts completion", endResponse.ok, `${endResponse.status}`);

  const roundTripped = await downloadPromise;
  const elapsed = (Date.now() - started) / 1000;

  check("received byte count matches", roundTripped.length === payload.length,
    `${roundTripped.length} vs ${payload.length}`);
  const receivedDigest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", roundTripped)));
  check("received bytes are identical", receivedDigest === digest);

  console.log(
    `\n  ${SIZE_MB} MB in ${elapsed.toFixed(2)}s ` +
    `(${(SIZE_MB / elapsed).toFixed(1)} MB/s, ${sequence} upload requests)`,
  );

  // A used transfer must not be re-openable.
  const replay = await fetch(`${RELAY}/t/${receiverReady.transfer_id}`, {
    headers: { "X-Bonjou-Token": receiverReady.token },
  });
  check("a finished transfer cannot be re-opened", !replay.ok, `${replay.status}`);
  await replay.body?.cancel();

  // A bad token must be refused.
  const forged = await fetch(`${RELAY}/t/${senderReady.transfer_id}`, {
    headers: { "X-Bonjou-Token": "0".repeat(32) },
  });
  check("a forged token is refused", forged.status === 403 || forged.status === 404, `${forged.status}`);
  await forged.body?.cancel();

  alice.socket.close();
  bob.socket.close();

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nsmoke test failed: ${err.stack ?? err}`);
  process.exit(1);
});
