import { useEffect, useRef } from "react";
import "./InterludeFireflyBackground.css";

/** 레거시 tick(50ms) 대비 rAF 매 프레임 보정 — 값이 작을수록 페이드·이동이 느림 */
const FIREFLY_STEP_SCALE = 0.38;
const RINT_MS = 50;
const CIRCLE_COUNT = 50;

const FIREFLY_RGB = "255,255,255";
/** 1에 가까울수록 선명 — 전체를 더 흐리게 */
const FIREFLY_ALPHA_DIM = 0.34;

type Size = { w: number; h: number };

type CircleSettings = {
  ttl: number;
  xmax: number;
  ymax: number;
  rmax: number;
  rt: number;
  xdef: number;
  ydef: number;
  xdrift: number;
  ydrift: number;
  random: boolean;
  blink: boolean;
};

/** 참고: 레거시 파이어플라이 캔버스 로직 — jQuery/setInterval 대신 rAF + ResizeObserver */
class FireflyCircle {
  private readonly s: CircleSettings = {
    ttl: 14000,
    xmax: 1.8,
    ymax: 0.85,
    rmax: 5,
    rt: 1,
    xdef: 960,
    ydef: 540,
    xdrift: 4,
    ydrift: 4,
    random: true,
    blink: true,
  };

  private x = 0;
  private y = 0;
  private r = 0;
  private dx = 0;
  private dy = 0;
  private hl = 0;
  private rt = 0;
  private stop = 0;

  constructor(private readonly getSize: () => Size) {}

  reset(): void {
    const { w: WIDTH, h: HEIGHT } = this.getSize();
    if (WIDTH <= 0 || HEIGHT <= 0) return;
    this.x = this.s.random ? WIDTH * Math.random() : this.s.xdef;
    this.y = this.s.random ? HEIGHT * Math.random() : this.s.ydef;
    this.r = (this.s.rmax - 0.4) * Math.random() + 0.32;
    this.dx = Math.random() * this.s.xmax * (Math.random() < 0.5 ? -1 : 1);
    this.dy = Math.random() * this.s.ymax * (Math.random() < 0.5 ? -1 : 1);
    this.hl = (this.s.ttl / RINT_MS) * (this.r / this.s.rmax);
    this.rt = Math.random() * this.hl;
    this.s.rt = Math.random() + 1;
    this.stop = Math.random() * 0.2 + 0.4;
    this.s.xdrift *= Math.random() * (Math.random() < 0.5 ? -1 : 1);
    this.s.ydrift *= Math.random() * (Math.random() < 0.5 ? -1 : 1);
  }

  fade(): void {
    this.rt += this.s.rt * FIREFLY_STEP_SCALE;
  }

  draw(con: CanvasRenderingContext2D): void {
    const { w: WIDTH, h: HEIGHT } = this.getSize();
    if (WIDTH <= 0 || HEIGHT <= 0 || this.hl <= 0) return;

    if (this.s.blink && (this.rt <= 0 || this.rt >= this.hl)) {
      this.s.rt *= -1;
    } else if (this.rt >= this.hl) {
      this.reset();
    }

    const phase = 1 - this.rt / this.hl;
    const alpha = phase * FIREFLY_ALPHA_DIM;
    con.beginPath();
    con.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
    con.closePath();
    const cr = this.r * phase;
    const g = con.createRadialGradient(this.x, this.y, 0, this.x, this.y, cr <= 0 ? 1 : cr);
    g.addColorStop(0, `rgba(${FIREFLY_RGB},${alpha})`);
    g.addColorStop(this.stop, `rgba(${FIREFLY_RGB},${alpha * 0.22})`);
    g.addColorStop(1, `rgba(${FIREFLY_RGB},0)`);
    con.fillStyle = g;
    con.fill();
  }

  move(): void {
    const { w: WIDTH, h: HEIGHT } = this.getSize();
    if (this.hl <= 0) return;
    this.x += (this.rt / this.hl) * this.dx;
    this.y += (this.rt / this.hl) * this.dy;
    if (this.x > WIDTH || this.x < 0) this.dx *= -1;
    if (this.y > HEIGHT || this.y < 0) this.dy *= -1;
  }
}

type InterludeFireflyBackgroundProps = {
  active: boolean;
};

export function InterludeFireflyBackground({ active }: InterludeFireflyBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      return;
    }

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getSize = (): Size => ({
      w: Math.max(1, host.clientWidth),
      h: Math.max(1, host.clientHeight),
    });

    const syncCanvasSize = (): Size => {
      const { w, h } = getSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    let size = syncCanvasSize();
    const circles = Array.from({ length: CIRCLE_COUNT }, () => new FireflyCircle(() => size));
    circles.forEach((c) => c.reset());

    const ro = new ResizeObserver(() => {
      size = syncCanvasSize();
      circles.forEach((c) => c.reset());
    });
    ro.observe(host);

    const tick = (): void => {
      if (!activeRef.current) return;
      const { w, h } = getSize();
      ctx.clearRect(0, 0, w, h);
      for (const c of circles) {
        c.fade();
        c.move();
        c.draw(ctx);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [active]);

  return (
    <div className="hourglass-interlude-firefly-host" ref={hostRef} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
