import { useEffect, useRef, useState } from "react";
import { cn } from "./ui";

/**
 * Animated security flow diagram.
 *
 * Five stages, separated by hairline tracks. A small phosphor "packet" pip
 * traces the tracks left-to-right, briefly highlighting each stage as it
 * arrives. Loops while in view; pauses when out of view; freezes on
 * prefers-reduced-motion (final state).
 */

const STAGES = [
  { tag: "udp:46320", label: "Discovery" },
  { tag: "subnet", label: "Peer list" },
  { tag: "tcp:46321", label: "Sealed envelope" },
  { tag: "local", label: "Approval queue" },
  { tag: "disk", label: "~/.bonjou/received" },
];

const CYCLE_MS = 7500;

export function SecurityFlow({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [inView, setInView] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0.2 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setT(1);
      return undefined;
    }
    if (!inView) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return undefined;
    }
    let startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - startedAt) % CYCLE_MS;
      setT(elapsed / CYCLE_MS);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [inView]);

  // Per-stage active emphasis. Each stage occupies a slot 1/STAGES.length wide.
  const activeStage = Math.min(STAGES.length - 1, Math.floor(t * STAGES.length));
  const stagePhase = (t * STAGES.length) - activeStage; // 0..1 inside current stage

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-6 md:p-8",
        className
      )}
    >
      {/* track */}
      <div className="relative pt-6 pb-2">
        {/* base hairline track */}
        <div className="absolute left-0 right-0 top-[58px] h-px bg-[var(--border-strong)]" aria-hidden />

        {/* active progress track (phosphor) overlays the base */}
        <div
          aria-hidden
          className="absolute left-0 top-[58px] h-px bg-[var(--accent)] transition-[width] duration-100"
          style={{ width: `${Math.min(100, t * 100)}%` }}
        />

        {/* stages */}
        <div className="relative grid grid-cols-2 gap-y-8 sm:grid-cols-3 md:grid-cols-5 md:gap-y-0">
          {STAGES.map((s, i) => {
            const isActive = i === activeStage;
            const emph = isActive ? Math.sin(Math.PI * stagePhase) : 0;
            const isPast = i < activeStage;
            return (
              <div key={s.tag} className="flex flex-col items-center gap-2 md:items-start">
                <div
                  aria-hidden
                  className={cn(
                    "font-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors duration-200",
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"
                  )}
                >
                  {s.tag}
                </div>
                <div className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] transition-[width,height,opacity] duration-300",
                      isActive ? "w-6 h-6 opacity-30" : "w-4 h-4 opacity-0"
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex h-3 w-3 items-center justify-center rounded-full transition-all duration-300",
                      isPast
                        ? "bg-[var(--accent)]"
                        : isActive
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--surface-3)] ring-1 ring-[var(--border-strong)]"
                    )}
                    style={{ transform: isActive ? `scale(${1 + emph * 0.45})` : undefined }}
                  />
                </div>
                <div
                  className={cn(
                    "text-center text-[13px] transition-colors duration-200 md:text-left",
                    isActive ? "text-[var(--text)]" : "text-[var(--text-muted)]"
                  )}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
