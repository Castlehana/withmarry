import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type ClipboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { InterludeFireflyBackground } from "./InterludeFireflyBackground";
import { InterludeIllustrationFrames } from "./InterludeIllustrationFrames";
import { InterludePhotoFilm } from "./InterludePhotoFilm";
import { InterludeFlash } from "./InterludeFlash";
import { InterludeScriptSequence } from "./InterludeScriptSequence";
import { InterludeSoundWaveCanvas } from "./InterludeSoundWaveCanvas";
import { parseOurStoryPagesManifest, type OurStoryPage } from "./ourStoryPages";

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
/** 스토리 BGM 페이드(진입·toBlack 퇴장과 동일 2s) */
const INTERLUDE_BGM_FADE_MS = 2000;
/** BGM 안정 시 `HTMLMediaElement.volume`(0~1), 1 = 풀 레벨 */
const INTERLUDE_BGM_STEADY_LINEAR = 1;
/** 대본 mp3: 홈·커튼 시 검은 페이드(toBlack)와 비슷한 길이로 서서히 — 언마운트 직전에 끝나도록 exit보다 약간 짧게 */
const INTERLUDE_SCRIPT_FADE_OUT_MS = Math.max(1400, INTERLUDE_EXIT_TO_BLACK_MS - 300);
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
/** `Our Story` 하위 폴더별 페이지 — `_chapters.json`은 빌드/개발 시 스크립트로 생성 */
const OUR_STORY_ROOT = `${import.meta.env.BASE_URL}static/${encodeURIComponent("Our Story")}`;
const OUR_STORY_PAGES_URL = `${OUR_STORY_ROOT}/our-story-pages.txt`;
const CHAPTERS_MANIFEST_URL = `${OUR_STORY_ROOT}/_chapters.json`;
const INTERLUDE_BGM_URL = `${OUR_STORY_ROOT}/backgroundbgm.mp3`;
/** 대본 종료 후 홈 버튼 위 탭 힌트(정적 PNG) */
const INTERLUDE_HOME_TAP_HINT_SVG = `${import.meta.env.BASE_URL}static/our-story/interlude-home-tap-hint.svg`;

const SAND_TOP_REST = "M50,50,50,50,50,50,50,50,50,50Z";
const SAND_FALL_REST = "M49,50,49,78,51,78,51,50Z";
const SAND_BOTTOM_REST = "M66,68,66,78,34,78,34,68,50,50Z";

