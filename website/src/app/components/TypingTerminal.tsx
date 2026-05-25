import { useEffect, useRef, useState } from "react";
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

  // Progress is per-line index; visible up to current line in progress.
  const [visibleLineIdx, setVisibleLineIdx] = useState(reducedMotion ? lines.length : 0);
  // For the current prompt line being typed, how many chars are revealed.
  const [partial, setPartial] = useState<string>("");
  const [progressFrame, setProgressFrame] = useState<number>(reducedMotion ? PROGRESS_FRAMES.length - 1 : 0);
  const [cycle, setCycle] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) return undefined;
    cancelledRef.current = false;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    const run = async () => {
      // Reset on cycle change
      setVisibleLineIdx(0);
      setPartial("");
      setProgressFrame(0);

      for (let i = 0; i < lines.length; i += 1) {
        if (cancelledRef.current) return;
        const line = lines[i];

        if (line.kind === "prompt") {
          setVisibleLineIdx(i);
          // Type characters one at a time.
          for (let c = 1; c <= line.text.length; c += 1) {
            if (cancelledRef.current) return;
            setPartial(line.text.slice(0, c));
            // Vary pause: spaces faster, punctuation slower.
            const ch = line.text[c - 1];
            let delay = charDelay + Math.random() * 24;
            if (ch === " ") delay = Math.max(10, delay * 0.6);
            else if (ch === "@") delay *= 1.6;
            else if (ch === "/") delay *= 1.3;
            await sleep(delay);
          }
          setPartial(line.text); // make sure exact text is set
          setVisibleLineIdx(i + 1);
          await sleep(lineDelay);
        } else if (line.kind === "progress") {
          setVisibleLineIdx(i + 1);
          // Step through frames over ~1.2s
          for (let f = 0; f < PROGRESS_FRAMES.length; f += 1) {
            if (cancelledRef.current) return;
            setProgressFrame(f);
            await sleep(180 + Math.random() * 60);
          }
        } else {
          setVisibleLineIdx(i + 1);
          await sleep(lineDelay * 0.7);
        }
      }

      // Hold at the end
      await sleep(loopHoldMs);
      if (!cancelledRef.current) {
        setCycle((c) => c + 1);
      }
    };

    run();
    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [cycle, lines, charDelay, lineDelay, loopHoldMs, reducedMotion]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[oklch(10%_0.008_230)] text-[var(--text)]",
        "shadow-[0_40px_120px_-50px_oklch(0%_0_0/0.7),0_1px_0_oklch(100%_0_0/0.04)_inset]",
        className
      )}
    >
      {/* chrome */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[oklch(7%_0.008_230)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(40%_0.04_25)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(40%_0.04_75)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(40%_0.04_145)]" />
        </div>
        {title && (
          <div className="flex-1 text-center font-mono text-[11px] tracking-wide text-[var(--text-dim)]">
            {title}
          </div>
        )}
        <div className="h-2.5 w-12" />
      </div>

      {/* content */}
      <div className="overflow-x-auto px-6 py-5 font-mono text-[13.5px] leading-[1.85]">
        {lines.map((line, i) => {
          if (i >= visibleLineIdx + 1) return null;
          if (line.kind === "spacer") {
            return <div key={i} className="h-3" aria-hidden />;
          }

          if (line.kind === "prompt") {
            const isCurrent = i === visibleLineIdx;
            const text = isCurrent ? partial : line.text;
            return (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="text-[var(--text-dim)]">{line.prompt}</span>
                <span className="text-[var(--accent)]">$</span>
                <span className="text-[var(--text)]">
                  {text}
                  {isCurrent && <Caret />}
                </span>
              </div>
            );
          }

          const indent = "pl-[var(--prompt-indent,5.5rem)]";

          if (line.kind === "progress") {
            const isCurrent = i === visibleLineIdx - 1 && progressFrame < PROGRESS_FRAMES.length - 1;
            return (
              <div key={i} className={cn("text-[var(--text)]", indent)}>
                <span className={cn(isCurrent ? "text-[var(--text)]" : "text-[var(--accent)]")}>
                  {PROGRESS_FRAMES[progressFrame]}
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
            <div key={i} className={cn(indent, cls)}>
              {line.text}
            </div>
          );
        })}

        {/* trailing prompt with caret once the cycle has finished */}
        {visibleLineIdx >= lines.length && (
          <div className="mt-2 flex gap-2">
            <span className="text-[var(--text-dim)]">alex@studio</span>
            <span className="text-[var(--accent)]">$</span>
            <Caret />
          </div>
        )}
      </div>
    </div>
  );
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
