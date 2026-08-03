# Bonjou Web — Relay Design

Date: 2026-08-03
Status: Approved for implementation

## Purpose

Bring Bonjou to the browser. The CLI is LAN-only by design: discovery uses UDP
broadcast on port 46320 and is explicitly restricted to the local subnet. A
browser can neither send UDP broadcasts nor listen on a TCP port, so the web
version cannot port discovery. It replaces the LAN with a relay running on an
always-on server.

The web version must:

- Move arbitrarily large files (multi-GB), which rules out any path through
  Vercel Functions (100 MB request body cap, 300 s timeout).
- Store nothing. Bytes stream through the relay and are never written to disk.
- Preserve metadata-first approval: no payload reaches the receiver's disk
  before the receiver explicitly approves the offer.
- Be wire-compatible with the CLI's protocol v2 envelope format, so that a
  future CLI-to-browser transfer is a feature rather than a rewrite.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | Live relay, nothing stored | Preserves the zero-storage security posture; no retention policy, cleanup crons, or abuse-storage liability |
| CLI interop | Wire-compatible now, interop later | Browser implements protocol v2; relay stays protocol-agnostic; interop becomes additive |
| Pairing | Short code / share link | No accounts, no stranger exposure; deliberate pairing matches the consent-first model |
| Hostname | `80-225-228-65.sslip.io` for now | Unblocks building; hostname is one config value to change |
| Data transport | HTTP chunked POST/GET, not WebSocket | Free backpressure via TCP; native browser download; works in all browsers |

## Infrastructure

Target server (verified 2026-08-03):

| | |
|---|---|
| Host | Oracle Cloud Ampere ARM64, Ubuntu 22.04 |
| Resources | 4 cores, 24 GB RAM (21 GB available), 121 GB free disk |
| Public IP | `80.225.228.65` |
| TLS | Certbot cert for `80-225-228-65.sslip.io` |
| Firewall | `iptables INPUT policy DROP`; only 22, 80, 443, 3002, mosh UDP open |
| Fronting | nginx active on 80/443, existing `claustra` vhost proxies to `127.0.0.1:8765` |
| Toolchain | Node v24; **no Go installed** |
| Existing tenants | mysql, docker (redis, postgres, open-webui), ollama, tailscale |

Consequences:

- The relay must listen on localhost and be exposed through nginx on 443.
  Opening a custom port requires editing both iptables and Oracle's cloud-level
  security list. Running over 443 also means the relay traverses corporate
  firewalls and captive networks that block everything else.
- `scripts/build.sh:13` already cross-compiles `linux/arm64`. The relay binary
  is built on a developer machine and copied to the server. No toolchain, no
  Docker, no build step on the box.
- 4 OCPU + 24 GB ARM is Oracle's Always Free A1 allotment, which includes
  10 TB/month egress. A pure relay spends bandwidth twice per transfer (in from
  sender, out to receiver), so 10 TB supports roughly 5 TB of user files per
  month at zero marginal cost. **This must be confirmed in the Oracle console**;
  a metered shape would change what the product can promise.
- ollama and open-webui are memory-hungry neighbours. The systemd unit sets
  `MemoryMax` so a runaway relay cannot OOM-kill them.

## Architecture

```
  ┌────────────────── VERCEL (static only) ──────────────────┐
  │  marketing page  ·  share app  ·  sw.js                  │
  └──────────────────────────────────────────────────────────┘
                              │  no bytes ever transit Vercel
     ┌────────────────────────┴────────────────────────┐
     ▼                                                 ▼
  CONTROL PLANE                                    DATA PLANE
  wss://…/ws                                       POST /t/{id}/{seq} ─┐
  rooms · roster · offer/approve                                       │ io.Copy
                                                   GET  /t/{id}      ◄─┘
     └────────────────── nginx :443 ──────────────────┘
                    ORACLE ARM · Go relay · systemd
```

Vercel serves static assets only. It never sees user data, so its function
limits are irrelevant to the design.

### Why HTTP for the data plane

