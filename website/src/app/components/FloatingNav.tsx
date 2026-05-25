import { useEffect, useState } from "react";
import { cn } from "./ui";
import { RepoStats } from "./RepoStats";

const links = [
  { label: "Features", href: "#features" },
  { label: "Install", href: "#install" },
  { label: "Commands", href: "#commands" },
  { label: "Security", href: "#security" },
];

export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_94%,transparent)]">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex h-16 min-w-0 items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 lg:px-0",
          scrolled && "h-14"
        )}
        style={{ maxWidth: "var(--shell)" }}
      >
        <a
          href="#top"
          className="flex min-w-0 items-center gap-3 rounded-[var(--radius-sm)] text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)] transition-colors hover:text-[var(--accent)]"
        >
          <Mark />
          <span className="font-[var(--font-display)]">Bonjou</span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="inline-flex h-9 items-center rounded-[var(--radius-sm)] px-3 font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-3">
          <RepoStats className="hidden lg:inline-flex" />
          <button
            onClick={() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" })}
            className={cn(
              "inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--accent)_80%,var(--paper))] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-contrast)]",
              "transition-colors hover:bg-[var(--accent-strong)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            )}
          >
            Install
          </button>
        </div>
      </nav>
    </header>
  );
}

function Mark() {
  return (
    <span
      aria-hidden
      className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)]"
    >
      <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--accent)]">
        <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-[var(--accent)] opacity-50" />
        <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--accent)] opacity-50" />
      </span>
    </span>
  );
}
