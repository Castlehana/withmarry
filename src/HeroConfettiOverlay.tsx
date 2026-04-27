import { useEffect, useRef } from "react";

/** Patrik Svensson 스타일 컨페티 — 캔버스 2D, 히어로 영역 전용 */
const FRAME_RATE = 30;
const DT = 1 / FRAME_RATE;
const DEG_TO_RAD = Math.PI / 180;

const COLORS: readonly [string, string][] = [
  ["#df0049", "#660671"],
  ["#00e857", "#005291"],
  ["#2bebbc", "#05798a"],
  ["#ffd200", "#b06c00"],
];

class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  add(b: Vec2): void {
    this.x += b.x;
    this.y += b.y;
  }
  sub(b: Vec2): void {
    this.x -= b.x;
    this.y -= b.y;
  }
  mul(f: number): void {
    this.x *= f;
    this.y *= f;
  }
  div(f: number): void {
    this.x /= f;
    this.y /= f;
  }
  sqrLength(): number {
    return this.x * this.x + this.y * this.y;
  }
  length(): number {
    return Math.sqrt(this.sqrLength());
  }
  normalize(): void {
    const s = this.sqrLength();
    if (s !== 0) {
      const f = 1 / Math.sqrt(s);
      this.x *= f;
      this.y *= f;
    }
  }
  static sub(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }
}

class EulerMass {
  position: Vec2;
  mass: number;
  drag: number;
  force: Vec2;
  velocity: Vec2;
  constructor(x: number, y: number, mass: number, drag: number) {
    this.position = new Vec2(x, y);
    this.mass = mass;
    this.drag = drag;
    this.force = new Vec2(0, 0);
    this.velocity = new Vec2(0, 0);
  }
  addForce(f: Vec2): void {
    this.force.add(f);
  }
  integrate(dt: number): void {
    const acc = this.currentForce();
    acc.div(this.mass);
    const posDelta = new Vec2(this.velocity.x, this.velocity.y);
    posDelta.mul(dt);
    this.position.add(posDelta);
    acc.mul(dt);
    this.velocity.add(acc);
    this.force = new Vec2(0, 0);
  }
  currentForce(): Vec2 {
    const totalForce = new Vec2(this.force.x, this.force.y);
    const speed = this.velocity.length();
    const dragVel = new Vec2(this.velocity.x, this.velocity.y);
    dragVel.mul(this.drag * this.mass * speed);
    totalForce.sub(dragVel);
    return totalForce;
  }
}

class ConfettiPaper {
  static bounds = new Vec2(0, 0);
  pos: Vec2;
  rotationSpeed: number;
  angle: number;
  rotation: number;
  cosA = 1;
  size = 5;
  oscillationSpeed: number;
  xSpeed = 40;
  ySpeed: number;
  corners: Vec2[] = [];
  time: number;
  frontColor: string;
  backColor: string;

