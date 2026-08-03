import { useEffect, useMemo, useRef } from "react";

import { IncomingRow, MessageRow, OutgoingRow } from "./EventRow";
import { formatBytes } from "./transfer";
import {
  EVERYONE,
  type IncomingItem,
  type OutgoingItem,
  type ThreadEvent,
} from "./useSession";

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

  // Follow new activity only when already at the bottom, so reading back
  // through history is not yanked away by an arriving message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  if (threadId === "received") {
    return (
      <section className="thread" aria-label="Received files">
        <header className="thread-head">
          <h2>Received</h2>
          <p>{subtitle}</p>
        </header>
        <div className="thread-body" ref={scrollRef}>
          {received.length === 0 ? (
            <p className="empty">
              Files you accept are listed here for this session. Your browser
              saves the file itself to its downloads folder.
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
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="thread" aria-label={title}>
      <header className="thread-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div
        className="thread-body"
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinnedRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {rows.length === 0 ? (
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
        )}
      </div>
    </section>
  );
}
