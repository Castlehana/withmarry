import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { InterludeIllustrationFrames } from "./InterludeIllustrationFrames";
import { InterludePhotoFilm } from "./InterludePhotoFilm";
import { InterludeScriptSequence } from "./InterludeScriptSequence";
import { InterludeSoundWaveCanvas } from "./InterludeSoundWaveCanvas";

const SAND_CYCLE_MS = 5000;
const SNAP_MS = 700;
/** 모래 애니 시작 후 → 흰 페이드(2s) → 검 페이드(2s) → 인터루드 진입 */
const INTERLUDE_FLASH_AFTER_SAND_MS = 2000;
const INTERLUDE_FLASH_WHITE_MS = 2000;
const INTERLUDE_FLASH_BLACK_MS = 2000;
/** 스토리 페이지(인터루드) 마운트 후 첫 페이드(일러스트) 시작까지 */
const INTERLUDE_REVEAL_ART_DELAY_MS = 1000;
/** 일러스트 → 포토 → 웨이브 각 시작 사이 간격(페이드 길이는 CSS 1.5s 애니메이션) */
const INTERLUDE_REVEAL_STAGGER_MS = 1000;
/** 웨이브(phase 3) 시작 후 대본·음원 시퀀스까지 대기 */
const INTERLUDE_SCRIPT_AFTER_WAVE_MS = 1000;
/** 인터루드 닫기: 검게 덮기 → 본문으로(각 2s) */
const INTERLUDE_EXIT_TO_BLACK_MS = 2000;
const INTERLUDE_EXIT_FROM_BLACK_MS = 2000;

/** 인터루드: 본문 숨김 | 닫기: 검은 레이어 페이드아웃과 함께 본문 페이드인 */
export type HourglassInterludeShellMode = "normal" | "interlude" | "exit-reveal";

export type HourglassInteractiveProps = {
  /** 모래 흐름·인터루드 동안 스크롤 잠금 */
  onScrollLockChange?: (locked: boolean) => void;
  /** Our Story 셸: `exit-reveal`일 때 본문·헤더를 레이어와 동시에 서서히 표시 */
  onInterludePageChange?: (mode: HourglassInterludeShellMode) => void;
};

/** 1번(0° 안정)으로 볼 각 허용 오차 — 이보다 벗어나면 회전 힌트 숨김 */
const ROTATE_HINT_DEG_EPS = 1.25;

function norm360(r: number): number {
  return ((r % 360) + 360) % 360;
}

/** 드래그 종료 시 스냅 목표: 0° 또는 180° */
function pickStableTarget(rotationDeg: number): 0 | 180 {
  const n = norm360(rotationDeg);
  if (n < 90 || n > 270) return 0;
  return 180;
}

function ensureStableOrientation(angleDeg: number): 0 | 180 {
  const n = norm360(angleDeg);
  if (n < 90 || n > 270) return 0;
  return 180;
}

function isSandPileOnScreenTop(stable: 0 | 180): boolean {
  return stable === 180;
}

