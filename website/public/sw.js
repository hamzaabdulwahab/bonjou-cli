/**
 * Bonjou download helper.
 *
 * A receiver's bytes arrive from the relay as ciphertext. Fetching them
 * normally would save an encrypted file, and decrypting in the page would
 * mean holding the whole thing in memory — impossible at multi-gigabyte
 * sizes. Instead this worker intercepts the download URL, streams the
 * ciphertext through a decrypting transform, and returns a response the
 * browser writes straight to disk.
 *
 * Deliberately dependency-free and hand-written: it runs outside the
 * bundler, so it carries its own copy of the frame format rather than
 * importing from crypto.ts. The two must stay in step; the shape is
 * pinned by the Go vectors both are tested against.
 */

const STREAM_CHUNK_PLAIN_BYTES = 64 * 1024;
const STREAM_MAX_FRAME_BYTES = STREAM_CHUNK_PLAIN_BYTES + 1024;
const DOWNLOAD_PATH = /^\/dl\/([0-9a-f]{16})$/;

/** transferId -> pending download record, consumed exactly once. */
const pending = new Map();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  const port = event.ports && event.ports[0];
  if (!data || data.type !== "bonjou-prepare") return;

  try {
    if (!/^[0-9a-f]{16}$/.test(String(data.transferId))) {
      throw new Error("invalid transfer id");
    }
    pending.set(data.transferId, {
      url: data.url,
      filename: String(data.filename || "download"),
      plaintextSize: Number(data.plaintextSize) || 0,
      streamKeyHex: String(data.streamKeyHex || ""),
      createdAt: Date.now(),
    });
    reapStale();
    if (port) port.postMessage({ ok: true });
  } catch (err) {
    if (port) port.postMessage({ ok: false, error: String(err) });
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const match = DOWNLOAD_PATH.exec(url.pathname);
  if (!match) return;
  event.respondWith(handleDownload(match[1]));
});

async function handleDownload(transferId) {
  const record = pending.get(transferId);
  if (!record) {
    return new Response("this download link has already been used or expired", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }
  // One record, one download. A retry must go through the approval flow
  // again rather than silently re-opening a stream.
  pending.delete(transferId);

  let upstream;
  try {
    upstream = await fetch(record.url);
  } catch (err) {
    return new Response(`could not reach the relay: ${err}`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(`the relay refused the download (${upstream.status})`, {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(record.streamKeyHex),
    "AES-GCM",
    false,
    ["decrypt"],
  );

  const plaintext = upstream.body.pipeThrough(decryptingStream(key));

  return new Response(plaintext, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(record.plaintextSize),
      "Content-Disposition": contentDisposition(record.filename),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Parses the 4-byte-length-prefixed AEAD frames and emits plaintext.
 * Network chunks arrive at arbitrary boundaries, so partial frames are
 * carried over between calls.
 */
function decryptingStream(key) {
  let buffer = new Uint8Array(0);
  let counter = 0n;

  return new TransformStream({
    async transform(chunk, controller) {
      buffer = concat(buffer, chunk);

      for (;;) {
        if (buffer.length < 4) break;
        const frameLength = readUint32BE(buffer, 0);
        if (frameLength === 0) {
          controller.error(new Error("relay sent a zero-length frame"));
          return;
        }
        if (frameLength > STREAM_MAX_FRAME_BYTES) {
          controller.error(
            new Error(
              `rejecting chunk: frame size ${frameLength} exceeds max ${STREAM_MAX_FRAME_BYTES}`,
            ),
          );
          return;
        }
        if (buffer.length < 4 + frameLength) break;

        const frame = buffer.subarray(4, 4 + frameLength);
        let plain;
        try {
          plain = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: chunkNonce(counter), tagLength: 128 },
            key,
            frame,
          );
        } catch {
          // Authentication is per chunk, so tampering is caught here —
          // mid-transfer, before a single decrypted byte reaches disk.
          controller.error(
            new Error(`chunk ${counter} failed authentication; transfer aborted`),
          );
          return;
        }
        counter += 1n;
        controller.enqueue(new Uint8Array(plain));
        buffer = buffer.slice(4 + frameLength);
      }
    },

    flush(controller) {
      if (buffer.length > 0) {
        controller.error(
          new Error("transfer ended mid-frame; the file is incomplete"),
        );
      }
    },
  });
}

function chunkNonce(counter) {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x426f6e6a, false); // "Bonj"
  view.setBigUint64(4, counter, false);
  return out;
}

function readUint32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function concat(a, b) {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error("invalid key encoding");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Builds a Content-Disposition header. The plain filename is stripped of
 * quotes, path separators, and control characters so a hostile sender
 * cannot break out of the header or suggest a path; the RFC 5987 form
 * carries the real name for browsers that understand it.
 */
function contentDisposition(filename) {
  const safe =
    filename
      .replace(/[\r\n"\\]/g, "")
      .replace(/[/\\]/g, "_")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 200) || "download";
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Drops prepared downloads that were never started. */
function reapStale() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, record] of pending) {
    if (record.createdAt < cutoff) pending.delete(id);
  }
}
