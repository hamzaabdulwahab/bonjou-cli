import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Recognising this browser's own tabs.
 *
 * Every tab opens its own relay connection and generates its own keypair,
 * so the relay sees each one as a separate person and puts them all in the
 * same network room. That is correct from where the relay stands: it
 * groups by public address, and it cannot tell a second tab from a
 * colleague at the next desk. From where the user stands it is nonsense,
 * because their own name comes back two or three times and a broadcast to
 * "everyone" includes themselves.
 *
 * Deduplicating by address would be the wrong fix and a worse bug. An
 * office, a lecture hall, and a cafe all put many different people behind
 * one public address, and that case is the entire point of the product.
 * Same address does not mean same person; same browser does.
 *
 * A browser can answer that question by itself. BroadcastChannel is
 * scoped to an origin within a single browser profile, so tabs of one
 * browser can name their relay ids to each other and nobody else hears
 * it. Another browser, another profile, and a private window each get
 * their own channel and stay separate people, which is right: those are
 * genuinely separate sessions with separate keys.
 *
 * The relay learns nothing new. No identifier is added to the protocol
 * and no state is persisted, so this costs no privacy to fix.
 */
const CHANNEL = "bonjou.tabs";

type TabMessage =
  /** I exist, and this is the relay id I am using. */
  | { kind: "here"; peerId: string }
  /** Somebody just opened. Everyone say who you are. */
  | { kind: "who" }
  /** I am closing; forget this id. */
  | { kind: "gone"; peerId: string };

/**
 * The relay ids belonging to this browser's *other* tabs.
 *
 * `selfPeerId` is this tab's own id, which arrives from the relay after
 * the connection is established. Until it does there is nothing to
 * announce, and the set stays empty.
 */
export function useSiblingTabs(selfPeerId: string): Set<string> {
  const [siblings, setSiblings] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selfPeerId || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL);

    const announce = () => channel.postMessage({ kind: "here", peerId: selfPeerId } satisfies TabMessage);

    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;

      switch (message.kind) {
        case "who":
          // A tab just opened and does not know about this one yet.
          announce();
          break;
        case "here":
          if (message.peerId === selfPeerId) return;
          setSiblings((current) => {
            if (current.has(message.peerId)) return current;
            const next = new Set(current);
            next.add(message.peerId);
            return next;
          });
          break;
        case "gone":
          setSiblings((current) => {
            if (!current.has(message.peerId)) return current;
            const next = new Set(current);
            next.delete(message.peerId);
            return next;
          });
          break;
      }
    };

    // Ask who else is open, then answer the same question for anyone who
    // opens later. Both halves are needed: the first tab has nobody to
    // hear it, and the last tab has nobody left to ask.
    channel.postMessage({ kind: "who" } satisfies TabMessage);
    announce();

    // pagehide rather than unload: it is the one that fires on iOS Safari
    // and when a tab is put into the back/forward cache. Losing it is not
    // fatal, since the relay drops the peer from the roster anyway, but it
    // keeps the set from carrying an id that is already gone.
    const onLeave = () =>
      channel.postMessage({ kind: "gone", peerId: selfPeerId } satisfies TabMessage);
    window.addEventListener("pagehide", onLeave);

    return () => {
      onLeave();
      window.removeEventListener("pagehide", onLeave);
      channel.close();
      setSiblings(new Set());
    };
  }, [selfPeerId]);

  return siblings;
}

/* ------------------------------------------------------------------ */
/* One connection per browser                                          */
/* ------------------------------------------------------------------ */

/**
 * Which tab is allowed to be the session.
 *
 * Hiding your own tabs from your own roster fixes only your half of the
 * problem: everyone else still sees one of you per tab, and no amount of
 * client-side work fixes that, because from another machine your tabs are
 * unrelated public keys with nothing but a display name in common.
 * Grouping on the name alone would merge two different people who both
 * typed "sam", which is a real bug traded for a cosmetic one.
 *
 * So the duplication is prevented instead of repaired. One tab holds a
 * Web Lock and owns the connection; the others do not connect at all.
 * There is then exactly one of you on the relay and nothing anywhere
 * needs to deduplicate.
 *
 * Locks are released by the browser when a tab closes or crashes, so the
 * queued request in a waiting tab is what promotes it. No timeouts, no
 * heartbeats, and no way to end up with the lock held by a tab that is
 * no longer there.
 */
const LOCK = "bonjou.session";

export type SessionOwnership = "acquiring" | "owner" | "blocked";

export interface SessionOwner {
  state: SessionOwnership;
  /** Move the session into this tab, from whichever one holds it. */
  takeOver: () => void;
}

export function useSessionOwnership(): SessionOwner {
  const [state, setState] = useState<SessionOwnership>("acquiring");
  // Aborting this is how a waiting tab stops waiting: it is the request
  // sitting in the lock's queue, not the lock itself.
  const waitingRef = useRef<AbortController | null>(null);
  // Set while this tab wants the lock handed to it rather than queued for.
  const stealRef = useRef(false);
  // Resolving this returns from the callback holding the lock, which is
  // the only way to give it up voluntarily.
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Web Locks is the whole mechanism. Without it every tab connects, as
    // it always did, and useSiblingTabs still keeps a tab out of its own
    // roster. Degraded, not broken.
    if (!navigator.locks) {
      setState("owner");
      return;
    }

    let disposed = false;

    // Holding the lock means not returning from the callback, so this
    // promise stays pending for exactly as long as this tab is the
    // session.
    // Holding the lock means not returning from the callback, so this
    // promise stays pending for exactly as long as this tab is the
    // session. It has to be resolvable rather than permanently pending:
    // StrictMode mounts, tears down, and mounts again, and a first run
    // that could not let go would leave the second one queued behind a
    // dead effect and every tab reading "already open".
    const hold = (lock: Lock | null): Promise<void> => {
      if (!lock || disposed) return Promise.resolve();
      setState("owner");
      return new Promise<void>((resolve) => {
        releaseRef.current = resolve;
      });
    };

    const attempt = async (options: LockOptions) => {
      try {
        await navigator.locks.request(LOCK, options, hold);
      } catch {
        // Three ways to land here, all meaning the same thing: the wait
        // was aborted so this tab could steal instead, the lock was
        // stolen by another tab, or the page is going away.
      }
    };

    const run = async () => {
      // Ask without waiting first, purely to learn which case this is. A
      // granted lock means this tab is the session; a refusal means
      // another tab already is, and this one should say so rather than
      // sit blank while it queues.
      await attempt({ ifAvailable: true });

      while (!disposed) {
        setState("blocked");

        if (stealRef.current) {
          stealRef.current = false;
          // steal, not queue. Queued requests are granted in the order
          // they were made, so with three tabs open a request from the
          // tab somebody just clicked would be served after one that has
          // been waiting since it opened, and a different window would
          // come alive than the one they asked for.
          await attempt({ steal: true });
          continue;
        }

        const waiting = new AbortController();
        waitingRef.current = waiting;
        await attempt({ signal: waiting.signal });
        waitingRef.current = null;
      }
    };

    void run();

    return () => {
      disposed = true;
      waitingRef.current?.abort();
      waitingRef.current = null;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, []);

  const takeOver = useCallback(() => {
    stealRef.current = true;
    // Ends the queued request so the loop comes round and steals. If this
    // tab is not currently waiting, the flag alone is enough.
    waitingRef.current?.abort();
    waitingRef.current = null;
  }, []);

  return { state, takeOver };
}
