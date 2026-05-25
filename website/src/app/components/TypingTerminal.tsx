import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./ui";

/**
 * Self-typing terminal that loops on a calm cadence.
 *
 * Lines are declared with semantic kinds (prompt, out, dim, success, ghost)
 * so the visual styling stays consistent with the rest of the UI. The terminal
 * types characters individually with realistic pause variance, holds when
 * complete, then restarts after a long pause.
 *
 * Respects prefers-reduced-motion by rendering all lines immediately.
 */

export type Line =
  | { kind: "prompt"; prompt: string; text: string }
  | { kind: "out"; text: string }
  | { kind: "dim"; text: string }
  | { kind: "success"; text: string }
  | { kind: "ghost"; text: string }
  | { kind: "progress"; complete?: boolean; text?: string }
  | { kind: "spacer" };

type Props = {
  title?: string;
  lines: Line[];
  /** ms between characters when typing prompt commands */
  charDelay?: number;
  /** ms between line completions */
  lineDelay?: number;
  /** ms to hold at end before restarting */
  loopHoldMs?: number;
  className?: string;
};

const PROGRESS_FRAMES = [
  "[█···················] 5%",
  "[████················] 20%",
  "[█████████···········] 45%",
  "[█████████████·······] 65%",
  "[█████████████████···] 85%",
  "[████████████████████] 100%",
];

export function TypingTerminal({
  title,
  lines,
  charDelay = 28,
  lineDelay = 240,
  loopHoldMs = 6500,
  className,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();

  const totalDuration = useMemo(
    () => lines.reduce((sum, line) => sum + lineDuration(line, charDelay, lineDelay), 0) + loopHoldMs,
    [lines, charDelay, lineDelay, loopHoldMs]
  );
  const [elapsed, setElapsed] = useState(reducedMotion ? totalDuration : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setElapsed(totalDuration);
      return undefined;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      setElapsed((now - startedAt) % totalDuration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, totalDuration]);

  const playback = reducedMotion
    ? { visibleLineIdx: lines.length, partial: "", progressFrame: PROGRESS_FRAMES.length - 1 }
    : getPlayback(elapsed, lines, charDelay, lineDelay);

  const terminalVars = {
    "--text": "oklch(96.5% 0.012 92)",
    "--text-muted": "oklch(76% 0.018 92)",
    "--text-dim": "oklch(59% 0.020 92)",
    "--accent": "oklch(70% 0.175 46)",
    "--ghost": "oklch(72% 0.095 250)",
    "--border": "oklch(26% 0.018 85)",
    "--border-strong": "oklch(36% 0.022 85)",
    "--surface-3": "oklch(32% 0.018 85)",
    "--danger": "oklch(65% 0.15 25)",
    "--warn": "oklch(80% 0.10 75)",
    "--approve": "oklch(66% 0.115 135)",
  } as CSSProperties;

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[oklch(12%_0.012_85)] text-[var(--text)]",
        "shadow-[0_36px_100px_-64px_oklch(0%_0_0/0.8),0_1px_0_oklch(96%_0.012_92/0.045)_inset]",
        className
      )}
      style={terminalVars}
    >
      {/* chrome */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[oklch(9.5%_0.010_85)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)] opacity-70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--warn)] opacity-70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--approve)] opacity-75" />
        </div>
        {title && (
          <div className="flex-1 text-center font-mono text-[11px] tracking-wide text-[var(--text-dim)]">
            {title}
          </div>
        )}
        <div className="h-2.5 w-12" />
      </div>

      {/* content */}
      <div className="min-w-0 overflow-hidden px-4 py-4 font-mono text-[12px] leading-[1.85] sm:px-6 sm:py-5 sm:text-[13.5px]">
        {lines.map((line, i) => {
          if (i >= playback.visibleLineIdx + 1) return null;
          if (line.kind === "spacer") {
            return <div key={i} className="h-3" aria-hidden />;
          }

          if (line.kind === "prompt") {
            const isCurrent = i === playback.visibleLineIdx;
            const text = isCurrent ? playback.partial : line.text;
            return (
              <div key={i} className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
                <span className="text-[var(--text-dim)]">{line.prompt}</span>
                <span className="text-[var(--accent)]">$</span>
                <span className="min-w-0 break-words text-[var(--text)]">
                  {text}
                  {isCurrent && <Caret />}
                </span>
              </div>
            );
          }

          const indent = "sm:pl-[var(--prompt-indent,5.5rem)]";

          if (line.kind === "progress") {
            const isCurrent = i === playback.visibleLineIdx - 1 && playback.progressFrame < PROGRESS_FRAMES.length - 1;
            return (
              <div key={i} className={cn("break-words text-[var(--text)]", indent)}>
                <span className={cn(isCurrent ? "text-[var(--text)]" : "text-[var(--accent)]")}>
                  {PROGRESS_FRAMES[playback.progressFrame]}
                </span>
              </div>
            );
          }

          const cls =
            line.kind === "dim"
              ? "text-[var(--text-dim)]"
              : line.kind === "success"
              ? "text-[var(--accent)]"
              : line.kind === "ghost"
              ? "text-[var(--ghost)]"
              : "text-[var(--text)]";

          return (
            <div key={i} className={cn("break-words", indent, cls)}>
              {line.text}
            </div>
          );
        })}

        {/* trailing prompt with caret once the cycle has finished */}
        {playback.visibleLineIdx >= lines.length && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            <span className="text-[var(--text-dim)]">alex@studio</span>
            <span className="text-[var(--accent)]">$</span>
            <Caret />
          </div>
        )}
      </div>
    </div>
  );
}

function lineDuration(line: Line, charDelay: number, lineDelay: number) {
  if (line.kind === "prompt") return Math.max(180, line.text.length * charDelay) + lineDelay;
  if (line.kind === "progress") return 1250;
  return lineDelay * 0.75;
}

function getPlayback(elapsed: number, lines: Line[], charDelay: number, lineDelay: number) {
  let remaining = elapsed;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const duration = lineDuration(line, charDelay, lineDelay);

    if (remaining <= duration) {
      if (line.kind === "prompt") {
        const typeDuration = Math.max(180, line.text.length * charDelay);
        if (remaining < typeDuration) {
          const count = Math.max(0, Math.min(line.text.length, Math.ceil((remaining / typeDuration) * line.text.length)));
          return {
            visibleLineIdx: i,
            partial: line.text.slice(0, count),
            progressFrame: PROGRESS_FRAMES.length - 1,
          };
        }
      }

      if (line.kind === "progress") {
        const frame = Math.max(
          0,
          Math.min(PROGRESS_FRAMES.length - 1, Math.floor((remaining / duration) * PROGRESS_FRAMES.length))
        );
        return { visibleLineIdx: i + 1, partial: "", progressFrame: frame };
      }

      return { visibleLineIdx: i + 1, partial: "", progressFrame: PROGRESS_FRAMES.length - 1 };
    }

    remaining -= duration;
  }

  return { visibleLineIdx: lines.length, partial: "", progressFrame: PROGRESS_FRAMES.length - 1 };
}

function Caret() {
  return (
    <span className="ml-[2px] inline-block h-[1.05em] w-[0.55em] translate-y-[0.18em] animate-pulse bg-[var(--accent)]" />
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
