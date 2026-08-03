import { formatBytes } from "./transfer";
import type { ChatLine, IncomingItem, OutgoingItem } from "./useSession";

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageRow({ line, label }: { line: ChatLine; label: string }) {
  return (
    <li className={line.outbound ? "row row-out" : "row row-in"}>
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
  return (
    <li className={pending ? "row row-in row-ask" : "row row-in"}>
      <div className="row-meta">
        <span className="row-who">{label}</span>
        <time dateTime={new Date(item.at).toISOString()}>{clock(item.at)}</time>
      </div>
      <div className="card">
        <div className="card-head">
          <span className="card-name">{item.name}</span>
          <span className="card-size">{formatBytes(item.size)}</span>
        </div>
        {pending ? (
          <>
            <p className="card-note">
              Nothing has been downloaded yet. Approving starts the transfer.
            </p>
            <div className="card-actions">
              <button type="button" onClick={() => onApprove(item)}>
                Approve
              </button>
              <button type="button" className="ghost" onClick={() => onDecline(item)}>
                Decline
              </button>
            </div>
          </>
        ) : (
          <span className={`status is-${item.state}`}>{incomingLabel(item)}</span>
        )}
      </div>
    </li>
  );
}

/**
 * One outgoing send. A broadcast arrives here as several items sharing a
 * group, and collapses to a single row with a count, because three copies
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

  const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);
  const sentBytes = items.reduce((sum, i) => sum + i.sentBytes, 0);
  const fraction = totalBytes > 0 ? sentBytes / totalBytes : 0;

  const to =
    items.length === 1
      ? (labels[first.peerId] ?? first.peerName)
      : `${items.length} people`;

  return (
    <li className="row row-out">
      <div className="row-meta">
        <span className="row-who">To {to}</span>
        <time dateTime={new Date(first.at).toISOString()}>{clock(first.at)}</time>
      </div>
      <div className="card">
        <div className="card-head">
          <span className="card-name">{first.label}</span>
          <span className="card-size">{formatBytes(first.file.size)}</span>
        </div>
        <span className={`status is-${summaryState(items)}`}>
          {outgoingLabel(items, done, sending.length, fraction)}
        </span>
        {sending.length > 0 ? (
          <div className="meter">
            <span style={{ transform: `scaleX(${fraction})` }} />
          </div>
        ) : null}
        {failed.length > 0 && failed[0].error ? (
          <span className="status is-failed">{failed[0].error}</span>
        ) : null}
      </div>
    </li>
  );
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
        return "Declined";
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
      return "Declined";
    case "failed":
      return item.error ? `Failed: ${item.error}` : "Failed";
    default:
      return item.state;
  }
}
