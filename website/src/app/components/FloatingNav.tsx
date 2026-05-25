import { useEffect, useState } from "react";
import { cn } from "./ui";

const links = [
  { label: "Product", href: "#product" },
  { label: "Use cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
  { label: "Install", href: "#install" },
];

export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 44);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow] duration-300",
        scrolled
          ? "border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] shadow-[0_12px_32px_-24px_oklch(16%_0.037_255/0.35)] backdrop-blur-xl"
          : "border-transparent bg-transparent"
      )}
    >
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex h-20 min-w-0 items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 lg:px-0",
          scrolled && "h-16"
        )}
        style={{ maxWidth: "var(--shell)" }}
      >
        <a
          href="#top"
          className="min-w-0 rounded-[var(--radius-sm)] font-[var(--font-display)] text-[18px] font-bold tracking-[-0.04em] text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          aria-label="Bonjou home"
        >
          Bonjou
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                className="inline-flex h-9 items-center rounded-[var(--radius-sm)] px-3 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" })}
          className={cn(
            "inline-flex h-10 shrink-0 items-center rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--accent-contrast)]",
            "shadow-[0_10px_22px_-16px_var(--accent)] transition-[background-color,border-color,transform] hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] active:translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          )}
        >
          Install
        </button>
      </nav>
    </header>
  );
}
