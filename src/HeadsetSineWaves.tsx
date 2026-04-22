import { useEffect, useRef, type RefObject } from "react";
import { SineWaveGenerator } from "./sine-wave-generator";

type Props = {
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * 헤드셋 뒤에 캔버스 정현파(주파수 파동) 표시
 */
export function HeadsetSineWaves({ containerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "rgba(42, 63, 92, 0.28)";
      ctx.lineWidth = 0.75;
      const mid = h / 2;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      for (let x = 0; x <= w; x += 2) {
        ctx.lineTo(x, mid + Math.sin(x * 0.08) * 8);
      }
      ctx.stroke();
      return;
    }

    const gen = new SineWaveGenerator({
      el: canvas,
      speed: 8,
      waves: [
        {
          timeModifier: 1,
          lineWidth: 2,
          amplitude: 34,
          wavelength: 220,
          segmentLength: 10,
        },
        {
          timeModifier: 1,
          lineWidth: 1.35,
          amplitude: 34,
          wavelength: 110,
          segmentLength: 8,
        },
        {
          timeModifier: 1,
          lineWidth: 0.85,
          amplitude: -34,
          wavelength: 55,
          segmentLength: 6,
        },
        {
          timeModifier: 1,
          lineWidth: 0.55,
          amplitude: -22,
          wavelength: 110,
          segmentLength: 6,
        },
      ],
      resizeEvent() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
        gradient.addColorStop(0, "rgba(42, 63, 92, 0)");
        gradient.addColorStop(0.5, "rgba(42, 63, 92, 0.42)");
        gradient.addColorStop(1, "rgba(42, 63, 92, 0)");
        for (let i = 0; i < this.waves.length; i++) {
          this.waves[i] = { ...this.waves[i], strokeStyle: gradient };
        }
      },
    });
    const syncSize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      gen.setLogicalSize(w, h);
    };
    syncSize();

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      gen.dispose();
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="hero-audio-hint__canvas" aria-hidden />;
}