export function HourglassInteractive({
  onScrollLockChange,
  onInterludePageChange,
}: HourglassInteractiveProps = {}) {
  const uid = useId().replace(/:/g, "");
  const filterId = `granular-${uid}`;

  const [ourStoryPages, setOurStoryPages] = useState<OurStoryPage[]>([]);
  const [ourStoryChapterIndex, setOurStoryChapterIndex] = useState(0);
  /** 다음: 오른쪽→왼쪽으로 덮는 커튼 · 이전: 왼쪽→오른쪽 — 끝난 뒤 챕터만 전환(슬라이드 진입 없음) */
  const [ourStoryCurtain, setOurStoryCurtain] = useState<null | "next" | "prev">(null);
  const ourStoryCurtainDirRef = useRef<null | "next" | "prev">(null);
  const prevOurStoryChapterForSnapRef = useRef(0);
  const interludeSwipeRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  /** 대본·일러·웨이브 등 인터루드 미디어를 매 세션/챕터마다 처음부터 — `key`로 리마운트 */
  const [ourStoryPlaybackEpoch, setOurStoryPlaybackEpoch] = useState(0);

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
  /** 0=숨김, 1=일러스트, 2=+포토, 3=+웨이브 — 순서대로 등장 */
  const [interludeRevealPhase, setInterludeRevealPhase] = useState(0);
  /** 닫기 시: toBlack(검은 페이드 인) → fromBlack(검은 페이드 아웃) */
  const [interludeExitPhase, setInterludeExitPhase] = useState<"off" | "toBlack" | "fromBlack">("off");
  /** 웨이브 등장(phase≥3) 후 INTERLUDE_SCRIPT_AFTER_WAVE_MS 경과 시 대본 표시 */
  const [interludeScriptGateOpen, setInterludeScriptGateOpen] = useState(false);
  /** 대본 mp3 서서히 줄이기 — `id` 증가마다 `InterludeScriptSequence`에서 한 번 적용 */
  const [scriptAudioFadeRequest, setScriptAudioFadeRequest] = useState<{
    id: number;
    durationMs: number;
  } | null>(null);
  /** 현재 챕터 대본 시퀀스가 끝난 뒤(홈 위 탭 힌트 표시) */
  const [interludeScriptFinished, setInterludeScriptFinished] = useState(false);
  /** 홈 클릭 시 반딧불이 레이어 페이드아웃(`App.css` --fade-out 과 동일 시간 권장) */
  const [interludeFireflyFadeOut, setInterludeFireflyFadeOut] = useState(false);
  /** 대본 mp3 → AnalyserNode(웨이브 캔버스와 공유) */
  const interludeWaveAnalyserRef = useRef<AnalyserNode | null>(null);
  /** true일 때만 웨이브 위상 진행 + RMS 연동 — 재생 없음/대기 구간에서는 false(정지) */
  const interludeWavActiveRef = useRef(false);
  const storyBgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const storyBgmFadeRafRef = useRef<number | null>(null);
  const storyBgmFadeTokenRef = useRef(0);

  const storyPageBase = useMemo(() => {
    if (!ourStoryPages.length) {
      return `${OUR_STORY_ROOT}/${encodeURIComponent("main_page")}`.replace(/\/$/, "");
    }
    const idx = Math.min(Math.max(0, ourStoryChapterIndex), ourStoryPages.length - 1);
    return `${OUR_STORY_ROOT}/${encodeURIComponent(ourStoryPages[idx]!.folder)}`.replace(/\/$/, "");
  }, [ourStoryPages, ourStoryChapterIndex]);

  const interludeScriptLines = useMemo(() => {
    if (!ourStoryPages.length) return [];
    const idx = Math.min(Math.max(0, ourStoryChapterIndex), ourStoryPages.length - 1);
    return ourStoryPages[idx]?.lines ?? [];
  }, [ourStoryPages, ourStoryChapterIndex]);

  /** 마지막 챕터: 홈 힌트는 손가락 대신 아래 화살표 + 상하 보링 */
  const ourStoryIsLastChapter = useMemo(
    () => ourStoryPages.length > 0 && ourStoryChapterIndex >= ourStoryPages.length - 1,
    [ourStoryPages.length, ourStoryChapterIndex]
  );

  const ourStoryBackImg = `${storyPageBase}/back.png`;

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

  /** 전환 플래시·인터루드·닫기·모래 구간 — 모래시계 드래그 불가 */
  const interactionFrozen = useMemo(
    () =>
      sandDrainPlaying ||
      transitionFlash !== "off" ||
      interludeOpen ||
      interludeExitPhase !== "off",
    [sandDrainPlaying, transitionFlash, interludeOpen, interludeExitPhase]
  );

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setOurStoryPlaybackEpoch((n) => n + 1);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!interactionFrozen) return;
    dragging.current = false;
    setPointerOnHourglass(false);
    lastAngleRef.current = null;
  }, [interactionFrozen]);

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

  const cancelStoryBgmFade = useCallback(() => {
    storyBgmFadeTokenRef.current += 1;
    if (storyBgmFadeRafRef.current != null) {
      cancelAnimationFrame(storyBgmFadeRafRef.current);
      storyBgmFadeRafRef.current = null;
    }
  }, []);

  const bumpScriptAudioFade = useCallback((durationMs: number) => {
    setScriptAudioFadeRequest((prev) => ({
      id: (prev?.id ?? 0) + 1,
      durationMs,
    }));
  }, []);

  const onInterludeScriptFinished = useCallback((finished: boolean) => {
    setInterludeScriptFinished(finished);
  }, []);

  const fadeStoryBgmVolume = useCallback((from: number, to: number, durationMs: number) => {
    if (storyBgmFadeRafRef.current != null) {
      cancelAnimationFrame(storyBgmFadeRafRef.current);
      storyBgmFadeRafRef.current = null;
    }
    const myId = (storyBgmFadeTokenRef.current += 1);
    const audio = storyBgmAudioRef.current;
    if (!audio) return;
    const start = performance.now();
    const tick = (now: number) => {
      if (myId !== storyBgmFadeTokenRef.current) return;
      const t = Math.min(1, (now - start) / durationMs);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) {
        storyBgmFadeRafRef.current = requestAnimationFrame(tick);
      } else {
        storyBgmFadeRafRef.current = null;
      }
    };
    storyBgmFadeRafRef.current = requestAnimationFrame(tick);
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
    if (!interludeOpen) setInterludeScriptFinished(false);
  }, [interludeOpen]);

  useEffect(() => {
    if (interludeOpen) setInterludeFireflyFadeOut(false);
  }, [interludeOpen]);

  /* 페인트 전에 셸 모드 반영 — 인터루드 1프레임에 본문이 클릭되지 않도록 */
  useLayoutEffect(() => {
    const mode: HourglassInterludeShellMode =
      interludeExitPhase === "fromBlack"
        ? "exit-reveal"
        : interludeOpen || interludeExitPhase === "toBlack"
          ? "interlude"
          : "normal";
    onInterludePageChange?.(mode);
    return () => onInterludePageChange?.("normal");
  }, [interludeOpen, interludeExitPhase, onInterludePageChange]);

  /** 스토리 인터루드 BGM: 진입 시 서서히 풀 볼륨, toBlack 시 서서히 제거 */
  useEffect(() => {
    if (interludeExitPhase === "toBlack") {
      const el = storyBgmAudioRef.current;
      const from = el != null ? el.volume : INTERLUDE_BGM_STEADY_LINEAR;
      fadeStoryBgmVolume(from, 0, INTERLUDE_BGM_FADE_MS);
      return;
    }
    if (!interludeOpen) {
      cancelStoryBgmFade();
      const el = storyBgmAudioRef.current;
      if (el) {
        el.pause();
        el.volume = 0;
      }
      return;
    }
    let el = storyBgmAudioRef.current;
    if (!el) {
      el = new Audio(INTERLUDE_BGM_URL);
      el.loop = true;
      el.preload = "auto";
      storyBgmAudioRef.current = el;
    }
    el.currentTime = 0;
    el.volume = 0;
    void el.play().catch(() => {});
    fadeStoryBgmVolume(0, INTERLUDE_BGM_STEADY_LINEAR, INTERLUDE_BGM_FADE_MS);
  }, [interludeOpen, interludeExitPhase, cancelStoryBgmFade, fadeStoryBgmVolume]);

  useEffect(
    () => () => {
      cancelStoryBgmFade();
      storyBgmAudioRef.current?.pause();
      if (storyBgmAudioRef.current) storyBgmAudioRef.current.volume = 0;
    },
    [cancelStoryBgmFade]
  );

  const dismissInterlude = useCallback(() => {
    if (interludeExitPhase !== "off" || !interludeOpen) return;
    setInterludeFireflyFadeOut(true);
    bumpScriptAudioFade(INTERLUDE_SCRIPT_FADE_OUT_MS);
    clearTransitionFlashTimeouts();
    clearInterludeRevealTimeouts();
    clearInterludeExitTimeouts();
    setTransitionFlash("off");
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
    bumpScriptAudioFade,
    clearInterludeExitTimeouts,
    clearInterludeRevealTimeouts,
    clearTransitionFlashTimeouts,
    interludeExitPhase,
    interludeOpen,
  ]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const mRes = await fetch(OUR_STORY_PAGES_URL);
        if (cancelled) return;
        if (mRes.ok) {
          const raw = await mRes.text();
          const pages = parseOurStoryPagesManifest(raw);
          if (pages.length > 0) {
            setOurStoryPages(pages);
            return;
          }
        }
        const r = await fetch(CHAPTERS_MANIFEST_URL);
        const data: unknown = r.ok ? await r.json() : null;
        if (cancelled) return;
        const raw =
          data && typeof data === "object" && data !== null && "chapters" in data
            ? (data as { chapters: unknown }).chapters
            : null;
        const ch = Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : [];
        const folders = ch.length ? ch : ["main_page"];
        setOurStoryPages(folders.map((folder) => ({ folder, page: "", lines: [] })));
      } catch {
        if (!cancelled) setOurStoryPages([{ folder: "main_page", page: "", lines: [] }]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ourStoryPages.length === 0) return;
    setOurStoryChapterIndex((i) => Math.min(i, ourStoryPages.length - 1));
  }, [ourStoryPages.length]);

  const onOurStoryCurtainAnimEnd = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const n = e.animationName;
    if (
      n !== "our-story-chapter-curtain-wipe-next-in" &&
      n !== "our-story-chapter-curtain-wipe-prev-in"
    )
      return;
    const dir = ourStoryCurtainDirRef.current;
    ourStoryCurtainDirRef.current = null;
    setOurStoryCurtain(null);
    setScriptAudioFadeRequest(null);
    const last = ourStoryPages.length > 0 ? ourStoryPages.length - 1 : 0;
    if (dir === "next") {
      setOurStoryChapterIndex((i) => Math.min(i + 1, last));
    } else if (dir === "prev") {
      setOurStoryChapterIndex((i) => Math.max(i - 1, 0));
    }
  }, [ourStoryPages.length]);

  const onInterludePanelPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!interludeOpen || ourStoryCurtain) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const hit = (e.target as HTMLElement).closest?.("button, a, input, textarea, select, [role='button']");
      if (hit && e.currentTarget.contains(hit)) return;
      interludeSwipeRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    },
    [interludeOpen, ourStoryCurtain]
  );

  const onInterludePanelPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const s = interludeSwipeRef.current;
      interludeSwipeRef.current = null;
      if (!s || s.pointerId !== e.pointerId) return;
      if (!interludeOpen || ourStoryCurtain) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx < 52 || adx < ady * 1.12) return;
      const n = Math.max(1, ourStoryPages.length || 1);
      const last = n - 1;
      /* 첫 챕터: 오른쪽으로 미는 제스처(dx>0)는 이전/뒤로가기로 오해되기 쉬움 — 인터루드는 홈 버튼으로만 종료 */
      if (ourStoryChapterIndex === 0 && dx > 0) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      /* 첫 챕터이면서 챕터가 하나뿐일 때 왼쪽으로 밀기(dx<0)도 흡수(빈 제스처가 뒤로가기 등으로 이어지지 않도록) */
      if (ourStoryChapterIndex === 0 && last === 0 && dx < 0) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (dx < 0 && ourStoryChapterIndex < last) {
        bumpScriptAudioFade(INTERLUDE_SCRIPT_FADE_OUT_MS);
        ourStoryCurtainDirRef.current = "next";
        setOurStoryCurtain("next");
      } else if (dx > 0 && ourStoryChapterIndex > 0) {
        bumpScriptAudioFade(INTERLUDE_SCRIPT_FADE_OUT_MS);
        ourStoryCurtainDirRef.current = "prev";
        setOurStoryCurtain("prev");
      }
    },
    [interludeOpen, ourStoryCurtain, ourStoryPages.length, ourStoryChapterIndex, bumpScriptAudioFade]
  );

  const onInterludePanelPointerCancel = useCallback(() => {
    interludeSwipeRef.current = null;
  }, []);

  const onInterludeClipboardBlock = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  /** 인터루드 닫을 때 챕터 초기화 · 챕터가 바뀌면 스태거를 처음(phase 0)부터 다시 */
  useEffect(() => {
    if (!interludeOpen) {
      setOurStoryChapterIndex(0);
      setOurStoryCurtain(null);
      ourStoryCurtainDirRef.current = null;
      setScriptAudioFadeRequest(null);
      prevOurStoryChapterForSnapRef.current = 0;
      clearInterludeRevealTimeouts();
      setInterludeRevealPhase(0);
      return;
    }
    if (prevOurStoryChapterForSnapRef.current === ourStoryChapterIndex) return;
    prevOurStoryChapterForSnapRef.current = ourStoryChapterIndex;
    clearInterludeRevealTimeouts();
    setInterludeRevealPhase(0);
  }, [interludeOpen, ourStoryChapterIndex, clearInterludeRevealTimeouts]);

  /** 인터루드가 열린 뒤(또는 챕터·재생 epoch마다) 일러스트 → 포토 → 웨이브 순으로 페이드 인 */
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
  }, [interludeOpen, ourStoryChapterIndex, ourStoryPlaybackEpoch, clearInterludeRevealTimeouts]);

  useEffect(() => {
    if (!interludeOpen) {
      setInterludeScriptGateOpen(false);
      return;
    }
    if (interludeRevealPhase < 3) {
      setInterludeScriptGateOpen(false);
      return;
    }
    setInterludeScriptGateOpen(false);
    const t = window.setTimeout(() => setInterludeScriptGateOpen(true), INTERLUDE_SCRIPT_AFTER_WAVE_MS);
    return () => window.clearTimeout(t);
  }, [interludeOpen, interludeRevealPhase, ourStoryChapterIndex]);

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
        setOurStoryPlaybackEpoch((n) => n + 1);
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
    if (interactionFrozen || isSnappingRef.current) return;
    e.preventDefault();
    dragging.current = true;
    setPointerOnHourglass(true);
    lastAngleRef.current = clientAngle(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || lastAngleRef.current === null || interactionFrozen || isSnappingRef.current) return;
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

    if (interactionFrozen || isSnappingRef.current) return;

    const from = rotationRef.current;
    const target = pickStableTarget(from);
    startSnapTo(target, from);
  };

  const nRot = norm360(rotation);
  const atRestZero =
    nRot < ROTATE_HINT_DEG_EPS || nRot > 360 - ROTATE_HINT_DEG_EPS;
  const showRotateHint =
    !interactionFrozen && atRestZero && !pointerOnHourglass && !snapAnimating;

  const interludeStackRevealClass = interludeRevealPhase >= 1 ? "hg-stack--art" : "";
  const interludeStackRevealPhoto = interludeRevealPhase >= 2 ? "hg-stack--photo" : "";
  const interludeStackRevealWave = interludeRevealPhase >= 3 ? "hg-stack--wave" : "";

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
        className={`hourglass-flash-overlay hourglass-flash-overlay--interlude-page${
          interludeExitPhase === "toBlack" ? " hourglass-flash-overlay--interlude-under-exit" : ""
        }`.trim()}
        role="presentation"
        onPointerDownCapture={onInterludePanelPointerDown}
        onPointerUpCapture={onInterludePanelPointerUp}
        onPointerCancelCapture={onInterludePanelPointerCancel}
        onCopy={onInterludeClipboardBlock}
        onCut={onInterludeClipboardBlock}
      >
        <div className="hourglass-flash-overlay__gutter hourglass-flash-overlay__gutter--left" aria-hidden />
        <div
          className="hourglass-flash-overlay__shell-column hourglass-interlude-page"
          role="document"
          aria-label="Our Story"
        >
          <div className="hourglass-flash-overlay__shell hourglass-flash-overlay__shell--solid-black">
            <div
              className="hourglass-flash-overlay__panel hourglass-flash-overlay__panel--interlude"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`hourglass-interlude-title-${uid}`}
            >
              <p id={`hourglass-interlude-title-${uid}`} className="hourglass-flash-overlay__sr-only">
                Our Story
              </p>
              <div
                className={`hourglass-interlude-firefly-slot${
                  interludeFireflyFadeOut ? " hourglass-interlude-firefly-slot--fade-out" : ""
                }`}
                aria-hidden
              >
                {/* 홈 시 CSS로 슬롯 페이드 — 캔버스는 열려 있는 동안 rAF 유지(끊김 없이 서서히 사라짐) */}
                <InterludeFireflyBackground active={interludeOpen} />
              </div>
              <div className="hourglass-interlude-home-anchor">
                <button
                  type="button"
                  className="hourglass-flash-overlay__back hourglass-flash-overlay__back--icon hourglass-flash-overlay__back--interlude-fade-in"
                  onClick={dismissInterlude}
                  aria-label="홈으로 돌아가기"
                >
                  <svg
                    className="hourglass-flash-overlay__back-home-icon"
                    viewBox="0 0 24 24"
                    width="17"
                    height="17"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M12 3.8 4.5 10.2V20h4v-6.5h7V20h4V10.2L12 3.8z"
                    />
                  </svg>
                </button>
              </div>
              <div className="our-story-chapter-viewport">
                {interludeScriptFinished ? (
                  <div className="hourglass-interlude-home-hint-wrap" aria-hidden>
                    {ourStoryIsLastChapter ? (
                      <div className="hourglass-interlude-home-hint hourglass-interlude-home-hint--last-chapter">
                        <svg
                          className="hourglass-interlude-home-hint__down"
                          viewBox="0 0 24 24"
                          width="30"
                          height="30"
                        >
                          <path fill="currentColor" d="M7 10h10L12 16 7 10z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="hourglass-interlude-home-hint">
                        <svg
                          className="hourglass-interlude-home-hint__arrow hourglass-interlude-home-hint__arrow--left"
                          viewBox="0 0 24 24"
                          width="22"
                          height="22"
                        >
                          <path
                            fill="currentColor"
                            d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                          />
                        </svg>
                        <img
                          className="hourglass-interlude-home-hint__tap"
                          src={INTERLUDE_HOME_TAP_HINT_SVG}
                          alt=""
                          width="18"
                          height="18"
                          decoding="async"
                        />
                        <svg
                          className="hourglass-interlude-home-hint__arrow hourglass-interlude-home-hint__arrow--right"
                          viewBox="0 0 24 24"
                          width="22"
                          height="22"
                        >
                          <path
                            fill="currentColor"
                            d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : null}
                {ourStoryCurtain ? (
                  <div
                    key={ourStoryCurtain}
                    className="our-story-chapter-curtain"
                    aria-hidden
                  >
                    <div
                      className={
                        ourStoryCurtain === "next"
                          ? "our-story-chapter-curtain__sheet our-story-chapter-curtain__sheet--next"
                          : "our-story-chapter-curtain__sheet our-story-chapter-curtain__sheet--prev"
                      }
                      onAnimationEnd={onOurStoryCurtainAnimEnd}
                    />
                  </div>
                ) : null}
                <div
                  key={`${ourStoryChapterIndex}-${ourStoryPlaybackEpoch}`}
                  className="our-story-chapter-surface"
                  aria-label={`스토리 ${ourStoryChapterIndex + 1} / ${ourStoryPages.length || 1}`}
                >
                  <div
                    className={`hg-stack ${interludeStackRevealClass} ${interludeStackRevealPhoto} ${interludeStackRevealWave}`.trim()}
                  >
                    <div className="back_photo_layer" aria-hidden>
                      <div className="back_img">
                        <InterludePhotoFilm src={ourStoryBackImg} alt="" />
                      </div>
                      <InterludeFlash />
                    </div>
                    <div className="hourglass-flash-overlay__interlude-art">
                      <InterludeIllustrationFrames baseUrl={storyPageBase} active={interludeOpen} />
                    </div>
                    <InterludeSoundWaveCanvas
                      waveAnalyserRef={interludeWaveAnalyserRef}
                      wavActiveRef={interludeWavActiveRef}
                    />
                    <InterludeScriptSequence
                      interludeOpen={interludeOpen}
                      scriptGateOpen={interludeScriptGateOpen}
                      baseUrl={storyPageBase}
                      scriptLines={interludeScriptLines}
                      waveAnalyserRef={interludeWaveAnalyserRef}
                      wavActiveRef={interludeWavActiveRef}
                      scriptAudioFadeRequest={scriptAudioFadeRequest}
                      onScriptFinished={onInterludeScriptFinished}
                    />
                  </div>
                </div>
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
      className={`our-stroy__hourglass${sandDrainPlaying ? " our-stroy__hourglass--locked" : ""}${
        interactionFrozen ? " our-stroy__hourglass--interaction-frozen" : ""
      }`.trim()}
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
