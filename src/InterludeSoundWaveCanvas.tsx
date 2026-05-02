import { useEffect, useRef, type MutableRefObject } from "react";
import { createNoise2D } from "simplex-noise";

type InterludeSoundWaveCanvasProps = {
  /** 대본 mp3 재생 시 `getByteTimeDomainData`로 진폭 연동 */
  waveAnalyserRef?: MutableRefObject<AnalyserNode | null>;
  /** true: 대본 오디오 라우트 중. false: 재생 없음·대기 — 아주 낮은 진동만 */
  wavActiveRef?: MutableRefObject<boolean>;
};

/**
 * Our Story 인터루드: 커플 이미지 아래 Perlin 변조 사인파.
 * 재생·유효 RMS일 때는 위상 + 볼륨 반응. 무음·비재생은 극소 진폭으로, 높이 변화는 서서히 보간.
 */
export function InterludeSoundWaveCanvas({
  waveAnalyserRef,
  wavActiveRef,
}: InterludeSoundWaveCanvasProps = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const c2d = maybeCtx;

    const noise2D = createNoise2D(Math.random);
    /** 물결 위상(초) — 재생 중엔 보통 속도, 비재생·무음은 느리게만 증가 */
    let phaseElapsedSec = 0;
    let lastRafTime: number | null = null;
    let tdBuf: Uint8Array | null = null;
    let smoothedRms = 0;
    const SILENCE_RMS = 0.014;
    let w = 0;
    let h = 0;
    let rafId = 0;

    const syncSize = () => {
      const cw = Math.max(1, Math.floor(wrap.clientWidth));
      const ch = Math.max(1, Math.floor(wrap.clientHeight));
      if (cw === w && ch === h && canvas.width > 0) return;
      w = cw;
      h = ch;
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const NOISE_GAIN = 88;
    const WAVE_VERTICAL_SCALE = 0.38;
    const LAYER_WEIGHT = 0.26;
    /** 재생 없음·Analyser 무음: 세로 스케일(기본 1 대비) */
    const IDLE_MICRO_SCALE = 0.1;
    /** 대본 오디오 라우트는 아닐 때 위상 속도 비율 */
    const IDLE_PHASE_RATE = 0.22;
    /** 재생 중이나 RMS 무음일 때 위상 속도(너무 빠르면 미세 진동이 번짐) */
    const SILENT_PLAYBACK_PHASE_RATE = 0.38;
    /** drawSine 진폭 스무딩: 유효 음성은 빠르게 boost 추적, 무음·비재생은 천천히 IDLE로 */
    const AMP_SMOOTH_TAU_AUDIBLE_S = 0.042;
    const AMP_SMOOTH_TAU_QUIET_S = 0.62;

    /** drawSine 진폭 — 무음 전환 시 높이가 단번에 떨어지지 않도록 */
    let smoothedDrawAmplitude = IDLE_MICRO_SCALE;

    const isWavDriving = (): boolean => wavActiveRef?.current === true;

    /** `audible`: RMS가 임계 이상 — 이때만 큰 물결. 아니면 boost는 1 + 극미만 */
    function readRmsBoostAndAudible(): { boost: number; audible: boolean } {
      if (!isWavDriving() || !waveAnalyserRef?.current) {
        smoothedRms = 0;
        return { boost: 1, audible: false };
      }
      const an = waveAnalyserRef.current;
      const fft = an.fftSize;
      if (!tdBuf || tdBuf.length !== fft) {
        tdBuf = new Uint8Array(new ArrayBuffer(fft));
      }
      an.getByteTimeDomainData(tdBuf);
      let s = 0;
      for (let i = 0; i < tdBuf.length; i++) {
        const v = (tdBuf[i]! - 128) / 128;
        s += v * v;
      }
      const rms = Math.sqrt(s / tdBuf.length);
      if (rms < SILENCE_RMS) {
        smoothedRms *= 0.72;
        if (smoothedRms < 0.0008) smoothedRms = 0;
        return { boost: 1, audible: false };
      }
      smoothedRms = smoothedRms * 0.82 + rms * 0.18;
      return { boost: 1 + smoothedRms * 5.5, audible: true };
    }

    function drawSine(
      elapsed: number,
      n: number,
      angular_freq: number,
      perlin_shift: number,
      amplitudeBoost: number
    ) {
      const phase_angle = elapsed * 2;
      const midY = h * 0.42;
      let x: number;
      let y: number;
      let amplitude: number;
      for (let i = 0; i < n; i++) {
        c2d.beginPath();
        const hue = 38 + i * 5;
        const sat = 12 + i * 2;
        const light = 93 - i * 1.1;
        const alpha = 0.11 + i * 0.05;
        c2d.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
        c2d.lineWidth = 1.45;
        c2d.lineCap = "round";
        c2d.lineJoin = "round";
        c2d.shadowBlur = 18;
        c2d.shadowColor = "rgba(255, 248, 237, 0.32)";
        c2d.filter = "blur(1.65px)";
        for (x = 0; x < w; x++) {
          amplitude = noise2D(x / ((i + 1) * perlin_shift), elapsed) * NOISE_GAIN * amplitudeBoost;
          amplitude *= Math.sin(x * 2);
          y = amplitude * Math.sin(x * angular_freq + phase_angle * (i + 1));
          c2d.lineTo(x, y * ((i + 1) * LAYER_WEIGHT) * WAVE_VERTICAL_SCALE + midY);
        }
        c2d.stroke();
        c2d.closePath();
      }
      c2d.filter = "none";
      c2d.shadowBlur = 0;
    }

    function drawSideDarken() {
      if (w < 2 || h < 2) return;
      const g = c2d.createLinearGradient(0, 0, w, 0);
      const edge = 1;
      const midFall = 0.5;
      g.addColorStop(0, `rgba(0,0,0,${edge})`);
      g.addColorStop(0.18, `rgba(0,0,0,${midFall})`);
      g.addColorStop(0.5, "rgba(0,0,0,0)");
      g.addColorStop(0.82, `rgba(0,0,0,${midFall})`);
      g.addColorStop(1, `rgba(0,0,0,${edge})`);
      c2d.save();
      c2d.globalCompositeOperation = "source-over";
      c2d.fillStyle = g;
      c2d.fillRect(0, 0, w, h);
      c2d.restore();
    }

    function render(time: number) {
      syncSize();
      if (lastRafTime == null) lastRafTime = time;
      const rawDt = (time - lastRafTime) / 1000;
      lastRafTime = time;
      const dt = Math.min(0.12, Math.max(0, rawDt));

      const driving = isWavDriving();
      const { boost, audible } = readRmsBoostAndAudible();
      let phaseRate: number;
      if (!driving) {
        phaseRate = IDLE_PHASE_RATE;
      } else if (!audible) {
        phaseRate = SILENT_PLAYBACK_PHASE_RATE;
      } else {
        phaseRate = 1;
      }
      phaseElapsedSec += dt * phaseRate;

      const instantAmp = audible ? boost : IDLE_MICRO_SCALE;
      const tauAmp = audible ? AMP_SMOOTH_TAU_AUDIBLE_S : AMP_SMOOTH_TAU_QUIET_S;
      const alphaAmp = 1 - Math.exp(-dt / tauAmp);
      smoothedDrawAmplitude += (instantAmp - smoothedDrawAmplitude) * alphaAmp;

      c2d.clearRect(0, 0, w, h);
      drawSine(phaseElapsedSec, 3, 256, 100, smoothedDrawAmplitude);
      drawSideDarken();
      rafId = requestAnimationFrame(render);
    }

    const onWinResize = () => {
      w = 0;
      h = 0;
    };

    const ro = new ResizeObserver(() => {
      w = 0;
      h = 0;
    });
    ro.observe(wrap);
    window.addEventListener("resize", onWinResize);
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onWinResize);
      ro.disconnect();
    };
  }, [waveAnalyserRef, wavActiveRef]);

  return (
    <div ref={wrapRef} className="hourglass-flash-overlay__wave-wrap">
      <canvas ref={canvasRef} className="hourglass-flash-overlay__wave-canvas" aria-hidden />
    </div>
  );
}