Pushing file bytes through the WebSocket would require manual buffer management
and a hand-rolled backpressure protocol, and would leave the receiver holding a
multi-GB blob in memory. Plain HTTP avoids both:

- **Backpressure is free.** The relay's data path is `io.Copy` from the sender's
  request body to the receiver's response writer. A slow receiver closes its TCP
  window, which blocks the copy, which blocks the sender's POST. Kernel flow
  control does the work end to end. Memory per transfer is one 32 KB buffer.
- **The receiver gets a native download.** `GET /t/{id}` with `Content-Disposition`
  streams to disk with a native progress bar, no in-memory blob, no size ceiling.

Because payload bytes are ciphertext, a naive `GET` would save an encrypted
file. A Service Worker intercepts the request, pipes the response through a
decrypting `TransformStream`, and returns a normal `Response`; the browser saves
the decrypted stream natively. This is the approach Firefox Send used and it
works wherever Service Workers do — no dependency on Chromium-only
`showSaveFilePicker`.

### Why chunked POST rather than a streaming request body

Streaming a `fetch` request body (`ReadableStream` + `duplex: 'half'`) is
Chromium-only. Firefox and Safari would fall back to an `XHR` with a Blob, which
reads the whole file into memory — fatal at multi-GB sizes.

The sender therefore issues sequential `POST /t/{id}/{seq}` requests carrying
~8 MB of ciphertext each. One code path in every browser, plus three benefits:
accurate progress, per-chunk retry (a dropped chunk costs 8 MB rather than the
transfer), and backpressure still works because the relay's blocked write stalls
the POST. HTTP chunking is transport-level and independent of the 64 KiB AEAD
chunking in `internal/network/streams.go`, which remains the content framing.

### Two envelopes

The relay is a dumb pipe and needs none of the CLI's cryptography.

