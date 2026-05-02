import { useCallback, useEffect, useRef, useState } from "react";
import "./MainBgmToggle.css";

const BGM_SRC = `${import.meta.env.BASE_URL}static/mainBGM.mp3`;
const FADE_MS = 650;

export function MainBgmToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fadeRafRef = useRef<number | null>(null);
  const amplitudeRef = useRef(0);
  const targetAmplitudeRef = useRef(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio(BGM_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      amplitudeRef.current += (targetAmplitudeRef.current - amplitudeRef.current) * 0.055;
      const amp = amplitudeRef.current;
      const mid = rect.height / 2;
      const grad = ctx.createLinearGradient(0, 0, rect.width, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, playing ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.34)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let x = 0; x <= rect.width; x += 2) {
        const wave = Math.sin(x * 0.18 + now * 0.006) * amp + Math.sin(x * 0.07 - now * 0.003) * amp * 0.48;
        const y = mid + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  const fadeVolume = useCallback((from: number, to: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      const eased = 1 - (1 - t) * (1 - t);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
      if (t < 1) {
        fadeRafRef.current = requestAnimationFrame(tick);
      } else {
        fadeRafRef.current = null;
        onDone?.();
      }
    };
    fadeRafRef.current = requestAnimationFrame(tick);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      setPlaying(false);
      targetAmplitudeRef.current = 0;
      fadeVolume(audio.volume, 0, () => {
        audio.pause();
      });
      return;
    }
    audio.volume = 0;
    void audio
      .play()
      .then(() => {
        setPlaying(true);
        targetAmplitudeRef.current = 7.5;
        fadeVolume(0, 0.72);
      })
      .catch(() => {
        setPlaying(false);
        targetAmplitudeRef.current = 0;
      });
  }, [fadeVolume, playing]);

  return (
    <button
      type="button"
      className={`main-bgm-toggle${playing ? " main-bgm-toggle--on" : ""}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "배경음악 끄기" : "배경음악 켜기"}
    >
      <canvas ref={canvasRef} className="main-bgm-toggle__wave" aria-hidden />
      <span className="main-bgm-toggle__icon" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
