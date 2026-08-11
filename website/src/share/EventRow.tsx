import { useEffect, useRef, useState } from "react";

import { FileIcon } from "./FileIcon";
import { cipherSizeFor, formatBytes } from "./transfer";
import type {
  ChatLine,
  IncomingItem,
  OutgoingItem,
  TransferPath,
} from "./useSession";

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Which route the bytes took. A direct transfer runs at LAN speed and a
 * relayed one at the speed of a round trip to the relay, and that is
 * usually the entire explanation for why one send crawled, so it is shown
 * rather than left to be guessed at.
 */
function PathTag({ path }: { path?: TransferPath }) {
  if (!path) return null;
  return <span className={`path-tag is-${path}`}>{path}</span>;
}

/**
 * A folder arrives as one archive, and its file count is the only thing
 * that distinguishes it from somebody genuinely sending a .zip. The folder
 * opens while its bytes are actually moving.
 */
function PayloadIcon({
  name,
  folder,
  moving,
}: {
  name: string;
  folder: boolean;
  moving?: boolean;
}) {
  return (
    <span className="card-icon">
      <FileIcon name={name} folder={folder} open={moving} size={18} />
    </span>
  );
}

/**
 * Throughput and time remaining, measured rather than estimated from the
 * nominal link speed.
 *
 * Samples are held over a short window and the rate taken across the whole
 * window rather than between the last two frames: a data channel delivers
 * in bursts, and a two-frame rate swings between zero and absurd on the
 * same transfer. Anything under a second of history reports nothing at
 * all, because a number that wrong is worse than no number.
 */
const RATE_WINDOW_MS = 4000;
const RATE_MIN_MS = 900;

function useRate(bytes: number, active: boolean): { rate: number } | null {
  const samples = useRef<{ at: number; bytes: number }[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!active) {
      samples.current = [];
      return;
    }
    const now = Date.now();
    samples.current.push({ at: now, bytes });
    while (samples.current.length > 2 && now - samples.current[0].at > RATE_WINDOW_MS) {
      samples.current.shift();
    }
  }, [bytes, active]);

  // The rate goes stale between progress callbacks on a slow link, so it
  // is re-rendered on a timer while a transfer is running.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;
  const list = samples.current;
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const span = last.at - first.at;
  if (span < RATE_MIN_MS) return null;
  const rate = ((last.bytes - first.bytes) * 1000) / span;
  if (rate <= 0) return null;
  return { rate };
}

