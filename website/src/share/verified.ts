import { useCallback, useState } from "react";

/**
 * Remembering that a fingerprint was read aloud and matched.
 *
 * Keyed by the peer's public key, never by name or peer id. That is the
 * whole point: the record is a statement about a key, so if a hostile
 * relay ever substitutes a different one, the confirmation silently stops
 * applying and the mark disappears rather than vouching for a stranger.
 *
 * This is the browser's small version of what the terminal client does
 * with its known-peers file. It is not a replacement for reading the
 * fingerprint; it only saves doing it twice.
 */

const KEY = "bonjou.verified.v1";

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function useVerified() {
  const [map, setMap] = useState<Record<string, number>>(read);

  const confirm = useCallback((pubkey: string) => {
    if (!pubkey) return;
    setMap((current) => {
      const next = { ...current, [pubkey]: Date.now() };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private browsing refuses storage. The mark lasts this session.
      }
      return next;
    });
  }, []);

  const isVerified = useCallback(
    (pubkey: string) => Boolean(pubkey && map[pubkey]),
    [map],
  );

  return { confirm, isVerified };
}