  constructor(x: number, y: number) {
    this.pos = new Vec2(x, y);
    this.rotationSpeed = Math.random() * 600 + 800;
    this.angle = DEG_TO_RAD * Math.random() * 360;
    this.rotation = DEG_TO_RAD * Math.random() * 360;
    this.oscillationSpeed = Math.random() * 1.5 + 0.5;
    this.ySpeed = Math.random() * 60 + 50;
    this.time = Math.random();
    const ci = Math.round(Math.random() * (COLORS.length - 1));
    this.frontColor = COLORS[ci]![0];
    this.backColor = COLORS[ci]![1];
    for (let i = 0; i < 4; i++) {
      const dx = Math.cos(this.angle + DEG_TO_RAD * (i * 90 + 45));
      const dy = Math.sin(this.angle + DEG_TO_RAD * (i * 90 + 45));
      this.corners.push(new Vec2(dx, dy));
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.rotation += this.rotationSpeed * dt;
    this.cosA = Math.cos(DEG_TO_RAD * this.rotation);
    this.pos.x += Math.cos(this.time * this.oscillationSpeed) * this.xSpeed * dt;
    this.pos.y += this.ySpeed * dt;
    if (this.pos.y > ConfettiPaper.bounds.y) {
      this.pos.x = Math.random() * ConfettiPaper.bounds.x;
      this.pos.y = 0;
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = this.cosA > 0 ? this.frontColor : this.backColor;
    g.beginPath();
    g.moveTo(
      this.pos.x + this.corners[0]!.x * this.size,
      this.pos.y + this.corners[0]!.y * this.size * this.cosA
    );
    for (let i = 1; i < 4; i++) {
      g.lineTo(
        this.pos.x + this.corners[i]!.x * this.size,
        this.pos.y + this.corners[i]!.y * this.size * this.cosA
      );
    }
    g.closePath();
    g.fill();
  }
}

class ConfettiRibbon {
  static bounds = new Vec2(0, 0);
  particleDist: number;
  particleCount: number;
  particleMass: number;
  particleDrag: number;
  particles: EulerMass[] = [];
  frontColor: string;
  backColor: string;
  xOff: number;
  yOff: number;
  position: Vec2;
  prevPosition: Vec2;
  velocityInherit: number;
  time: number;
  oscillationSpeed: number;
  oscillationDistance: number;
  ySpeed: number;

  constructor(
    x: number,
    y: number,
    count: number,
    dist: number,
    thickness: number,
    angle: number,
    mass: number,
    drag: number
  ) {
    this.particleDist = dist;
    this.particleCount = count;
    this.particleMass = mass;
    this.particleDrag = drag;
    const ci = Math.round(Math.random() * (COLORS.length - 1));
    this.frontColor = COLORS[ci]![0];
    this.backColor = COLORS[ci]![1];
    this.xOff = Math.cos(DEG_TO_RAD * angle) * thickness;
    this.yOff = Math.sin(DEG_TO_RAD * angle) * thickness;
    this.position = new Vec2(x, y);
    this.prevPosition = new Vec2(x, y);
    this.velocityInherit = Math.random() * 2 + 4;
    this.time = Math.random() * 100;
    this.oscillationSpeed = Math.random() * 2 + 2;
    this.oscillationDistance = Math.random() * 40 + 40;
    this.ySpeed = Math.random() * 40 + 80;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(new EulerMass(x, y - i * this.particleDist, this.particleMass, this.particleDrag));
    }
  }

  reset(): void {
    this.position.y = -Math.random() * ConfettiRibbon.bounds.y;
    this.position.x = Math.random() * ConfettiRibbon.bounds.x;
    this.prevPosition = new Vec2(this.position.x, this.position.y);
    this.velocityInherit = Math.random() * 2 + 4;
    this.time = Math.random() * 100;
    this.oscillationSpeed = Math.random() * 2 + 1.5;
    this.oscillationDistance = Math.random() * 40 + 40;
    this.ySpeed = Math.random() * 40 + 80;
    const ci = Math.round(Math.random() * (COLORS.length - 1));
    this.frontColor = COLORS[ci]![0];
    this.backColor = COLORS[ci]![1];
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(
        new EulerMass(this.position.x, this.position.y - i * this.particleDist, this.particleMass, this.particleDrag)
      );
    }
  }

  update(dt: number): void {
    this.time += dt * this.oscillationSpeed;
    this.position.y += this.ySpeed * dt;
    this.position.x += Math.cos(this.time) * this.oscillationDistance * dt;
    this.particles[0]!.position.x = this.position.x;
    this.particles[0]!.position.y = this.position.y;
    const dX = this.prevPosition.x - this.position.x;
    const dY = this.prevPosition.y - this.position.y;
    const delta = Math.sqrt(dX * dX + dY * dY);
    this.prevPosition = new Vec2(this.position.x, this.position.y);
    for (let i = 1; i < this.particleCount; i++) {
      const dirP = Vec2.sub(this.particles[i - 1]!.position, this.particles[i]!.position);
      dirP.normalize();
      dirP.mul((delta / dt) * this.velocityInherit);
      this.particles[i]!.addForce(dirP);
    }
    for (let i = 1; i < this.particleCount; i++) {
      this.particles[i]!.integrate(dt);
    }
    for (let i = 1; i < this.particleCount; i++) {
      const rp2 = new Vec2(this.particles[i]!.position.x, this.particles[i]!.position.y);
      rp2.sub(this.particles[i - 1]!.position);
      rp2.normalize();
      rp2.mul(this.particleDist);
      rp2.add(this.particles[i - 1]!.position);
      this.particles[i]!.position = rp2;
    }
    if (this.position.y > ConfettiRibbon.bounds.y + this.particleDist * this.particleCount) {
      this.reset();
    }
  }