function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min left`;
}

/** "Sending 64% · 41 MB/s · 4 min left", with each part dropped if unknown. */
function liveDetail(
  head: string,
  sentBytes: number,
  totalBytes: number,
  active: boolean,
  measured: { rate: number } | null,
): string {
  const parts = [head];
  if (active && measured) {
    parts.push(formatRate(measured.rate));
    const left = totalBytes - sentBytes;
    if (left > 0) parts.push(formatEta(left / measured.rate));
  }
  return parts.join(" · ");
}

export function MessageRow({ line, label }: { line: ChatLine; label: string }) {
  return (
    <li className={line.outbound ? "row is-mine" : "row"}>
      <div className="row-meta">
        <span className="row-who">{line.outbound ? "You" : label}</span>
        <time dateTime={new Date(line.at).toISOString()}>{clock(line.at)}</time>
      </div>
      <p className="bubble">{line.text}</p>
    </li>
  );
}

export function IncomingRow({
  item,
  label,
  onApprove,
  onDecline,
}: {
  item: IncomingItem;
  label: string;
  onApprove: (item: IncomingItem) => void;
  onDecline: (item: IncomingItem) => void;
}) {
  const pending = item.state === "pending";
  const running = item.state === "receiving" || item.state === "approved";

  // Only the direct path reports bytes. A relayed download is streamed to
  // disk inside the service worker, so the honest bar there is an
  // indeterminate one rather than a percentage nobody measured.
  const tracked = typeof item.receivedBytes === "number";
  const fraction =
    item.state === "done"
      ? 1
      : tracked
        ? Math.min(1, item.receivedBytes! / Math.max(1, cipherSizeFor(item.size)))
        : 0;
  const plainReceived = fraction * item.size;
  const measured = useRate(plainReceived, running && tracked);

  const head = running && tracked ? `Downloading ${Math.round(fraction * 100)}%` : incomingLabel(item);

  return (
    <li className="row">
      <div className="row-meta">
        <span className="row-who">{label}</span>
        <time dateTime={new Date(item.at).toISOString()}>{clock(item.at)}</time>
      </div>

      <div className={`card is-${item.state}${pending ? " is-asking" : ""}`}>
        <div className="card-head">
          <PayloadIcon
            name={item.name}
            folder={Boolean(item.note)}
            moving={running}
          />
          <span className="card-name">{item.name}</span>
          <span className="card-size">{formatBytes(item.size)}</span>
        </div>

        <div
          className={running && !tracked ? "meter is-sweeping" : "meter"}
          role="progressbar"
          aria-label={`${item.name} transfer`}
          {...(running && !tracked
            ? {}
            : {
                "aria-valuenow": Math.round(fraction * 100),
                "aria-valuemin": 0,
                "aria-valuemax": 100,
              })}
        >
          <span className="meter-fill" style={{ transform: `scaleX(${fraction})` }} />
        </div>

        {pending ? (
          <div className="card-foot">
            <span className="card-state">
              {item.note ? `${item.note} · ` : ""}Nothing has downloaded yet
            </span>
            <span className="card-actions">
              <button type="button" className="btn-quiet" onClick={() => onDecline(item)}>
                Decline
              </button>
              <button type="button" className="btn-accent" onClick={() => onApprove(item)}>
                Approve
              </button>
            </span>
          </div>
        ) : item.state === "failed" ? (
          <div className="card-foot is-stacked">
            <p className="card-error">{item.error ?? "Transfer failed"}</p>
            <p className="card-note">
              Nothing was written to your disk. Ask them to send it again.
            </p>
          </div>
        ) : (
          <div className="card-foot">
            <span className="card-state">
              {liveDetail(head, plainReceived, item.size, running && tracked, measured)}
            </span>
            <PathTag path={item.path} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * One outgoing send. A broadcast arrives here as several items sharing a
 * group and collapses to a single row with a count, because three copies
 * of one filename tells the sender nothing useful.
 */
export function OutgoingRow({
  items,
  labels,
}: {
  items: OutgoingItem[];
  labels: Record<string, string>;
}) {
  const first = items[0];
  const done = items.filter((i) => i.state === "done").length;
  const failed = items.filter((i) => i.state === "failed" || i.state === "declined");
  const sending = items.filter((i) => i.state === "sending");

  const totalBytes = items.reduce((sum, i) => sum + i.size, 0);
  const sentBytes = items.reduce((sum, i) => sum + i.sentBytes, 0);
  const fraction = totalBytes > 0 ? sentBytes / totalBytes : 0;
  const state = summaryState(items);
  const measured = useRate(sentBytes, sending.length > 0);

  const to =
    items.length === 1
      ? (labels[first.peerId] ?? first.peerName)
      : `${items.length} people`;

  return (
    <li className="row is-mine">
      <div className="row-meta">
        <span className="row-who">To {to}</span>
        <time dateTime={new Date(first.at).toISOString()}>{clock(first.at)}</time>
      </div>

      <div className={`card is-${state}`}>
        <div className="card-head">
          <PayloadIcon
            name={first.label}
            folder={false}
            moving={sending.length > 0}
          />
          <span className="card-name">{first.label}</span>
          <span className="card-size">{formatBytes(first.size)}</span>
        </div>

        <div className="meter" aria-hidden="true">
          <span className="meter-fill" style={{ transform: `scaleX(${fraction})` }} />
        </div>

        <div className="card-foot">
          <span className="card-state">
            {liveDetail(
              outgoingLabel(items, done, sending.length, fraction),
              sentBytes,
              totalBytes,
              sending.length > 0,
              measured,
            )}
          </span>
          <PathTag path={sharedPath(items)} />
        </div>

        {failed.length > 0 && failed[0].error ? (
          <p className="card-error is-foot">{failed[0].error}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The route for a collapsed fan-out row, or nothing when the recipients
 * did not all take the same one. Claiming "direct" for a group where one
 * person fell back to the relay would be a small lie about a number people
 * are reading to explain a speed.
 */
function sharedPath(items: OutgoingItem[]): TransferPath | undefined {
  const paths = new Set(items.map((item) => item.path));
  if (paths.size !== 1) return undefined;
  return items[0].path;
}

function summaryState(items: OutgoingItem[]): string {
  if (items.some((i) => i.state === "sending")) return "sending";
  if (items.every((i) => i.state === "done")) return "done";
  if (items.some((i) => i.state === "failed")) return "failed";
  if (items.every((i) => i.state === "declined")) return "declined";
  return "offered";
}

/**
 * A fan-out is rarely in one state. Two people can have accepted while a
 * third has not answered, and reporting only the dominant state hides
 * that: "waiting for approval" is wrong once anybody has the file.
 */
function outgoingLabel(
  items: OutgoingItem[],
  done: number,
  sending: number,
  fraction: number,
): string {
  const total = items.length;

  if (total === 1) {
    switch (items[0].state) {
      case "offered":
        return "Waiting for approval";
      case "sending":
        return `Sending ${Math.round(fraction * 100)}%`;
      case "done":
        return "Sent";
      case "declined":
        return "Declined, nothing was sent";
      case "failed":
        return "Failed";
    }
  }

  if (done === total) return `Sent to all ${total}`;

  const count = (state: OutgoingItem["state"]) =>
    items.filter((i) => i.state === state).length;
  const waiting = count("offered");
  const declined = count("declined");
  const failed = count("failed");

  const parts: string[] = [];
  if (sending > 0) parts.push(`sending to ${sending}`);
  if (done > 0) parts.push(`sent to ${done}`);
  if (waiting > 0) parts.push(`${waiting} yet to approve`);
  if (declined > 0) parts.push(`${declined} declined`);
  if (failed > 0) parts.push(`${failed} failed`);

  const summary = parts.join(", ");
  return summary ? summary.charAt(0).toUpperCase() + summary.slice(1) : "Waiting for approval";
}

function incomingLabel(item: IncomingItem): string {
  switch (item.state) {
    case "approved":
      return "Starting";
    case "receiving":
      return "Downloading";
    case "done":
      return "Saved to your downloads";
    case "declined":
      return "Declined, nothing was sent";
    case "failed":
      return item.error ? `Failed: ${item.error}` : "Failed";
    default:
      return item.state;
  }
}
