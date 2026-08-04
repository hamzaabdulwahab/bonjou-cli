import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import { IncomingRow, MessageRow, OutgoingRow } from "./EventRow";
import { formatBytes } from "./transfer";
import {
  EVERYONE,
  type IncomingItem,
  type OutgoingItem,
  type ThreadEvent,
} from "./useSession";

/** How close to the bottom still counts as "following the conversation". */
const PINNED_SLACK_PX = 48;

interface ThreadProps {
  threadId: string;
  title: string;
  subtitle: string;
  events: ThreadEvent[];
  received: IncomingItem[];
  labels: Record<string, string>;
  onApprove: (item: IncomingItem) => void;
  onDecline: (item: IncomingItem) => void;
}

/** Rows are events, except consecutive outgoing items of one fan-out. */
type Row =
  | { key: string; kind: "message"; event: Extract<ThreadEvent, { kind: "message" }> }
  | { key: string; kind: "incoming"; event: Extract<ThreadEvent, { kind: "incoming" }> }
  | { key: string; kind: "outgoing"; items: OutgoingItem[] };

export function Thread(props: ThreadProps) {
  const { threadId, title, subtitle, events, received, labels, onApprove, onDecline } =
    props;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const previousCount = useRef(0);
  const [adrift, setAdrift] = useState(false);
  const [missed, setMissed] = useState(0);

  const rows = useMemo<Row[]>(() => {
    const filtered =
      threadId === EVERYONE
        ? events
        : events.filter((event) => event.peerIds.includes(threadId));

    const out: Row[] = [];
    const groupIndex = new Map<string, number>();

    for (const event of filtered) {
      if (event.kind === "message") {
        out.push({ key: event.id, kind: "message", event });
        continue;
      }
      if (event.kind === "incoming") {
        out.push({ key: event.id, kind: "incoming", event });
        continue;
      }
      // Collapse a fan-out only where several recipients are visible.
      // Inside one person's thread the group is that person alone.
      const groupKey = event.item.groupId;
      const existing = groupIndex.get(groupKey);
      if (existing !== undefined) {
        const row = out[existing];
        if (row.kind === "outgoing") row.items.push(event.item);
        continue;
      }
      groupIndex.set(groupKey, out.length);
      out.push({ key: groupKey, kind: "outgoing", items: [event.item] });
    }
    return out;
  }, [events, threadId]);

  const visibleRows = threadId === "received" ? received.length : rows.length;

  const jumpToNewest = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    pinnedRef.current = true;
    setAdrift(false);
    setMissed(0);
  };

  // Opening a conversation starts at the newest, the way every messaging
  // client does. Layout effect so it happens before paint, with no jump.
  useLayoutEffect(() => {
    previousCount.current = visibleRows;
    jumpToNewest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Follow new activity while the reader is at the bottom. When they have
  // scrolled up, count what they missed instead of yanking them back:
  // losing your place mid-read is worse than a delayed autoscroll.
  useEffect(() => {
    const grew = visibleRows - previousCount.current;
    previousCount.current = visibleRows;
    if (grew <= 0) return;
    if (pinnedRef.current) jumpToNewest();
    else setMissed((count) => count + grew);
  }, [visibleRows]);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < PINNED_SLACK_PX;
    pinnedRef.current = atBottom;
    setAdrift(!atBottom);
    if (atBottom) setMissed(0);
  };

  const body =
    threadId === "received" ? (
      received.length === 0 ? (
        <p className="empty">
          Files you accept are listed here for this session. Your browser saves
          the file itself to its downloads folder.
        </p>
      ) : (
        <ul className="rows">
          {received.map((item) => (
            <li className="row row-in" key={item.requestId}>
              <div className="row-meta">
                <span className="row-who">{labels[item.from] ?? item.fromName}</span>
                <time dateTime={new Date(item.at).toISOString()}>
                  {new Date(item.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <div className="card">
                <div className="card-head">
                  <span className="card-name">{item.name}</span>
                  <span className="card-size">{formatBytes(item.size)}</span>
                </div>
                <span className="status is-done">Saved to your downloads</span>
              </div>
            </li>
          ))}
        </ul>
      )
    ) : rows.length === 0 ? (
      <p className="empty">
        No messages here yet. Anything you send goes only to
        {threadId === EVERYONE ? " everyone reachable" : ` ${title}`}.
      </p>
    ) : (
      <ul className="rows">
        {rows.map((row) => {
          if (row.kind === "message") {
            return (
              <MessageRow
                key={row.key}
                line={row.event.line}
                label={labels[row.event.peerIds[0]] ?? row.event.line.from}
              />
            );
          }
          if (row.kind === "incoming") {
            return (
              <IncomingRow
                key={row.key}
                item={row.event.item}
                label={labels[row.event.item.from] ?? row.event.item.fromName}
                onApprove={onApprove}
                onDecline={onDecline}
              />
            );
          }
          return <OutgoingRow key={row.key} items={row.items} labels={labels} />;
        })}
      </ul>
    );

  return (
    <section className="thread" aria-label={title}>
      <header className="thread-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      <div className="thread-scroll">
        <div className="thread-body" ref={scrollRef} onScroll={onScroll}>
          {body}
        </div>

        {adrift ? (
          <button
            type="button"
            className={missed > 0 ? "jump has-missed" : "jump"}
            onClick={() => jumpToNewest()}
            aria-label={
              missed > 0 ? `Jump to ${missed} new items` : "Jump to the newest"
            }
          >
            <ArrowDown size={15} strokeWidth={2.5} aria-hidden="true" />
            {missed > 0 ? <span>{missed}</span> : null}
          </button>
        ) : null}
      </div>
    </section>
  );
}