```
┌─ RELAY FRAME (plaintext — relay routes on this) ──────────┐
│  { to: "<peer-id>", type: join|roster|relay|… }           │
│                                                            │
│  payload: ┌─ BONJOU v2 sealedEnvelope {v,n,c} ──────────┐  │
│           │  AES-256-GCM, AAD="bonjou.v2" — OPAQUE      │  │
│           └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

The relay switches on `to` and `type` and forwards `payload` verbatim. It cannot
read offers, filenames, messages, or file bytes. "We could not read your files
if we wanted to" is a statement about the code, not a policy promise.

This keeps protocol v2 in exactly two implementations — Go (CLI) and WebCrypto
(browser) — and means the implementation does not touch `envelope`,
`sealedEnvelope`, `crypto.go`, or `known_peers.go`, the wire-protocol files
AGENTS.md flags for careful evaluation.

### Metadata the relay does observe

The relay must know that peer A is transferring to peer B in order to set up the
rendezvous, and it observes byte counts and timing. It does not observe
filenames, sizes declared in the offer, or content. This matches the CLI's
existing acknowledgement that traffic analysis is out of scope
(`docs/security-model.md:127`).

## Cryptography

The browser generates an **ephemeral X25519 keypair per session** rather than
deriving a long-term key from a config file. This gives the web version
**forward secrecy**, which `docs/security-model.md:37` identifies as the CLI's
largest gap. Compromise of a browser session cannot decrypt past transfers.

Key schedule, matching `internal/network/keys.go` exactly:

| Step | Operation |
|---|---|
| ECDH | X25519 between local private key and peer public key |
| Shared secret | `SHA-256(ECDH output)` — see `crypto.go:47` |
| Envelope key | HKDF-Expand(shared, `"bonjou/v2/envelope"`, 32) |
| Stream key | HKDF-Expand(shared, `"bonjou/v2/stream/" + streamID`, 32) |
| MAC key | HKDF-Expand(shared, `"bonjou/v2/mac"`, 32) |

**Critical implementation detail.** Go uses `hkdf.Expand` with no extract step
(`keys.go:64`, salt nil). WebCrypto's HKDF always performs extract *and* expand,
so `crypto.subtle.deriveBits({name:"HKDF"})` produces different output and must
not be used. The browser implements HKDF-Expand directly over HMAC-SHA256. For a
32-byte output with SHA-256 this is exactly one iteration:

```
key = HMAC-SHA256(shared, utf8(info) || 0x01)
```

Envelope sealing (`transfer.go:1750`): JSON-marshal the envelope, seal under
AES-256-GCM with a random 12-byte nonce and AAD `"bonjou.v2"`, then emit
`{"v":2,"n":<hex nonce>,"c":<base64 ciphertext||tag>}`.

Stream framing (`streams.go`): per 64 KiB plaintext chunk, emit a 4-byte
big-endian length of `ciphertext||tag`, then the sealed bytes. Nonces are not
transmitted; both sides derive them as
`BE_uint32(0x426F6E6A) || BE_uint64(counter)` starting at zero (`keys.go:79`).

X25519 is used via `@noble/curves` rather than WebCrypto. WebCrypto X25519 only
landed in Chrome 133, Firefox 132, and Safari 17, which is too recent to rely
on. AES-GCM and HMAC come from WebCrypto, which is universally supported.

### Known limitation

The relay distributes public keys, so a malicious relay could substitute its own
and mount a MITM. Mitigation for v1 is a **session fingerprint**: the first
8 bytes of `SHA-256` over both public keys sorted, rendered as colon-separated
hex, displayed on both screens for out-of-band comparison. This mirrors the
CLI's TOFU first-contact caveat and its existing fingerprint format
(`docs/security-model.md:151`).

A PAKE — SPAKE2 keyed by the room code, the Magic Wormhole approach — would
close this properly and is recorded as future work alongside the CLI's planned
Noise handshake.

## Components

### Relay: `cmd/bonjou-relay/main.go` + `internal/relay/`

| File | Responsibility |
|---|---|
| `room.go` | Registry: `map[string]*Room` under RWMutex, join/leave, roster broadcast, idle TTL sweep |
| `conn.go` | WebSocket lifecycle — read/write pumps, ping/pong keepalive, per-connection send queue |
| `rendezvous.go` | Data plane: pairs `POST /t/{id}/{seq}` with the open `GET /t/{id}`, ordered, `io.Copy` |
| `code.go` | Room code generation from `crypto/rand` |
| `limits.go` | Per-IP rate limits, room/peer/transfer caps, timeouts |

All state is in memory. Redis and postgres exist on the box and are
deliberately unused: a single relay instance with in-memory rooms is simpler,
faster, and has nothing to leak or clean up. A shared store earns its place only
if a second instance is ever needed.

One new dependency: `github.com/coder/websocket` — context-aware, stdlib-shaped,
no reflection.

Room codes draw from `crypto/rand` over a 27-character alphabet with vowels and
ambiguous glyphs (`0/O`, `1/I/L`) removed, so codes contain no accidental words
and survive being read aloud. Six characters formatted `7K2-9QX` gives ~387M
combinations; combined with per-IP rate limiting and a 30-minute TTL, brute-force
enumeration is impractical.

### Frontend: inside the existing `website/` Vite project

`react-router-dom` is added: `/` keeps the marketing page, `/r/:code` is the app.
No second frontend and no new deploy pipeline.

| Module | Responsibility |
|---|---|
| `share/crypto.ts` | X25519 ECDH, HKDF-Expand over HMAC, AES-256-GCM seal/open, chunk framing |
| `share/relay.ts` | WebSocket client, reconnect with backoff, roster state |
| `share/transfer.ts` | Offer/approve state machine, chunked uploader |
| `public/sw.js` | Service Worker: intercepts `/dl/{id}`, decrypts via `TransformStream`, returns a saveable `Response` |

## Protocol

### Control plane (JSON over WebSocket)

Client to server:

| Message | Fields |
|---|---|
| `create` | `name`, `pubkey` |
| `join` | `code`, `name`, `pubkey` |
| `relay` | `to`, `payload` (base64 sealed envelope, opaque) |
| `transfer_begin` | `to` |
| `transfer_end` | `transfer_id`, `status` |

Server to client:

| Message | Fields |
|---|---|
| `created` | `code`, `peer_id` |
| `joined` | `peer_id`, `code` |
| `roster` | `peers[]` of `{id, name, pubkey}` |
| `relay` | `from`, `payload` |
| `transfer_ready` | `transfer_id`, `token`, `role` |
| `peer_left` | `peer_id` |
| `error` | `code`, `message` |

### Data plane (HTTP)

| Route | Behaviour |
|---|---|
| `POST /t/{id}/{seq}` | Sender uploads one ciphertext chunk. Requires send token. Blocks until the relay has written it downstream. `204` on success |
| `POST /t/{id}/end` | Sender signals completion |
| `GET /t/{id}` | Receiver. Requires receive token. Streams chunks in order until end |

### Transfer lifecycle

```
Sender                     Relay                    Receiver
  │  create room ─────────►  │
  │  ◄──────── code 7K2-9QX  │
  │                          │  ◄───── join(7K2-9QX)
  │  ◄──── roster + pubkey ──┼──────── roster + pubkey ─►
  │                          │
  │  offer{name,size,hash} ──┼──────────────────────────►   ← E2E, metadata only
  │                          │                          ┌── user reviews
  │  ◄───────────────────────┼──────────── approve{id} ──┘   ← explicit consent
  │                          │
  │  transfer_begin ────────►│ mints id + tokens
  │  ◄── transfer_ready ─────┼──── transfer_ready ─────►
  │  POST /t/{id}/{seq} ────►│ ◄───────── GET /t/{id}
  │        ciphertext ═══════╪═══════════► SW decrypts ──► disk
  │                          │  io.Copy
  │  ◄───────────────────────┼─────────────── complete ──
