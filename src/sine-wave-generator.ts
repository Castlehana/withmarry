/**
 * Canvas 기반 정현파 묶음 (참고: Sine Wave Experiment / sine-waves)
 * jQuery·Compass 없이 동일 로직만 이식.
 */

const PI2 = Math.PI * 2;
const HALF_PI = Math.PI / 2;

export type WaveConfig = {
  timeModifier?: number;
  amplitude?: number;
  wavelength?: number;
  lineWidth?: number;
  strokeStyle?: string | CanvasGradient;
  segmentLength?: number;
};

export type SineWaveGeneratorOptions = {
  el: HTMLCanvasElement;
  waves: WaveConfig[];
  speed?: number;
  initialize?: (this: SineWaveGenerator) => void;
  resizeEvent?: (this: SineWaveGenerator) => void;
};

export class SineWaveGenerator {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  waves: WaveConfig[];
  speed = 10;
  amplitude = 50;
  wavelength = 50;
  segmentLength = 10;
  lineWidth = 2;
  strokeStyle = "rgba(255, 255, 255, 0.2)";
  resizeEvent: (this: SineWaveGenerator) => void;
  initialize?: (this: SineWaveGenerator) => void;

  time = 0;
  dpr = 1;
  width = 0;
  height = 0;
  waveWidth = 0;
  waveLeft = 0;

  private running = false;
  private rafId: number | null = null;
  private readonly loop = () => {
    if (!this.running) return;
    this.clear();
    this.update();
    this.rafId = requestAnimationFrame(this.loop);
  };

  constructor(options: SineWaveGeneratorOptions) {
    const ctx = options.el.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d context를 얻을 수 없습니다.");
    if (!options.waves.length) throw new Error("waves 가 비었습니다.");

    this.el = options.el;
    this.ctx = ctx;
    this.waves = options.waves;
    if (options.speed !== undefined) this.speed = options.speed;
    this.initialize = options.initialize;
    this.resizeEvent = options.resizeEvent ?? (() => {});

    this.applyLogicalSizeFromElement();
    if (this.initialize) this.initialize.call(this);
    this.running = true;
    this.loop();
  }

  dispose(): void {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** 부모 요소 크기에 맞춰 캔버스 버퍼·CSS 크기 설정 후 resizeEvent 호출 */
  applyLogicalSizeFromElement(): void {
    const p = this.el.parentElement;
    const logicalW = Math.max(1, Math.round(p?.clientWidth ?? 120));
    const logicalH = Math.max(1, Math.round(p?.clientHeight ?? 120));
    this.setLogicalSize(logicalW, logicalH);
  }

  setLogicalSize(logicalWidth: number, logicalHeight: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.round(logicalWidth * this.dpr);
    this.height = Math.round(logicalHeight * this.dpr);
    this.el.width = this.width;
    this.el.height = this.height;
    this.el.style.width = `${logicalWidth}px`;
    this.el.style.height = `${logicalHeight}px`;
    /* 콘텐츠(캔버스) 가로 전체에 파동이 이어지도록 여백 없음 */
    this.waveWidth = this.width;
    this.waveLeft = 0;
    this.resizeEvent.call(this);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  update(time?: number): void {
    this.time -= 0.007;
    const t = time ?? this.time;
    for (let index = 0; index < this.waves.length; index++) {
      const w = this.waves[index];
      const timeModifier = w.timeModifier ?? 1;
      this.drawSine(t * timeModifier, w);
    }
  }

  ease(percent: number, amplitude: number): number {
    return amplitude * (Math.sin(percent * PI2 - HALF_PI) + 1) * 0.5;
  }

  drawSine(time: number, options: WaveConfig): void {
    const amplitude = options.amplitude ?? this.amplitude;
    const wavelength = options.wavelength ?? this.wavelength;
    const lineWidth = options.lineWidth ?? this.lineWidth;
    const strokeStyle = options.strokeStyle ?? this.strokeStyle;
    const segmentLength = options.segmentLength ?? this.segmentLength;

    let x = time;
    const yAxis = this.height / 2;
    let amp = this.amplitude;

    this.ctx.lineWidth = lineWidth * this.dpr;
    this.ctx.strokeStyle = strokeStyle;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(0, yAxis);
    this.ctx.lineTo(this.waveLeft, yAxis);

    for (let i = 0; i < this.waveWidth; i += segmentLength) {
      x = time * this.speed + (-yAxis + i) / wavelength;
      const y = Math.sin(x);
      amp = this.ease(i / this.waveWidth, amplitude);
      this.ctx.lineTo(i + this.waveLeft, amp * y + yAxis);
    }

    this.ctx.lineTo(this.width, yAxis);
    this.ctx.stroke();
  }
}
