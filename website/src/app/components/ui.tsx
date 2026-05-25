import { ReactNode, useEffect, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// FadeIn — base scroll choreography
// 12-16px fade-up on enter view, ease-out, 60ms stagger via `delay`.
// ---------------------------------------------------------------------------
export function FadeIn({
  children,
  delay = 0,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const style: React.CSSProperties = {
    transitionDelay: `${delay}ms`,
    transitionDuration: "700ms",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transitionProperty: "opacity, transform",
    opacity: seen ? 1 : 0,
    transform: seen ? "translateY(0)" : "translateY(14px)",
    willChange: "opacity, transform",
  };

  const Tag = As as React.ElementType;
  return (
    <Tag ref={ref as React.Ref<HTMLElement>} className={className} style={style}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium",
        "transition-[background-color,color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-[14px]",
        variant === "primary" &&
          "bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)] active:translate-y-px",
        variant === "secondary" &&
          "border border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text)] hover:bg-[var(--surface-2)]",
        variant === "ghost" &&
          "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-1)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pills & labels
// ---------------------------------------------------------------------------
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.04em]",
        tone === "neutral" &&
          "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)]",
        tone === "accent" &&
          "border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[var(--accent-soft)] text-[var(--accent)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--text-dim)]",
        className
      )}
    >
      <span aria-hidden className="h-px w-6 bg-[var(--border-strong)]" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------
export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section id={id} className={cn("relative", className)}>
      <div
        className={cn(bleed ? "" : "mx-auto px-6 md:px-10")}
        style={bleed ? undefined : { maxWidth: "var(--shell, min(1080px, 100vw - 96px))" }}
      >
        {children}
      </div>
    </section>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[var(--border)]", className)} />;
}

// ---------------------------------------------------------------------------
// CopyCommand — hero install command, hover-scale, click-to-copy with ripple
// ---------------------------------------------------------------------------
export function CopyCommand({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [ripple, setRipple] = useState(0);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setRipple((r) => r + 1);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "group relative inline-flex w-full max-w-full items-center justify-between gap-4 overflow-hidden rounded-full",
        "border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-1)_70%,transparent)] backdrop-blur",
        "px-5 py-3.5 text-left transition-all duration-200",
        "hover:border-[var(--border-strong)] hover:bg-[var(--surface-1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        className
      )}
      aria-label={`Copy install command: ${command}`}
    >
      {/* ripple */}
      <span
        key={ripple}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-[var(--accent-soft)]",
          ripple > 0 && "animate-[ripple_900ms_ease-out_forwards]"
        )}
      />

      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="font-mono text-[14px] font-medium text-[var(--accent)]">
          $
        </span>
        <code className="truncate font-mono text-[13.5px] text-[var(--text)]">{command}</code>
      </span>

      <span className="relative flex shrink-0 items-center gap-2 text-[12px] font-mono">
        <span
          className={cn(
            "transition-opacity duration-200",
            copied ? "opacity-0" : "opacity-100 text-[var(--text-dim)] group-hover:text-[var(--text-muted)]"
          )}
        >
          copy
        </span>
        <span
          className={cn(
            "absolute right-0 transition-opacity duration-200",
            copied ? "opacity-100 text-[var(--accent)]" : "opacity-0"
          )}
        >
          copied
        </span>
        <CopyIcon className={cn("text-[var(--text-dim)] transition-colors group-hover:text-[var(--text)]")} />
      </span>

      <style>{`@keyframes ripple {
        0% { opacity: 0.6; transform: scale(0.96); }
        50% { opacity: 0.35; transform: scale(1); }
        100% { opacity: 0; transform: scale(1); }
      }`}</style>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline command (used inside install section rows)
// ---------------------------------------------------------------------------
export function InlineCommand({
  command,
  label,
}: {
  command: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="select-none font-mono text-[13px] text-[var(--accent)]">$</span>
        <code className="truncate font-mono text-[13px] text-[var(--text)]">{command}</code>
      </div>
      <button
        onClick={onCopy}
        className={cn(
          "shrink-0 rounded-md p-1.5 transition-all",
          "text-[var(--text-dim)] opacity-0 hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100",
          copied && "opacity-100 text-[var(--accent)]"
        )}
        aria-label={label ? `Copy ${label}` : "Copy command"}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
