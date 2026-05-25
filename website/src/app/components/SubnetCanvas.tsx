import { useEffect, useRef } from "react";

/**
 * Ambient subnet visualization.
 *
 * Renders a scattered field of dim cyan "peer" nodes onto a <canvas>. Every
 * few seconds a random pair of nodes performs a brief handshake: a thin
 * phosphor-green line traces from one to the other and fades, while both
 * endpoints pulse momentarily. Idle nodes drift on a slow lissajous so the
 * field is never static.
 *
 * Honors prefers-reduced-motion by drawing a single static frame and bailing.
 */

type Props = {
  className?: string;
  /** baseline opacity for the entire canvas; sections set this differently */
  opacity?: number;
  /** how many peer nodes to render */
  nodeCount?: number;
  /** mean seconds between two handshakes (Poisson-ish) */
  handshakeIntervalSec?: number;
};

type Node = {
  baseX: number;
  baseY: number;
  driftSpeed: number;
  driftAmp: number;
  phase: number;
  size: number;
  brightness: number;
};

type Handshake = {
  from: number;
  to: number;
  start: number;
  duration: number;
};

const GHOST = "180, 220, 230"; // dim teal-cyan rgb
const ACCENT = "150, 235, 170"; // phosphor green rgb

export function SubnetCanvas({
  className,
  opacity = 1,
  nodeCount = 18,
  handshakeIntervalSec = 2.4,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const handshakesRef = useRef<Handshake[]>([]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let nextHandshakeAt = 0;
    const t0 = performance.now();

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Distribute nodes across the surface with mild jitter to avoid a grid feel.
      const cols = Math.ceil(Math.sqrt((nodeCount * width) / Math.max(height, 1)));
      const rows = Math.ceil(nodeCount / cols);
      const cellW = width / cols;
      const cellH = height / rows;

      const nodes: Node[] = [];
      let i = 0;
      for (let r = 0; r < rows && i < nodeCount; r += 1) {
        for (let c = 0; c < cols && i < nodeCount; c += 1) {
          const jitterX = (Math.random() - 0.5) * cellW * 0.6;
          const jitterY = (Math.random() - 0.5) * cellH * 0.6;
          nodes.push({
            baseX: c * cellW + cellW / 2 + jitterX,
            baseY: r * cellH + cellH / 2 + jitterY,
            driftSpeed: 0.00018 + Math.random() * 0.00022,
            driftAmp: 6 + Math.random() * 12,
            phase: Math.random() * Math.PI * 2,
            size: 1.3 + Math.random() * 1.1,
            brightness: 0.5 + Math.random() * 0.3,
          });
          i += 1;
        }
      }
      nodesRef.current = nodes;
    };

    const scheduleNextHandshake = (now: number) => {
      // Exponential-ish jitter around the mean interval.
      const jitter = 0.5 + Math.random() * 1.5;
      nextHandshakeAt = now + handshakeIntervalSec * 1000 * jitter;
    };

    const tryHandshake = (now: number) => {
      const nodes = nodesRef.current;
      if (nodes.length < 2) return;
      const fromIdx = Math.floor(Math.random() * nodes.length);
      let toIdx = Math.floor(Math.random() * nodes.length);
      let tries = 0;
      while (toIdx === fromIdx && tries < 4) {
        toIdx = Math.floor(Math.random() * nodes.length);
        tries += 1;
      }
      handshakesRef.current.push({
        from: fromIdx,
        to: toIdx,
        start: now,
        duration: 1200 + Math.random() * 700,
      });
      scheduleNextHandshake(now);
    };

    const drawFrame = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      const elapsed = now - t0;
      const nodes = nodesRef.current;
      const handshakes = handshakesRef.current;

      // Active node indices (those involved in a live handshake glow brighter)
      const activeNow = new Map<number, number>(); // node idx -> 0..1 emphasis
      for (let i = 0; i < handshakes.length; i += 1) {
        const h = handshakes[i];
        const p = (now - h.start) / h.duration;
        if (p < 0 || p > 1) continue;
        // emphasis peaks in the middle of the handshake
        const emph = Math.sin(Math.PI * Math.min(Math.max(p, 0), 1));
        const cur = activeNow.get(h.from) ?? 0;
        if (emph > cur) activeNow.set(h.from, emph);
        const cur2 = activeNow.get(h.to) ?? 0;
        if (emph > cur2) activeNow.set(h.to, emph);
      }

      // Resolve positions once per frame so handshake lines and node dots agree.
      const xs = new Array<number>(nodes.length);
      const ys = new Array<number>(nodes.length);
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const x = n.baseX + Math.sin(elapsed * n.driftSpeed + n.phase) * n.driftAmp;
        const y = n.baseY + Math.cos(elapsed * n.driftSpeed * 0.7 + n.phase * 1.3) * n.driftAmp * 0.6;
        xs[i] = x;
        ys[i] = y;
      }

      // Draw handshake lines first so node dots sit on top.
      for (let i = handshakes.length - 1; i >= 0; i -= 1) {
        const h = handshakes[i];
        const p = (now - h.start) / h.duration;
        if (p < 0) continue;
        if (p > 1) {
          handshakes.splice(i, 1);
          continue;
        }
        // line fades in/out and shortens slightly as it draws
        const lineAlpha = Math.sin(Math.PI * p) * 0.55;
        const x1 = xs[h.from];
        const y1 = ys[h.from];
        const x2 = xs[h.to];
        const y2 = ys[h.to];

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, `rgba(${ACCENT}, ${lineAlpha * 0.9})`);
        grad.addColorStop(0.5, `rgba(${ACCENT}, ${lineAlpha})`);
        grad.addColorStop(1, `rgba(${ACCENT}, ${lineAlpha * 0.6})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // moving pip from→to to imply direction (a packet)
        const pipP = Math.min(p * 1.4, 1);
        const px = x1 + (x2 - x1) * pipP;
        const py = y1 + (y2 - y1) * pipP;
        ctx.fillStyle = `rgba(${ACCENT}, ${lineAlpha * 1.4})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const x = xs[i];
        const y = ys[i];
        const active = activeNow.get(i) ?? 0;
        const baseAlpha = 0.18 + n.brightness * 0.18;
        const alpha = baseAlpha + active * 0.55;
        const radius = n.size + active * 1.6;

        // Subtle outer halo for active nodes
        if (active > 0.02) {
          const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, radius + 8);
          haloGrad.addColorStop(0, `rgba(${ACCENT}, ${active * 0.35})`);
          haloGrad.addColorStop(1, `rgba(${ACCENT}, 0)`);
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
          ctx.fill();
        }

        const color = active > 0.02 ? ACCENT : GHOST;
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      if (now >= nextHandshakeAt) {
        tryHandshake(now);
      }
      drawFrame(now);
      rafRef.current = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => init());
    ro.observe(canvas);
    init();

    if (reduced) {
      // Static single frame, no rAF loop, no handshakes.
      drawFrame(performance.now());
      return () => {
        ro.disconnect();
      };
    }

    scheduleNextHandshake(performance.now());
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [nodeCount, handshakeIntervalSec]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ opacity, display: "block", width: "100%", height: "100%" }}
    />
  );
}
