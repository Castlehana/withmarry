import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./IntroLetterEnvelope.css";
import "./IntroLetterGate.css";

export type IntroLetterGateProps = {
  /** 인트로가 끝나고 본문으로 넘어갈 때 한 번 호출 */
  onComplete: () => void;
};

/** 이 거리(px)만큼 위로 끌면 `--peel` 이 1에 도달 — 스티커 상승량과 맞춤 */
const PEEL_THRESHOLD_PX = 792;
/** 이 비율 이상에서 손을 떼면 완전히 열림으로 확정 */
const PEEL_COMMIT = 0.5;

export function IntroLetterGate({ onComplete }: IntroLetterGateProps) {
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [peel, setPeel] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  /** 끝 프레임 후 1초: 살짝 확대 + 블러 */
  const [exitBloom, setExitBloom] = useState(false);
  const [exiting, setExiting] = useState(false);

  const peelRef = useRef(0);
  peelRef.current = peel;

  const dragRef = useRef<{ peel0: number; startY: number; pointerId: number } | null>(null);
  const committedRef = useRef(false);
  const exitBloomTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  /** 블룸 1초 후 게이트 페이드(기존) */
  const EXIT_BLOOM_MS = 1000;

  useEffect(
    () => () => {
      if (exitBloomTimerRef.current != null) {
        window.clearTimeout(exitBloomTimerRef.current);
        exitBloomTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!exiting) return;
    const fadeMs = reduceMotion ? 180 : 420;
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
        if (exitBloomTimerRef.current != null) window.clearTimeout(exitBloomTimerRef.current);
        if (reduceMotion) {
          setExiting(true);
        } else {
          setExitBloom(true);
          exitBloomTimerRef.current = window.setTimeout(() => {
            exitBloomTimerRef.current = null;
            setExiting(true);
          }, EXIT_BLOOM_MS);
        }
      } else {
        setPeel(0);
      }
    },
    [exiting, reduceMotion]
  );

  const onWaxPointerDown = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (exiting || committedRef.current || peelRef.current >= 1) return;
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

  const onWaxPointerMove = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      applyPeelFromClientY(e.clientY);
    },
    [applyPeelFromClientY]
  );

  const onWaxPointerUp = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
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

  const onWaxLostCapture = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      endDrag(e.clientY);
    },
    [endDrag]
  );

  const skinStyle = useMemo(
    () =>
      ({
        "--peel": String(peel),
      }) as React.CSSProperties,
    [peel]
  );

  return (
    <div
      className={`intro-letter-gate${exitBloom ? " intro-letter-gate--exit-bloom" : ""}${exiting ? " intro-letter-gate--exiting" : ""}`}
      role="presentation"
    >
      <div className="intro-letter-gate__content">
        <div className="intro-letter-gate__inner">
          <div className="intro-letter-gate__envelope-wrap">
            <div
              className={`intro-letter-skin intro-letter-skin--gate-scale intro-letter-skin--close${scrubbing ? " intro-letter-gate__skin--scrub" : ""}`}
              style={skinStyle}
            >
              <div className="intro-letter-skin__pocket intro-letter-skin__front" />
              <div className="intro-letter-skin__flap intro-letter-skin__front" />
              <img
                className={`intro-letter-gate__wax-seal${scrubbing ? " intro-letter-gate__wax-seal--grabbing" : ""}`}
                src={`${import.meta.env.BASE_URL}static/wax-seal-wm.png`}
                alt=""
                decoding="async"
                draggable={false}
                aria-label="실 스티커를 위로 드래그해 봉투를 여세요"
                onPointerDown={onWaxPointerDown}
                onPointerMove={onWaxPointerMove}
                onPointerUp={onWaxPointerUp}
                onPointerCancel={onWaxPointerUp}
                onLostPointerCapture={onWaxLostCapture}
              />
            </div>
          </div>
        </div>
      </div>
      {/* 콘텐츠 열 밖은 무대색 — 봉투·블룸보다 위(포인터는 통과) */}
      <div className="intro-letter-gate__stage-chrome" aria-hidden>
        <div className="intro-letter-gate__stage-chrome-cutout" />
      </div>
    </div>
  );
}
