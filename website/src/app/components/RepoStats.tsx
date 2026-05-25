import { useEffect, useState } from "react";
import { cn } from "./ui";

/**
 * Client-fetched GitHub stats rendered in the design system.
 *
 * Two pills: stars and latest release. LocalStorage caches the last good
 * response so revisits render instantly (no shimmer flash). One request,
 * unauthenticated public API, fails gracefully to cached or placeholder values.
 */

const REPO = "hamzaabdulwahab/bonjou-cli";
const STATS_KEY = "bonjou.repoStats.v1";
const CACHE_MS = 1000 * 60 * 30; // 30 min

type RepoData = {
  stars: number | null;
  release: string | null;
  fetchedAt: number;
};

function readCache(): RepoData | null {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed == null) return null;
    return parsed as RepoData;
  } catch {
    return null;
  }
}

function writeCache(data: RepoData) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function formatStars(n: number | null): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export function RepoStats({ className }: { className?: string }) {
  const cached = typeof window !== "undefined" ? readCache() : null;
  const [data, setData] = useState<RepoData | null>(cached);
  const [loaded, setLoaded] = useState<boolean>(!!cached);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const fresh = data && now - data.fetchedAt < CACHE_MS;
    if (fresh) return undefined;

    (async () => {
      try {
        const [repoRes, relRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${REPO}`, {
            headers: { Accept: "application/vnd.github+json" },
          }),
          fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { Accept: "application/vnd.github+json" },
          }),
        ]);
        if (cancelled) return;

        let stars: number | null = data?.stars ?? null;
        let release: string | null = data?.release ?? null;

        if (repoRes.ok) {
          const repo = await repoRes.json();
          if (typeof repo?.stargazers_count === "number") stars = repo.stargazers_count;
        }
        if (relRes.ok) {
          const rel = await relRes.json();
          if (typeof rel?.tag_name === "string") release = rel.tag_name;
        }

        const next: RepoData = { stars, release, fetchedAt: now };
        if (!cancelled) {
          setData(next);
          setLoaded(true);
          writeCache(next);
        }
      } catch {
        // Silent fail. Pills remain with last-known cached values or shimmer.
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <a
        href={`https://github.com/${REPO}/stargazers`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-2.5 font-mono text-[12px] transition-colors hover:border-[var(--border-strong)]"
        aria-label="Star Bonjou on GitHub"
      >
        <Star className="text-[var(--accent)]" />
        <span className={cn("tabular-nums", loaded ? "text-[var(--text)]" : "text-[var(--text-dim)]")}>
          {loaded ? formatStars(data?.stars ?? null) : <Shimmer w={20} />}
        </span>
      </a>
      <a
        href={`https://github.com/${REPO}/releases/latest`}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-2.5 font-mono text-[12px] transition-colors hover:border-[var(--border-strong)]"
        aria-label="Latest Bonjou release on GitHub"
      >
        <Tag className="text-[var(--text-dim)]" />
        <span className={cn("tabular-nums", loaded ? "text-[var(--text)]" : "text-[var(--text-dim)]")}>
          {loaded ? data?.release ?? "v1.2.0" : <Shimmer w={36} />}
        </span>
      </a>
    </div>
  );
}

function Shimmer({ w }: { w: number }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[10px] animate-pulse rounded bg-[var(--surface-2)]"
      style={{ width: w }}
    />
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2.5l2.97 6.02 6.65.97-4.81 4.69 1.14 6.62L12 17.77l-5.95 3.03 1.14-6.62-4.81-4.69 6.65-.97L12 2.5z" />
    </svg>
  );
}

function Tag({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
