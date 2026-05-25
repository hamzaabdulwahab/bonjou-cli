import { ReactNode, useEffect, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// FadeIn: restrained scroll choreography.
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
    transitionDuration: "620ms",
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transitionProperty: "opacity, transform",
    opacity: seen ? 1 : 0,
    transform: seen ? "translateY(0)" : "translateY(10px)",
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-semibold",
        "transition-[background-color,color,border-color,box-shadow,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4 text-[14px]",
        size === "lg" && "h-11 px-5 text-[14px]",
        variant === "primary" &&
          "border border-[color-mix(in_oklab,var(--accent)_80%,var(--paper))] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)] active:translate-y-px",
        variant === "secondary" &&
          "border border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]",
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
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1 font-mono text-[11px] tracking-[0.04em]",
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
        "inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]",
        className
      )}
    >
      <span aria-hidden className="h-px w-7 bg-[var(--accent)]" />
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
    <section id={id} className={cn("relative min-w-0", className)}>
      <div
        className={cn(bleed ? "" : "mx-auto min-w-0 px-4 sm:px-6 lg:px-0")}
        style={bleed ? undefined : { maxWidth: "var(--shell, min(1180px, calc(100vw - 32px)))" }}
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
// CopyCommand: copyable install command.
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
    await copyText(command);
    setCopied(true);
    setRipple((r) => r + 1);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "group relative inline-flex w-full max-w-full items-center justify-between gap-3 overflow-hidden rounded-[var(--radius-lg)]",
        "border border-[var(--border-strong)] bg-[var(--surface-1)]",
        "px-4 py-3 text-left transition-all duration-200 sm:px-5 sm:py-3.5",
        "hover:border-[var(--accent)] hover:bg-[var(--surface-2)]",
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
        <code className="min-w-0 truncate font-mono text-[12px] text-[var(--text)] sm:text-[13.5px]">{command}</code>
      </span>

      <span className="relative z-10 shrink-0">
        <span
          className={cn(
            "inline-flex h-7 w-[4.75rem] items-center justify-center rounded-[var(--radius-sm)] border font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-200",
            copied
              ? "border-[color-mix(in_oklab,var(--accent)_45%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-dim)] group-hover:text-[var(--text)]"
          )}
        >
          {copied ? "copied" : "copy"}
        </span>
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
    await copyText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3 transition-colors hover:border-[var(--border-strong)] sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="select-none font-mono text-[13px] text-[var(--accent)]">$</span>
        <code className="min-w-0 truncate font-mono text-[12px] text-[var(--text)] sm:text-[13px]">{command}</code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className={cn(
          "shrink-0 rounded-[var(--radius-sm)] border px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors",
          copied
            ? "border-[color-mix(in_oklab,var(--accent)_45%,var(--border))] bg-[var(--accent-soft)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-dim)] hover:text-[var(--text)]"
        )}
        aria-label={label ? `Copy ${label}` : "Copy command"}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