function shortestDiffDeg(from: number, to: number): number {
  const nf = norm360(from);
  const nt = norm360(to);
  let d = nt - nf;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

const SAND_DRAIN_FLIP = "translate(50,50) scale(1,-1) translate(-50,-50)";
const HOURGLASS_CONTENT_SCALE = 0.988;

const ROTATE_HINT_IMG = `${import.meta.env.BASE_URL}static/그림1.svg`;
const OUR_STORY_STATIC = `${import.meta.env.BASE_URL}static/${encodeURIComponent("Our Story")}/main_page`;
/** 인터루드 중앙 일러스트 뒤 배경 레이어(back.png) — z-index는 일러스트·웨이브보다 낮음 */
const OUR_STORY_BACK_IMG = `${OUR_STORY_STATIC}/back.png`;

const SAND_TOP_REST = "M50,50,50,50,50,50,50,50,50,50Z";
const SAND_FALL_REST = "M49,50,49,78,51,78,51,50Z";
const SAND_BOTTOM_REST = "M66,68,66,78,34,78,34,68,50,50Z";

export function HourglassInteractive({ onScrollLockChange, onInterludePageChange }: HourglassInteractiveProps = {}) {
  const uid = useId().replace(/:/g, "");
  const filterId = `granular-${uid}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [stableOrientation, setStableOrientation] = useState<0 | 180>(0);
  const [sandPileOnTop, setSandPileOnTop] = useState(false);
  const [sandKey, setSandKey] = useState(0);
  const [sandDrainPlaying, setSandDrainPlaying] = useState(false);
  const [pointerOnHourglass, setPointerOnHourglass] = useState(false);
  const [snapAnimating, setSnapAnimating] = useState(false);
  /** Our Story 인터루드 본문(플래시 시퀀스 끝에 열림) */
  const [interludeOpen, setInterludeOpen] = useState(false);
  /** 흰/검 전체 화면 플래시: off | white | black */
  const [transitionFlash, setTransitionFlash] = useState<"off" | "white" | "black">("off");
  /** 0=숨김, 1=일러스트, 2=+포토, 3=+웨이브 */
  const [interludeRevealPhase, setInterludeRevealPhase] = useState(0);
  /** 닫기 시: toBlack(검은 페이드 인) → fromBlack(검은 페이드 아웃) */
  const [interludeExitPhase, setInterludeExitPhase] = useState<"off" | "toBlack" | "fromBlack">("off");
  /** 웨이브 등장(phase≥3) 후 INTERLUDE_SCRIPT_AFTER_WAVE_MS 경과 시 대본 fetch·표시 */
  const [interludeScriptGateOpen, setInterludeScriptGateOpen] = useState(false);
  /** 대본 .wav → AnalyserNode(웨이브 캔버스와 공유) */
  const interludeWaveAnalyserRef = useRef<AnalyserNode | null>(null);
  /** true일 때만 웨이브 위상 진행 + RMS 연동 — 재생 없음/대기 구간에서는 false(정지) */
  const interludeWavActiveRef = useRef(false);

  const dragging = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const isSnappingRef = useRef(false);
  const snapRafRef = useRef<number | null>(null);
  const prevStableRef = useRef<0 | 180>(0);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  const sandCycleTimeoutRef = useRef<number | null>(null);
  const transitionFlashTimeoutsRef = useRef<number[]>([]);
  const interludeRevealTimeoutsRef = useRef<number[]>([]);
  const interludeExitTimeoutsRef = useRef<number[]>([]);

  const svgRef = useRef<SVGSVGElement>(null);

  const clearTransitionFlashTimeouts = useCallback(() => {
    transitionFlashTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    transitionFlashTimeoutsRef.current = [];
  }, []);

  const clearInterludeRevealTimeouts = useCallback(() => {
    interludeRevealTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    interludeRevealTimeoutsRef.current = [];
  }, []);

  const clearInterludeExitTimeouts = useCallback(() => {
    interludeExitTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    interludeExitTimeoutsRef.current = [];
  }, []);

  useLayoutEffect(() => {
    if (!sandDrainPlaying) return;
    const svg = svgRef.current;
    if (!svg) return;
    const id = requestAnimationFrame(() => {
      svg.querySelectorAll("animate").forEach((el) => {
        try {
          (el as SVGAnimateElement).beginElement();
        } catch {
          /* noop */
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [sandDrainPlaying, sandKey]);

  const clientAngle = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  }, []);

  const cancelSnap = useCallback(() => {
    if (snapRafRef.current != null) {
      cancelAnimationFrame(snapRafRef.current);
      snapRafRef.current = null;
    }
    isSnappingRef.current = false;
    setSnapAnimating(false);
  }, []);

  useEffect(
    () => () => {
      cancelSnap();
      if (sandCycleTimeoutRef.current != null) {
        window.clearTimeout(sandCycleTimeoutRef.current);
        sandCycleTimeoutRef.current = null;
      }
      transitionFlashTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      transitionFlashTimeoutsRef.current = [];
      interludeRevealTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      interludeRevealTimeoutsRef.current = [];
      interludeExitTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      interludeExitTimeoutsRef.current = [];
    },
    [cancelSnap]
  );

  useEffect(() => {
    const locked =
      sandDrainPlaying || interludeOpen || transitionFlash !== "off" || interludeExitPhase !== "off";
    onScrollLockChange?.(locked);
    return () => onScrollLockChange?.(false);
  }, [sandDrainPlaying, interludeOpen, transitionFlash, interludeExitPhase, onScrollLockChange]);

  useEffect(() => {
    const mode: HourglassInterludeShellMode =
      interludeExitPhase === "fromBlack"
        ? "exit-reveal"
        : interludeOpen || interludeExitPhase === "toBlack"
          ? "interlude"
          : "normal";
    onInterludePageChange?.(mode);
    return () => onInterludePageChange?.("normal");
  }, [interludeOpen, interludeExitPhase, onInterludePageChange]);

  const dismissInterlude = useCallback(() => {
    if (interludeExitPhase !== "off" || !interludeOpen) return;
    clearTransitionFlashTimeouts();
    clearInterludeRevealTimeouts();
    clearInterludeExitTimeouts();
    setTransitionFlash("off");
    /* toBlack 구간에는 reveal phase 유지(0이면 일러스트·포토가 즉시 opacity 0으로 떨어져 검은 셸만 보임) */
    setInterludeExitPhase("toBlack");
    const tClose = window.setTimeout(() => {
      setInterludeOpen(false);
      setInterludeExitPhase("fromBlack");
    }, INTERLUDE_EXIT_TO_BLACK_MS);
    const tDone = window.setTimeout(() => {
      setInterludeExitPhase("off");
      interludeExitTimeoutsRef.current = [];
    }, INTERLUDE_EXIT_TO_BLACK_MS + INTERLUDE_EXIT_FROM_BLACK_MS);
    interludeExitTimeoutsRef.current = [tClose, tDone];
  }, [
    clearInterludeExitTimeouts,
    clearInterludeRevealTimeouts,
    clearTransitionFlashTimeouts,
    interludeExitPhase,
    interludeOpen,
  ]);

  /** 인터루드가 열린 뒤 일러스트 → 포토 → 웨이브 순으로 페이드 인 */
  useEffect(() => {
    clearInterludeRevealTimeouts();
    if (!interludeOpen) {
      setInterludeRevealPhase(0);
      return;
    }
    setInterludeRevealPhase(0);
    const t1 = window.setTimeout(() => setInterludeRevealPhase(1), INTERLUDE_REVEAL_ART_DELAY_MS);
    const t2 = window.setTimeout(
      () => setInterludeRevealPhase(2),
      INTERLUDE_REVEAL_ART_DELAY_MS + INTERLUDE_REVEAL_STAGGER_MS
    );
    const t3 = window.setTimeout(
      () => setInterludeRevealPhase(3),
      INTERLUDE_REVEAL_ART_DELAY_MS + INTERLUDE_REVEAL_STAGGER_MS * 2
    );
    interludeRevealTimeoutsRef.current = [t1, t2, t3];
    return () => clearInterludeRevealTimeouts();
  }, [interludeOpen, clearInterludeRevealTimeouts]);

  useEffect(() => {
    setInterludeScriptGateOpen(false);
    if (!interludeOpen) return;
    if (interludeRevealPhase < 3) return;
    const t = window.setTimeout(() => setInterludeScriptGateOpen(true), INTERLUDE_SCRIPT_AFTER_WAVE_MS);
    return () => window.clearTimeout(t);
  }, [interludeOpen, interludeRevealPhase]);

  const applyResolvedStable = useCallback((rawAngle: number, prevStable: 0 | 180) => {
    const verified = ensureStableOrientation(rawAngle);
    setRotation(verified);
    setStableOrientation(verified);
    const pileTop = isSandPileOnScreenTop(verified);
    setSandPileOnTop(pileTop);

    const orientationChanged = verified !== prevStable;
    if (orientationChanged && pileTop) {
      if (sandCycleTimeoutRef.current != null) {
        window.clearTimeout(sandCycleTimeoutRef.current);
        sandCycleTimeoutRef.current = null;
      }
      clearTransitionFlashTimeouts();
      clearInterludeExitTimeouts();
      setInterludeExitPhase("off");
      setTransitionFlash("off");
      setInterludeOpen(false);
      setInterludeRevealPhase(0);

      setSandKey((k) => k + 1);
      setSandDrainPlaying(true);

      const tOpen =
        INTERLUDE_FLASH_AFTER_SAND_MS + INTERLUDE_FLASH_WHITE_MS + INTERLUDE_FLASH_BLACK_MS;
      const tWhite = window.setTimeout(() => setTransitionFlash("white"), INTERLUDE_FLASH_AFTER_SAND_MS);
      const tBlack = window.setTimeout(
        () => setTransitionFlash("black"),
        INTERLUDE_FLASH_AFTER_SAND_MS + INTERLUDE_FLASH_WHITE_MS
      );
      const tInterlude = window.setTimeout(() => {
        /* 인터루드를 먼저 마운트한 뒤 검은 플래시를 걷어야 한 프레임도 본문이 비치지 않음 */
        setInterludeOpen(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionFlash("off"));
        });
      }, tOpen);
      transitionFlashTimeoutsRef.current = [tWhite, tBlack, tInterlude];

      sandCycleTimeoutRef.current = window.setTimeout(() => {
        sandCycleTimeoutRef.current = null;
        setSandDrainPlaying(false);
        setRotation(0);
        setStableOrientation(0);
        setSandPileOnTop(false);
        prevStableRef.current = 0;
        rotationRef.current = 0;
      }, SAND_CYCLE_MS);
    }
    prevStableRef.current = verified;
  }, [clearInterludeExitTimeouts, clearTransitionFlashTimeouts]);

  const startSnapTo = useCallback(
    (target: 0 | 180, from: number) => {
      cancelSnap();
      if (Math.abs(shortestDiffDeg(from, target)) < 0.01) {
        applyResolvedStable(target, prevStableRef.current);
        return;
      }
      isSnappingRef.current = true;
      setSnapAnimating(true);
      const diff = shortestDiffDeg(from, target);
      const start = performance.now();
      const prevAtStart = prevStableRef.current;

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / SNAP_MS);
        const eased = easeOutCubic(t);
        setRotation(from + diff * eased);
        if (t < 1) {
          snapRafRef.current = requestAnimationFrame(tick);
        } else {
          snapRafRef.current = null;
          isSnappingRef.current = false;
          setSnapAnimating(false);
          applyResolvedStable(target, prevAtStart);
        }
      };
      snapRafRef.current = requestAnimationFrame(tick);
    },
    [applyResolvedStable, cancelSnap]
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (sandDrainPlaying || isSnappingRef.current) return;
    e.preventDefault();
    dragging.current = true;
    setPointerOnHourglass(true);
    lastAngleRef.current = clientAngle(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || lastAngleRef.current === null || sandDrainPlaying || isSnappingRef.current) return;
    const a = clientAngle(e.clientX, e.clientY);
    let d = a - lastAngleRef.current;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    setRotation((prev) => prev + d);
    lastAngleRef.current = a;
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      return;
    }
    dragging.current = false;
    setPointerOnHourglass(false);
    lastAngleRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    if (sandDrainPlaying || isSnappingRef.current) return;

    const from = rotationRef.current;
    const target = pickStableTarget(from);
    startSnapTo(target, from);
  };

  const nRot = norm360(rotation);
  const atRestZero =
    nRot < ROTATE_HINT_DEG_EPS || nRot > 360 - ROTATE_HINT_DEG_EPS;
  const showRotateHint =
    !sandDrainPlaying && atRestZero && !pointerOnHourglass && !snapAnimating;

  const interludeStackRevealClass =
    interludeRevealPhase >= 1 ? "hourglass-flash-overlay__interlude-stack--reveal-art" : "";
  const interludeStackRevealPhoto =
    interludeRevealPhase >= 2 ? "hourglass-flash-overlay__interlude-stack--reveal-photo" : "";
  const interludeStackRevealWave =
    interludeRevealPhase >= 3 ? "hourglass-flash-overlay__interlude-stack--reveal-wave" : "";

  const flashPortal =
    transitionFlash !== "off" && typeof document !== "undefined" ? (
      <div className="hourglass-transition-flash" role="presentation" aria-hidden>
        {(transitionFlash === "white" || transitionFlash === "black") && (
          <div
            className={`hourglass-transition-flash__layer hourglass-transition-flash__layer--white${
              transitionFlash === "black" ? " hourglass-transition-flash__layer--solid" : ""
            }`}
          />
        )}
        {transitionFlash === "black" && (
          <div className="hourglass-transition-flash__layer hourglass-transition-flash__layer--black" />
        )}
      </div>
    ) : null;

  const exitFlashPortal =
    interludeExitPhase !== "off" && typeof document !== "undefined" ? (
      <div
        className="hourglass-transition-flash hourglass-transition-flash--interlude-exit"
        role="presentation"
        aria-hidden
      >
        {interludeExitPhase === "toBlack" && (
          <div className="hourglass-transition-flash__layer hourglass-transition-flash__layer--interlude-exit-to-black" />
        )}
        {interludeExitPhase === "fromBlack" && (
          <div className="hourglass-transition-flash__layer hourglass-transition-flash__layer--interlude-exit-from-black" />
        )}
      </div>
    ) : null;

  const interludePortal =
    interludeOpen && typeof document !== "undefined" ? (
      <div
        className="hourglass-flash-overlay hourglass-flash-overlay--interlude-page"
        role="presentation"
      >
        <div className="hourglass-flash-overlay__gutter hourglass-flash-overlay__gutter--left" aria-hidden />
        <div
          className="hourglass-flash-overlay__shell-column hourglass-interlude-page"
          role="document"
          aria-label="Our Story"
        >
          <div className="hourglass-flash-overlay__shell hourglass-flash-overlay__shell--solid-black">
            <div className="hourglass-flash-overlay__panel hourglass-flash-overlay__panel--interlude" role="dialog" aria-modal="true" aria-labelledby={`hourglass-interlude-title-${uid}`}>
              <p id={`hourglass-interlude-title-${uid}`} className="hourglass-flash-overlay__sr-only">
                Our Story
              </p>
              <button
                type="button"
                className="hourglass-flash-overlay__back hourglass-flash-overlay__back--icon hourglass-flash-overlay__back--interlude-fade-in"
                onClick={dismissInterlude}
                aria-label="홈으로 돌아가기"
              >
                <svg
                  className="hourglass-flash-overlay__back-home-icon"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  aria-hidden
                >
                  <path
                    fill="currentColor"
                    d="M12 3.8 4.5 10.2V20h4v-6.5h7V20h4V10.2L12 3.8z"
                  />
                </svg>
              </button>
              <div
                className={`hourglass-flash-overlay__interlude-stack ${interludeStackRevealClass} ${interludeStackRevealPhoto} ${interludeStackRevealWave}`.trim()}
              >
                <div className="hourglass-flash-overlay__interlude-bg" aria-hidden>
                  <InterludePhotoFilm src={OUR_STORY_BACK_IMG} alt="" />
                </div>
                <div className="hourglass-flash-overlay__interlude-art">
                  <InterludeIllustrationFrames baseUrl={OUR_STORY_STATIC} active={interludeOpen} />
                </div>
                <InterludeSoundWaveCanvas
                  waveAnalyserRef={interludeWaveAnalyserRef}
                  wavActiveRef={interludeWavActiveRef}
                />
                <InterludeScriptSequence
                  interludeOpen={interludeOpen}
                  scriptGateOpen={interludeScriptGateOpen}
                  baseUrl={OUR_STORY_STATIC}
                  waveAnalyserRef={interludeWaveAnalyserRef}
                  wavActiveRef={interludeWavActiveRef}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="hourglass-flash-overlay__gutter hourglass-flash-overlay__gutter--right" aria-hidden />
      </div>
    ) : null;

  return (
    <div
      ref={wrapRef}
      className={`our-stroy__hourglass${sandDrainPlaying ? " our-stroy__hourglass--locked" : ""}`}
      data-stable-orientation={stableOrientation}
      data-sand-pile-on-top={sandPileOnTop ? "true" : "false"}
      aria-label="모래시계. 드래그하여 0도와 180도 사이로 돌릴 수 있습니다."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {showRotateHint ? (
        <>
          <div className="our-stroy__hourglass-rotate-hint our-stroy__hourglass-rotate-hint--left" aria-hidden>
            <img className="our-stroy__hourglass-rotate-hint__img" src={ROTATE_HINT_IMG} alt="" width="573" height="963" decoding="async" />
          </div>
          <div className="our-stroy__hourglass-rotate-hint our-stroy__hourglass-rotate-hint--right" aria-hidden>
            <img className="our-stroy__hourglass-rotate-hint__img" src={ROTATE_HINT_IMG} alt="" width="573" height="963" decoding="async" />
          </div>
        </>
      ) : null}
      <svg
        ref={svgRef}
        width="100"
        height="100"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="our-stroy__hourglass-svg"
        aria-hidden
      >
        <filter id={filterId}>
          <feGaussianBlur in="SourceGraphic" result="blur_init" stdDeviation="0.05" />
          <feTurbulence
            type="turbulence"
            result="granular_turbulance_out"
            numOctaves="1"
            baseFrequency="20"
          >
            {sandDrainPlaying ? (
              <animate
                attributeName="baseFrequency"
                dur="5s"
                repeatCount="1"
                fill="freeze"
                begin="indefinite"
                values="20; 21"
                keyTimes="0; 1"
              />
            ) : null}
          </feTurbulence>
          <feDisplacementMap
            in="blur_init"
            in2="granular_turbulance_out"
            scale="1"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displacement_map_out"
          />
          <feGaussianBlur in="displacement_map_out" stdDeviation="0.05" />
        </filter>
        <g className="hourglass" transform={`rotate(${rotation} 50 50)`}>
          <g transform={`translate(50 50) scale(${HOURGLASS_CONTENT_SCALE}) translate(-50 -50)`}>
          {sandDrainPlaying ? (
            <g key={sandKey} transform={SAND_DRAIN_FLIP}>
              <path
                className="hourglass__sand hourglass__sand--top"
                d="M34,32,34,22,66,22,66,32,50,50Z"
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              >
                <animate
                  attributeName="d"
                  attributeType="XML"
                  dur="5s"
                  repeatCount="1"
                  fill="freeze"
                  begin="indefinite"
                  values="M34,32,34,22,66,22,66,32,50,50Z;M34,32,34,32,66,32,66,32,50,50Z;M50,50,50,50,50,50,50,50,50,50Z;M50,50,50,50,50,50,50,50,50,50Z"
                  keyTimes="0; 0.4; 0.8; 1"
                />
              </path>
              <path
                className="hourglass__sand hourglass__sand--falling"
                d="M49.75,50,49.75,78,50.25,78,50.25,50Z"
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              >
                <animate
                  attributeName="d"
                  attributeType="XML"
                  dur="5s"
                  repeatCount="1"
                  fill="freeze"
                  begin="indefinite"
                  values="M49,50,49,50,51,50,51,50Z;M49,50,49,78,51,78,51,50Z;M49,50,49,78,51,78,51,50Z"
                  keyTimes="0; 0.05; 1"
                />
              </path>
              <path
                className="hourglass__sand hourglass__sand--bottom"
                d="M66,78,66,78,34,78,34,78,50,78Z"
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              >
                <animate
                  attributeName="d"
                  attributeType="XML"
                  dur="5s"
                  repeatCount="1"
                  fill="freeze"
                  begin="indefinite"
                  values="M66,78,66,78,34,78,34,78,50,78Z;M66,78,66,78,34,78,34,78,50,60Z;M66,68,66,78,34,78,34,68,50,50Z;M66,68,66,78,34,78,34,68,50,50Z"
                  keyTimes="0; 0.4; 0.8; 1"
                />
              </path>
            </g>
          ) : (
            <g>
              <path
                className="hourglass__sand hourglass__sand--top"
                d={SAND_TOP_REST}
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              />
              <path
                className="hourglass__sand hourglass__sand--falling"
                d={SAND_FALL_REST}
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              />
              <path
                className="hourglass__sand hourglass__sand--bottom"
                d={SAND_BOTTOM_REST}
                fill="#ea8ba8"
                filter={`url(#${filterId})`}
              />
            </g>
          )}
          <path
            className="hourglass__body"
            fillRule="evenodd"
            d="M30.313,20c-1.561,0 -2.813,1.254 -2.813,2.813c-0,1.56 1.252,2.812 2.812,2.812l0.938,0l-0,2.227c-0,4.724 1.875,9.257 5.215,12.597l9.562,9.551l-9.562,9.551c-3.34,3.34 -5.215,7.875 -5.215,12.597l-0,2.227l-0.938,0c-1.56,0 -2.812,1.254 -2.812,2.813c-0,1.56 1.252,2.812 2.812,2.812l39.375,0c1.559,0 2.813,-1.252 2.813,-2.813c-0,-1.558 -1.254,-2.812 -2.813,-2.812l-0.937,0l-0,-2.227c-0,-4.722 -1.875,-9.257 -5.215,-12.597l-9.563,-9.551l9.55,-9.551c3.353,-3.34 5.228,-7.873 5.228,-12.597l0,-2.227l0.938,0c1.558,0 2.812,-1.252 2.812,-2.812c0,-1.559 -1.254,-2.813 -2.813,-2.813l-39.375,0Zm19.688,33.973l9.551,9.551c2.285,2.296 3.574,5.391 3.574,8.624l0,2.227l-26.25,0l0,-2.227c0,-3.233 1.289,-6.328 3.574,-8.613l9.551,-9.562Zm0,-7.957l-9.551,-9.551c-2.285,-2.285 -3.574,-5.378 -3.574,-8.613l0,-2.227l26.25,0l0,2.227c0,3.235 -1.289,6.328 -3.574,8.613l-9.551,9.563l0,-0.012Z"
            fill="#dcc9b6"
          />
          </g>
        </g>
      </svg>
      {flashPortal ? createPortal(flashPortal, document.body) : null}
      {exitFlashPortal ? createPortal(exitFlashPortal, document.body) : null}
      {interludePortal ? createPortal(interludePortal, document.body) : null}
    </div>
  );
}