  side(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number {
    return (x1 - x2) * (y3 - y2) - (y1 - y2) * (x3 - x2);
  }

  draw(g: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.particleCount - 1; i++) {
      const p0 = new Vec2(this.particles[i]!.position.x + this.xOff, this.particles[i]!.position.y + this.yOff);
      const p1 = new Vec2(
        this.particles[i + 1]!.position.x + this.xOff,
        this.particles[i + 1]!.position.y + this.yOff
      );
      const useFront =
        this.side(
          this.particles[i]!.position.x,
          this.particles[i]!.position.y,
          this.particles[i + 1]!.position.x,
          this.particles[i + 1]!.position.y,
          p1.x,
          p1.y
        ) < 0;
      g.fillStyle = useFront ? this.frontColor : this.backColor;
      g.strokeStyle = useFront ? this.frontColor : this.backColor;
      if (i === 0) {
        g.beginPath();
        g.moveTo(this.particles[i]!.position.x, this.particles[i]!.position.y);
        g.lineTo(this.particles[i + 1]!.position.x, this.particles[i + 1]!.position.y);
        g.lineTo(
          (this.particles[i + 1]!.position.x + p1.x) * 0.5,
          (this.particles[i + 1]!.position.y + p1.y) * 0.5
        );
        g.closePath();
        g.stroke();
        g.fill();
        g.beginPath();
        g.moveTo(p1.x, p1.y);
        g.lineTo(p0.x, p0.y);
        g.lineTo(
          (this.particles[i + 1]!.position.x + p1.x) * 0.5,
          (this.particles[i + 1]!.position.y + p1.y) * 0.5
        );
        g.closePath();
        g.stroke();
        g.fill();
      } else if (i === this.particleCount - 2) {
        g.beginPath();
        g.moveTo(this.particles[i]!.position.x, this.particles[i]!.position.y);
        g.lineTo(this.particles[i + 1]!.position.x, this.particles[i + 1]!.position.y);
        g.lineTo(
          (this.particles[i]!.position.x + p0.x) * 0.5,
          (this.particles[i]!.position.y + p0.y) * 0.5
        );
        g.closePath();
        g.stroke();
        g.fill();
        g.beginPath();
        g.moveTo(p1.x, p1.y);
        g.lineTo(p0.x, p0.y);
        g.lineTo(
          (this.particles[i]!.position.x + p0.x) * 0.5,
          (this.particles[i]!.position.y + p0.y) * 0.5
        );
        g.closePath();
        g.stroke();
        g.fill();
      } else {
        g.beginPath();
        g.moveTo(this.particles[i]!.position.x, this.particles[i]!.position.y);
        g.lineTo(this.particles[i + 1]!.position.x, this.particles[i + 1]!.position.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(p0.x, p0.y);
        g.closePath();
        g.stroke();
        g.fill();
      }
    }
  }
}

const RIBBON_COUNT = 7;
const RIBBON_PARTICLES = 30;
const RIBBON_DIST = 8;
const RIBBON_THICK = 8;
const PAPER_COUNT = 25;
/** 베일이 흰색으로 가득 찬 뒤부터 약 이 시간 동안만 구동(배터리·CPU) */
const MAX_RUN_MS = 22_000;

export type HeroConfettiOverlayProps = {
  active: boolean;
};

export function HeroConfettiOverlay({ active }: HeroConfettiOverlayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    let ribbons: ConfettiRibbon[] = [];
    let papers: ConfettiPaper[] = [];
    let raf = 0;
    let last = performance.now();
    const started = performance.now();

    const syncSize = (): void => {
      const w = Math.max(1, Math.floor(wrap.clientWidth));
      const h = Math.max(1, Math.floor(wrap.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      ConfettiPaper.bounds = new Vec2(w, h);
      ConfettiRibbon.bounds = new Vec2(w, h);
      ribbons = [];
      for (let i = 0; i < RIBBON_COUNT; i++) {
        ribbons.push(
          new ConfettiRibbon(Math.random() * w, -Math.random() * h * 2, RIBBON_PARTICLES, RIBBON_DIST, RIBBON_THICK, 45, 1, 0.05)
        );
      }
      papers = [];
      for (let i = 0; i < PAPER_COUNT; i++) {
        papers.push(new ConfettiPaper(Math.random() * w, Math.random() * h));
      }
    };

    syncSize();
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(wrap);

    const tick = (now: number): void => {
      if (now - started > MAX_RUN_MS) {
        g.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const elapsed = Math.min((now - last) / 1000, 0.05);
      last = now;
      const step = elapsed > 0 ? elapsed : DT;
      g.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);
      for (const p of papers) {
        p.update(step);
        p.draw(g);
      }
      for (const r of ribbons) {
        r.update(step);
        r.draw(g);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="wedding-hero-confetti-wrap" ref={wrapRef} aria-hidden>
      <canvas ref={canvasRef} className="wedding-hero-confetti-canvas" />
    </div>
  );
}
