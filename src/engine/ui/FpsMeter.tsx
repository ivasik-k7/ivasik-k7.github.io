import { useEffect, useRef, useState } from "react";

/**
 * FpsMeter — a dev-only frame-time readout (wire it via renderExtras behind
 * a ?fps flag). Samples rAF deltas in a rolling window; the display itself
 * updates only twice a second so the meter never becomes the load it measures.
 */
export function FpsMeter() {
  const [text, setText] = useState("—");
  const deltas = useRef<number[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastShown = last;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const window = deltas.current;
      window.push(now - last);
      last = now;
      if (window.length > 120) window.shift();
      if (now - lastShown > 500 && window.length > 10) {
        lastShown = now;
        const sorted = [...window].sort((a, b) => a - b);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        setText(`${Math.round(1000 / avg)} FPS · p95 ${p95.toFixed(1)}ms`);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <p className="pointer-events-none absolute bottom-1 left-1 z-40 font-mono text-[10px] text-signal/90 tracking-[0.15em] [text-shadow:0_1px_0_#000]">
      {text}
    </p>
  );
}
