import { useEffect, useState } from "react";
import { cn } from "./ui";
import { RepoStats } from "./RepoStats";

const links = [
  { label: "Features", href: "#features" },
  { label: "Install", href: "#install" },
  { label: "Commands", href: "#commands" },
  { label: "Security", href: "#security" },
];

/**
 * Floating pill nav. Centered, 16px from the top.
 * On scroll past the hero, the pill shrinks slightly and gains opacity.
 */
export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-3 z-50 flex justify-center px-4 transition-[top] duration-300 sm:top-4"
      )}
    >
      <nav
        aria-label="Main"
        className={cn(
          "flex items-center gap-1 rounded-full border border-[var(--border-strong)]",
          "bg-[color-mix(in_oklab,var(--surface-1)_82%,transparent)] backdrop-blur-xl",
          "shadow-[0_8px_30px_-12px_oklch(0%_0_0/0.6),0_1px_0_oklch(100%_0_0/0.05)_inset]",
          "transition-all duration-300",
          scrolled ? "px-1.5 py-1.5 scale-[0.96]" : "px-2 py-2 scale-100"
        )}
      >
        <a
          href="#top"
          className="flex h-9 items-center gap-2 rounded-full px-3 text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <Dot />
          <span>Bonjou</span>
        </a>

        <div className="mx-1 hidden h-5 w-px bg-[var(--border)] md:block" />

        <ul className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="inline-flex h-9 items-center rounded-full px-3 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-1 flex items-center gap-2 pl-1 md:pl-2 md:border-l md:border-[var(--border)]">
          <RepoStats className="hidden md:inline-flex" />
          <button
            onClick={() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" })}
            className={cn(
              "inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-contrast)]",
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

function Dot() {
  return (
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[var(--accent)]" />
      <span
        className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-60"
        style={{ animationDuration: "2.6s" }}
      />
    </span>
  );
}