```

The offer/approve handshake mirrors `kindFileOffer` → `kindFileRequest`
(`transfer.go:34-37`). Metadata-first approval is preserved: no byte reaches the
receiver's disk before approval.

## Error handling

| Failure | Handling |
|---|---|
| Peer drops mid-transfer | `io.Copy` errors; control message to the other side; Service Worker aborts the stream so the browser marks the download failed. No silent partial file |
| Relay restarts | All rooms lost by design. Clients observe WS close and prompt to rejoin. Nothing persisted, nothing to corrupt |
| Slow receiver | TCP flow control stalls the sender. No buffer to size |
| Sender abandons | GET idle timeout at 60 s without a chunk; both sides notified |
| No counterpart | POST/GET waits 30 s, then `408`. Room stays alive |
| GCM tag mismatch | Service Worker aborts immediately, mirroring `streams.go:137`. Tampering is caught mid-stream, before bytes reach disk |
| Room code collision | Regenerate, bounded retry |
| Abuse | Per-IP room-creation limit, max 8 peers per room, concurrent-transfer cap, 30 min idle TTL, size cap mirroring `max_incoming_bytes` |

### nginx configuration

`proxy_request_buffering off` is mandatory. Without it nginx buffers each entire
upload to disk before forwarding, converting a zero-storage relay into one that
writes every file to `/var/lib/nginx` and fills the disk. Required alongside it:
`client_max_body_size 0`, `proxy_buffering off`, `proxy_read_timeout 3600s`. The
existing `claustra` vhost already demonstrates three of the four.

## Testing

Standard library `testing` only, per AGENTS.md.

- `room_test.go` — registry lifecycle, TTL expiry, roster broadcast, code collision
- `rendezvous_test.go` — `httptest` pairing, chunk ordering, timeouts, disconnect mid-copy, backpressure
- `code_test.go` — alphabet constraints, `crypto/rand` usage, distribution

**Cross-language known-answer vectors are the highest-value test.** A Go test
emits a JSON fixture — shared secret, HKDF outputs, sealed envelope, chunked
stream frames — and a JS test asserts WebCrypto reproduces it byte for byte.
This is what makes wire compatibility a fact rather than an intention, and it
catches precisely the failures that are miserable to debug live: the
HKDF-Expand-without-extract difference, the nonce counter layout, and the 4-byte
big-endian framing.

Playwright drives a two-browser end-to-end transfer.

## Phases

Each phase ships independently and is demonstrable on its own.

1. **Relay skeleton** — WebSocket, rooms, codes, roster; systemd unit and nginx
   vhost. Proof: two browsers see each other.
2. **Data plane, plaintext** — chunked POST/GET rendezvous. Proof: a 5 GB file
   moves end to end.
3. **Crypto** — WebCrypto protocol v2, interop vectors, Service Worker streaming
   decrypt. Proof: vectors pass and the file arrives decrypted.
4. **Consent UX** — offer/approve mirroring the CLI. Proof: nothing writes
   without approval.
5. **Hardening** — limits, session fingerprint, QR codes, resume.

Phases 1 and 2 carry no cryptographic risk, so a 5 GB transfer works over the
public internet before any crypto primitive is touched. All the care
concentrates in phase 3, tested against vectors.

## AGENTS.md amendments required

This design breaks three stated rules and they must be updated:

- `cmd/bonjou-relay/` introduces a second binary; the current rule states all Go
  code lives in `cmd/bonjou/main.go` and `internal/`.
- `github.com/coder/websocket` is the first non-Charm runtime dependency.
- `internal/relay` types need receiver names recorded in the conventions list.

It does not breach the rule that matters most: the relay never touches
`envelope`, `sealedEnvelope`, `crypto.go`, or `known_peers.go`.

## Implementation notes

Recorded after the build, where reality differed from the design above.

**Deployed at** `https://bonjou.80-225-228-65.sslip.io`. sslip.io resolves any
`<label>.<ip-with-dashes>.sslip.io`, so the relay took its own hostname with its
own Certbot certificate rather than sharing the existing `claustra` vhost. That
vhost was left untouched.

