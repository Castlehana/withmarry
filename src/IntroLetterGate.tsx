import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./IntroLetterEnvelope.css";
import "./IntroLetterGate.css";

function introStaticUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, "")}`;
}

const INTRO_FOLDER_BODY_SRC = introStaticUrl("static/folder.png");
const INTRO_FOLDER_FLAP_SRC = introStaticUrl("static/folder-motion.png");

export type IntroScrollCueTone = "black" | "white";

export type IntroLetterGateProps = {
  /** 인트로가 끝나고 본문으로 넘어갈 때 한 번 호출 */
  onComplete: () => void;
  /** 봉투 확정 직후 베일이 완전 흰색이 된 시점(퇴장 페이드 전) — 히어로 컨페티 등 */
  onVeilFull?: () => void;
  /** 히어로 스크롤 힌트와 동일한 `data-hero-bw-tone` (인트로 세로 가운데~하단 사이, 위를 향하도록 뒤집힘) */
  scrollCueTone?: IntroScrollCueTone;
};

/** 이 거리(px)만큼 위로 끌면 `--peel` 이 1에 도달 — 값↑일수록 더 천천히 차함 */
const PEEL_THRESHOLD_PX = 1000;
/** 이 비율 이상에서 손을 떼면 완전히 열림으로 확정 */
const PEEL_COMMIT = 0.1;

/** `--veil-full` 시 opacity 0.7→1 CSS 전환 시간과 동일(손 떼는 즉시 재생) */
const VEIL_RAMP_TO_FULL_MS = 200;
/** 100% 하얀 뒤 유지 */
const HOLD_FULL_WHITE_MS = 1000;
/** 게이트 전체 페이드아웃(본문 노출) */
const EXIT_FADE_MS = 900;

export function IntroLetterGate({ onComplete, onVeilFull, scrollCueTone = "white" }: IntroLetterGateProps) {
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [scrollCuesIn, setScrollCuesIn] = useState(reduceMotion);
  const [peel, setPeel] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  /** PEEL_COMMIT 이상에서 손 떼면 즉시 0.7→1 베일 전환 */
  const [veilFull, setVeilFull] = useState(false);
  const [exiting, setExiting] = useState(false);

  const peelRef = useRef(0);
  peelRef.current = peel;

  const dragRef = useRef<{ peel0: number; startY: number; pointerId: number } | null>(null);
  const committedRef = useRef(false);
  const exitSequenceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (exitSequenceTimerRef.current != null) {
        window.clearTimeout(exitSequenceTimerRef.current);
        exitSequenceTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setTimeout(() => setScrollCuesIn(true), 80);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (!exiting) return;
    const fadeMs = reduceMotion ? 200 : EXIT_FADE_MS;
    const t = window.setTimeout(onComplete, fadeMs);
    return () => window.clearTimeout(t);
  }, [exiting, reduceMotion, onComplete]);

  const applyPeelFromClientY = useCallback((clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaUp = d.startY - clientY;
    const next = Math.min(1, Math.max(0, d.peel0 + deltaUp / PEEL_THRESHOLD_PX));
    setPeel(next);
  }, []);

  const endDrag = useCallback(
    (clientY: number) => {
      const d = dragRef.current;
      dragRef.current = null;
      setScrubbing(false);
      if (!d || exiting || committedRef.current) return;

      const deltaUp = d.startY - clientY;
      const releasePeel = Math.min(1, Math.max(0, d.peel0 + deltaUp / PEEL_THRESHOLD_PX));

      if (releasePeel >= PEEL_COMMIT) {
        committedRef.current = true;
        setPeel(1);
        setVeilFull(true);
        onVeilFull?.();
        if (exitSequenceTimerRef.current != null) {
          window.clearTimeout(exitSequenceTimerRef.current);
          exitSequenceTimerRef.current = null;
        }
        exitSequenceTimerRef.current = window.setTimeout(() => {
          exitSequenceTimerRef.current = null;
          setExiting(true);
        }, VEIL_RAMP_TO_FULL_MS + HOLD_FULL_WHITE_MS);
      } else {
        setPeel(0);
      }
    },
    [exiting, onVeilFull]
  );

  const onEnvelopePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (exiting || committedRef.current || peelRef.current >= 1) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        peel0: peelRef.current,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
      setScrubbing(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    [exiting]
  );

  const onEnvelopePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      applyPeelFromClientY(e.clientY);
    },
    [applyPeelFromClientY]
  );

  const onEnvelopePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      endDrag(e.clientY);
    },
    [endDrag]
  );

  const onEnvelopeLostCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      endDrag(e.clientY);
    },
    [endDrag]
  );

  const gateStyle = useMemo(() => ({ "--peel": String(peel) }) as React.CSSProperties, [peel]);

  const scrollCuesVisible = scrollCuesIn && !scrubbing;
  const gateClass =
    `intro-letter-gate${reduceMotion ? " intro-letter-gate--reduced-motion" : ""}${scrubbing ? " intro-letter-gate--scrubbing" : ""}${veilFull ? " intro-letter-gate--veil-full" : ""}${exiting ? " intro-letter-gate--exiting" : ""}`;

  return (
    <div className={gateClass} style={gateStyle} role="presentation">
      <div className="intro-letter-gate__content">
        <div
          className={`intro-letter-gate__scroll-cues${scrollCuesVisible ? " intro-letter-gate__scroll-cues--visible" : ""}`}
          aria-hidden
        >
          <div className="intro-letter-gate__scroll-cue" data-hero-bw-tone={scrollCueTone}>
            <span className="intro-letter-gate__scroll-cue-box" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
        <div className="intro-letter-gate__inner">
          <div className="intro-letter-gate__envelope-wrap">
            <div
              className={`intro-letter-skin intro-letter-skin--gate-scale intro-letter-skin--close${scrubbing ? " intro-letter-gate__skin--scrub" : ""}`}
              role="group"
              aria-label="봉투를 위로 드래그해 여세요"
              onPointerDown={onEnvelopePointerDown}
              onPointerMove={onEnvelopePointerMove}
              onPointerUp={onEnvelopePointerUp}
              onPointerCancel={onEnvelopePointerUp}
              onLostPointerCapture={onEnvelopeLostCapture}
            >
              <div className="intro-letter-skin__pocket intro-letter-skin__front">
                <img src={INTRO_FOLDER_BODY_SRC} alt="" width={526} height={1082} decoding="async" draggable={false} />
              </div>
              <div className="intro-letter-skin__flap intro-letter-skin__front">
                <img src={INTRO_FOLDER_FLAP_SRC} alt="" width={526} height={1080} decoding="async" draggable={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="intro-letter-gate__white-veil" aria-hidden />
      {/* 콘텐츠 열 밖은 무대색 — 베일 위(포인터는 통과) */}
      <div className="intro-letter-gate__stage-chrome" aria-hidden>
        <div className="intro-letter-gate__stage-chrome-cutout" />
      </div>
    </div>
  );
}
