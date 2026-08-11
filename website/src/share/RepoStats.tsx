import { useEffect, useState } from "react";
import { GitFork, Github, Star, Tag } from "lucide-react";

/**
 * Live repository figures, fetched from the public GitHub API.
 *
 * Real numbers only. PRODUCT.md rules out invented metrics, so if the
 * request fails this renders nothing at all rather than a placeholder
 * that looks like data. The last good response is cached so a revisit
 * paints immediately instead of flashing empty.
 */

const REPO = "hamzaabdulwahab/bonjou-cli";
const CACHE_KEY = "bonjou.repoStats.v2";
const CACHE_MS = 30 * 60 * 1000;

interface Stats {
  stars: number | null;
  forks: number | null;
  release: string | null;
  fetchedAt: number;
}

function readCache(): Stats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stats;
    return typeof parsed?.fetchedAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(stats: Stats): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
  } catch {
    // Private browsing refuses storage. Only the cache is lost.
  }
}

export function RepoStats({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(readCache);

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return;

    let cancelled = false;
    void (async () => {
      try {
        const [repo, release] = await Promise.all([
          fetch(`https://api.github.com/repos/${REPO}`).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch(`https://api.github.com/repos/${REPO}/releases/latest`).then((r) =>
            r.ok ? r.json() : null,
          ),
        ]);
        if (cancelled) return;
        const next: Stats = {
          stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : null,
          forks: typeof repo?.forks_count === "number" ? repo.forks_count : null,
          release: typeof release?.tag_name === "string" ? release.tag_name : null,
          fetchedAt: Date.now(),
        };
        setStats(next);
        writeCache(next);
      } catch {
        // Rate limited or offline. Whatever was cached stays; if there is
        // nothing cached, nothing is shown.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The masthead has room for one figure, not three. Stars is the one
  // people read, and it is dropped entirely rather than shown as a dash
  // when GitHub rate-limits the request.
  if (compact) {
    if (typeof stats?.stars !== "number") return null;
    return (
      <a
        className="repo-pill"
        href={`https://github.com/${REPO}`}
        aria-label={`${stats.stars} stars on GitHub`}
      >
        <Github size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>{compactCount(stats.stars)}</span>
      </a>
    );
  }

  const items = [
    stats?.release ? { icon: Tag, label: "Latest", value: stats.release } : null,
    typeof stats?.stars === "number"
      ? { icon: Star, label: "Stars", value: stats.stars.toLocaleString() }
      : null,
    typeof stats?.forks === "number"
      ? { icon: GitFork, label: "Forks", value: stats.forks.toLocaleString() }
      : null,
  ].filter(Boolean) as { icon: typeof Star; label: string; value: string }[];

  if (items.length === 0) return null;

  return (
    <a
      className="repo-stats"
      href={`https://github.com/${REPO}`}
      aria-label="Repository on GitHub"
    >
      {items.map(({ icon: Icon, label, value }) => (
        <span className="repo-stat" key={label}>
          <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="repo-stat-value">{value}</span>
          <span className="repo-stat-label">{label}</span>
        </span>
      ))}
    </a>
  );
}

function compactCount(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