**The download declares Content-Length.** `transfer_begin` carries the total
ciphertext size, which the relay puts on the `GET` response. This gives the
browser native progress and, more importantly, makes a truncated transfer a
*failed* download rather than a silently short file. It leaks nothing: the relay
already learns the byte count by counting bytes.

**Chunk length is validated before any copy.** Because Content-Length is fixed
when the transfer begins, writing past it would be rejected by net/http
mid-copy — after the excess had already reached the receiver. `ServeUpload`
therefore checks `written + ContentLength <= size` up front and refuses the
chunk, and requires a Content-Length (411 otherwise).

**No per-chunk retry.** The design named resumability as a benefit of chunked
uploads. It is not implemented and the mechanism does not currently allow it:
the relay fails a transfer on any mid-copy error, so a chunk that partially
reached the receiver cannot be safely resent. Resumption needs relay-side
support and is future work. Chunking still buys accurate progress and bounded
memory.

**Checksums are empty.** The offer envelope's `checksum` field is sent blank.
Per-chunk AEAD authenticates every byte in flight, so a whole-file SHA-256 would
add nothing while forcing a full read of a multi-gigabyte file before the
transfer could start.

**Origins are currently `*`.** The relay accepts any browser origin because the
production frontend URL is not yet known. This should be narrowed to the real
origin once the site is deployed — it is what stops a hostile page from creating
rooms in a visitor's browser.

**Verified in production.** A 48 MB end-to-end transfer round-tripped
byte-identical (`website/scripts/smoke-relay.mjs`). Relay memory held at
2.5–2.6 MB throughout and nginx's spool directories stayed empty, confirming
that neither the relay nor nginx buffers payloads.

## Out of scope

- Offline or store-and-forward delivery. Both parties must be online
  simultaneously; this is inherent to storing nothing and is a deliberate
  tradeoff, not a missing feature.
- CLI-to-browser transfer. The wire format makes it additive; it is not built here.
- WebRTC peer-to-peer. Viable as a later fast path with relay fallback.
- Accounts, history, and persistence of any kind.
