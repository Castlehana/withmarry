import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

const SAND_CYCLE_MS = 5000;
const SNAP_MS = 700;
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

/**
 * 스냅 직후 실제 각이 0° 또는 180°인지 확인하고, 부동소수 오차면 가장 가까운 안정 각으로 맞춤.
 */
function ensureStableOrientation(angleDeg: number): 0 | 180 {
  const n = norm360(angleDeg);
  if (n < 90 || n > 270) return 0;
  return 180;
}

/**
 * 이 SVG 기준: 0°일 때는 모래가 아래쪽(아래 방)에 쌓이고,
 * 180°로 뒤집으면 그 방이 화면 위로 오므로 "모래가 위에 있음"으로 본다.
 */
function isSandPileOnScreenTop(stable: 0 | 180): boolean {
  return stable === 180;
}

/** from → to 로 가장 짧은 각 차이(도) */
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

/** 180° 재생 시 로컬 path는 위→아래로 설계됨 → 화면에서 뒤집힌 유리에 맞게 Y 반전 */
const SAND_DRAIN_FLIP = "translate(50,50) scale(1,-1) translate(-50,-50)";

/** 모래+틀을 중심에서 살짝 축소해 틀 두께만 비율상 얇게(좌표 재작성 없이) */
const HOURGLASS_CONTENT_SCALE = 0.988;

/**
 * 회전 힌트(viewBox 0 0 24 26): 왼쪽 반원 + 아래 정삼각형에 가까운 화살.
 * 호 기하 하단(RH_BOTTOM)과 원심(RH_CX)에 밑변 중점을 맞춤 — 밑변 y는 스트로크 바깥선 기준.
 */
const RH_CX = 15.5;
const RH_CY = 11.5;
const RH_R = 8.25;
const RH_STROKE = 1.55;
const RH_TOP = RH_CY - RH_R;
const RH_BOTTOM = RH_CY + RH_R;
const RH_STROKE_OUTER_BELOW = RH_BOTTOM + RH_STROKE / 2;
const RH_TRI_GAP = 0.02;
/** 꼭짓점~밑변 거리 h일 때 정삼각형이면 반밑변 = h/√3 (너비 과한 느낌 방지) */
const RH_TRI_HEIGHT = 2.75;
const RH_TRI_HALF_W = RH_TRI_HEIGHT / Math.sqrt(3);
const RH_ARROW_Y_BASE = RH_STROKE_OUTER_BELOW + RH_TRI_GAP;
const RH_ARROW_Y_TIP = RH_ARROW_Y_BASE + RH_TRI_HEIGHT;
const RH_ARROW_XL = RH_CX - RH_TRI_HALF_W;
const RH_ARROW_XR = RH_CX + RH_TRI_HALF_W;

const ROTATE_HINT_ARC_D = `M ${RH_CX} ${RH_TOP} A ${RH_R} ${RH_R} 0 0 0 ${RH_CX} ${RH_BOTTOM}`;
const ROTATE_HINT_ARROW_POINTS = `${RH_CX},${RH_ARROW_Y_TIP.toFixed(3)} ${RH_ARROW_XL.toFixed(3)},${RH_ARROW_Y_BASE.toFixed(3)} ${RH_ARROW_XR.toFixed(3)},${RH_ARROW_Y_BASE.toFixed(3)}`;

/** 모래가 아래에 다 쌓인 뒤(애니메이션 종료) 고정 path — 로컬 좌표 기준 */
const SAND_TOP_REST = "M50,50,50,50,50,50,50,50,50,50Z";
const SAND_FALL_REST = "M49,50,49,78,51,78,51,50Z";
const SAND_BOTTOM_REST = "M66,68,66,78,34,78,34,68,50,50Z";

/**
 * 모래시계 SVG — 0° / 180°만 안정, 드래그 후 90° 기준 스냅.
 *
 * 상태 흐름:
 * 1. 기본: 애니메이션 마지막 프레임(정적 path) + 각도 0°
 * 2. 180°로 스냅되면: SMIL을 처음부터 1회 재생(각도 180° 유지)
 * 3. 재생 종료 후: 정적 path + 각도 0°로 즉시 복귀(회전 애니 없음)
 */
export function HourglassInteractive() {
  const uid = useId().replace(/:/g, "");
  const filterId = `granular-${uid}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [stableOrientation, setStableOrientation] = useState<0 | 180>(0);
  const [sandPileOnTop, setSandPileOnTop] = useState(false);
  const [sandKey, setSandKey] = useState(0);
  /** 180° 도착 직후 모래가 아래로 흐르는 SMIL 구간만 true (정적 1번과 분리) */
  const [sandDrainPlaying, setSandDrainPlaying] = useState(false);
  /** 포인터가 모래시계에 닿아 드래그 중(또는 누른 직후) */
  const [pointerOnHourglass, setPointerOnHourglass] = useState(false);
  /** 0↔180 스냅 보간 중 */
  const [snapAnimating, setSnapAnimating] = useState(false);

  const dragging = useRef(false);
  const lastAngleRef = useRef<number | null>(null);
  const isSnappingRef = useRef(false);
  const snapRafRef = useRef<number | null>(null);
  const prevStableRef = useRef<0 | 180>(0);
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  const sandCycleTimeoutRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /** React가 SMIL 노드를 붙인 뒤에도 일부 브라우저는 자동 시작이 안 됨 → beginElement */
  useLayoutEffect(() => {
    if (!sandDrainPlaying) return;
    const svg = svgRef.current;
    if (!svg) return;
    const id = requestAnimationFrame(() => {
      svg.querySelectorAll("animate").forEach((el) => {
        try {
          (el as SVGAnimateElement).beginElement();
        } catch {
          /* SMIL 미지원 등 */
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
    },
    [cancelSnap]
  );

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
      setSandKey((k) => k + 1);
      setSandDrainPlaying(true);
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
  }, []);

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
            <svg
              className="our-stroy__hourglass-rotate-hint__svg"
              width="24"
              height="26"
              viewBox="0 0 24 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                className="our-stroy__hourglass-rotate-hint__arc"
                d={ROTATE_HINT_ARC_D}
                stroke="currentColor"
                strokeWidth={RH_STROKE}
                strokeLinecap="round"
              />
              <polygon className="our-stroy__hourglass-rotate-hint__head" points={ROTATE_HINT_ARROW_POINTS} fill="currentColor" />
            </svg>
          </div>
          <div className="our-stroy__hourglass-rotate-hint our-stroy__hourglass-rotate-hint--right" aria-hidden>
            <svg
              className="our-stroy__hourglass-rotate-hint__svg"
              width="24"
              height="26"
              viewBox="0 0 24 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="translate(24,0) scale(-1,1)">
                <path
                  className="our-stroy__hourglass-rotate-hint__arc"
                  d={ROTATE_HINT_ARC_D}
                  stroke="currentColor"
                  strokeWidth={RH_STROKE}
                  strokeLinecap="round"
                />
                <polygon className="our-stroy__hourglass-rotate-hint__head" points={ROTATE_HINT_ARROW_POINTS} fill="currentColor" />
              </g>
            </svg>
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
          {/* 모래 → 몸체 순: 틀 뒤 레이어. 몸체는 evenodd로 내부가 비어 모래가 비침 */}
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
    </div>
  );
}
