/**
 * Data-plane mechanics: sealing a file into the chunked-AEAD wire format
 * and pushing it at the relay, and handing a receiver's decryption key to
 * the service worker that will stream the download to disk.
 */

import {
  ChunkedFrameWriter,
  STREAM_CHUNK_PLAIN_BYTES,
  concatBytes,
  framedLength,
  toHex,
} from "./crypto";

/**
 * Target size for one HTTP upload request. Large enough that per-request
 * overhead is noise on a multi-gigabyte transfer, small enough that
 * progress stays responsive and one request never pins much memory.
 *
 * Streaming a single request body would avoid the chunking entirely, but
 * `fetch` with a ReadableStream body is Chromium-only; the alternative on
 * Firefox and Safari reads the whole file into memory, which is fatal at
 * these sizes. Sequential requests are the one approach that works
 * everywhere.
 */
export const UPLOAD_CHUNK_TARGET_BYTES = 8 * 1024 * 1024;

export interface UploadOptions {
  relayBase: string;
  transferId: string;
  token: string;
  file: File;
  streamKey: CryptoKey;
  onProgress?: (plaintextBytesSent: number) => void;
  signal?: AbortSignal;
}

/**
 * Seals and uploads a file.
 *
 * Note there is no per-chunk retry. The relay fails a transfer on any
 * mid-copy error, because a chunk that partially reached the receiver
 * cannot be safely resent without corrupting the stream. Resumption needs
 * relay-side support and is deliberately left for later rather than
 * faked here.
 */
export async function uploadFile(options: UploadOptions): Promise<void> {
  const { relayBase, transferId, token, file, streamKey, onProgress, signal } =
    options;

  const writer = new ChunkedFrameWriter(streamKey);
  let sequence = 0;
  let plaintextSent = 0;
  let buffered: Uint8Array[] = [];
  let bufferedBytes = 0;

  const flush = async (): Promise<void> => {
    if (bufferedBytes === 0) return;
    const body = concatBytes(...buffered);
    buffered = [];
    bufferedBytes = 0;
    await postChunk(relayBase, transferId, token, sequence, body, signal);
    sequence += 1;
  };

  for (
    let offset = 0;
    offset < file.size;
    offset += STREAM_CHUNK_PLAIN_BYTES
  ) {
    signal?.throwIfAborted();
    const slice = file.slice(offset, offset + STREAM_CHUNK_PLAIN_BYTES);
    const plaintext = new Uint8Array(await slice.arrayBuffer());
    const framed = await writer.seal(plaintext);

    buffered.push(framed);
    bufferedBytes += framed.length;
    plaintextSent += plaintext.length;

    if (bufferedBytes >= UPLOAD_CHUNK_TARGET_BYTES) {
      await flush();
      onProgress?.(plaintextSent);
    }
  }

  await flush();
  onProgress?.(plaintextSent);
  await postEnd(relayBase, transferId, token, signal);
}

async function postChunk(
  relayBase: string,
  transferId: string,
  token: string,
  sequence: number,
  body: Uint8Array,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${relayBase}/t/${transferId}/${sequence}`, {
    method: "POST",
    headers: {
      "X-Bonjou-Token": token,
      "Content-Type": "application/octet-stream",
    },
    body: body as BodyInit,
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `relay rejected chunk ${sequence}: ${response.status} ${await safeText(response)}`,
    );
  }
}

async function postEnd(
  relayBase: string,
  transferId: string,
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${relayBase}/t/${transferId}/end`, {
    method: "POST",
    headers: { "X-Bonjou-Token": token },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `relay rejected transfer completion: ${response.status} ${await safeText(response)}`,
    );
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

export interface DownloadOptions {
  relayBase: string;
  transferId: string;
  token: string;
  filename: string;
  /** Decrypted size, so the browser can show real progress. */
  plaintextSize: number;
  streamKey: Uint8Array;
}

export function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!serviceWorkerSupported()) {
    throw new Error(
      "this browser cannot stream downloads to disk — service workers are unavailable",
    );
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/**
 * Hands the decryption key to the service worker, then navigates a hidden
 * iframe at the download URL. The worker intercepts that request, streams
 * ciphertext from the relay through a decrypting transform, and returns a
 * response the browser saves straight to disk — so a 10 GB file never
 * exists in memory.
 */
export async function startDownload(options: DownloadOptions): Promise<void> {
  const registration = await registerServiceWorker();
  const worker = registration.active;
  if (!worker) {
    throw new Error("the download helper is not ready yet — try again");
  }

  await requestFromWorker(worker, {
    type: "bonjou-prepare",
    transferId: options.transferId,
    url: `${options.relayBase}/t/${options.transferId}?token=${encodeURIComponent(options.token)}`,
    filename: options.filename,
    plaintextSize: options.plaintextSize,
    streamKeyHex: toHex(options.streamKey),
  });

  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = `/dl/${options.transferId}`;
  document.body.appendChild(frame);
  // The download detaches from the iframe once the browser takes over;
  // leaving it in the DOM only leaks a node.
  setTimeout(() => frame.remove(), 60_000);
}

function requestFromWorker(
  worker: ServiceWorker,
  message: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(
      () => reject(new Error("the download helper did not respond")),
      5000,
    );
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      const data = event.data as { ok?: boolean; error?: string };
      if (data?.ok) resolve();
      else reject(new Error(data?.error ?? "the download helper failed"));
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Ciphertext bytes a file of this size becomes once framed. */
export function cipherSizeFor(fileSize: number): number {
  return framedLength(fileSize);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
