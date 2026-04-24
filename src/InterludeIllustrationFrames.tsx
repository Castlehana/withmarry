import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** `App.css` `.hourglass-flash-overlay__interlude-art__video` 의 `transition: opacity` 와 동일하게 유지 */
const LOOP_CROSSFADE_SEC = 1;

const ILLUSTRATION_FILE = "animation.mp4";
const ILLUSTRATION_FLIP_FILE = "animation_flip.mp4";

/** HEAD/GET이 200이어도 index.html 폴백(text/html)이면 false — 실제 mp4만 true */
async function isRealMp4Asset(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", signal });
    if (!head.ok) return false;
    const headCt = (head.headers.get("content-type") || "").toLowerCase();
    if (headCt.includes("text/html")) return false;
    if (headCt.includes("video/") || headCt.includes("application/octet-stream")) return true;
    if (headCt.length > 0) return false;
    const range = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal,
    });
    if (!range.ok && range.status !== 206) return false;
    const ct = (range.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return false;
    return ct.includes("video/") || ct.includes("application/octet-stream");
  } catch {
    return false;
  }
}

function silenceIllustrationVideo(v: HTMLVideoElement | null) {
  if (!v) return;
  v.defaultMuted = true;
  v.muted = true;
  v.volume = 0;
}

type InterludeIllustrationFramesProps = {
  baseUrl: string;
  active: boolean;
};

/**
 * 인터루드 중앙: `baseUrl/animation.mp4` 무음 재생.
 * 같은 폴더에 `animation_flip.mp4`가 있으면 그 파일을 쓰고 좌우 반전(스택 `scaleX(-1)`).
 * 끝나기 LOOP_CROSSFADE_SEC 초 전에 다음 레이어 재생·크로스페이드(페이드아웃/인 동시).
 */
export function InterludeIllustrationFrames({ baseUrl, active }: InterludeIllustrationFramesProps) {
  const assetBase = baseUrl.replace(/\/$/, "");
  const videoRef0 = useRef<HTMLVideoElement>(null);
  const videoRef1 = useRef<HTMLVideoElement>(null);
  /** 현재 화면에 보이는 레이어(불투명 쪽) */
  const frontRef = useRef<0 | 1>(0);
  /** 이번 루프에서 끝 직전 크로스페이드 이미 시작함 */
  const crossfadeScheduledRef = useRef(false);
  const [o0, setO0] = useState(0);
  const [o1, setO1] = useState(0);
  const [z0, setZ0] = useState(2);
  const [z1, setZ1] = useState(1);
  /** `animation_flip.mp4` 존재 시 true — HEAD 탐지 */
  const [useFlipAsset, setUseFlipAsset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const flipUrl = `${assetBase}/${ILLUSTRATION_FLIP_FILE}`;
    (async () => {
      const ok = await isRealMp4Asset(flipUrl, ac.signal);
      if (cancelled) return;
      setUseFlipAsset(ok);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [assetBase]);

  const illustrationSrc = useMemo(
    () => `${assetBase}/${useFlipAsset ? ILLUSTRATION_FLIP_FILE : ILLUSTRATION_FILE}`,
    [assetBase, useFlipAsset]
  );

  const pauseAndReset = useCallback((idx: 0 | 1) => {
    const v = idx === 0 ? videoRef0.current : videoRef1.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }, []);

  const startLoopCrossfade = useCallback(
    (fromIdx: 0 | 1) => {
      if (!active) return;
      if (fromIdx !== frontRef.current) return;
      if (crossfadeScheduledRef.current) return;

      const incoming = (1 - fromIdx) as 0 | 1;
      const vIn = incoming === 0 ? videoRef0.current : videoRef1.current;
      if (!vIn) return;
      crossfadeScheduledRef.current = true;
      vIn.currentTime = 0;
      silenceIllustrationVideo(vIn);
      void vIn.play().catch(() => {});
      if (incoming === 1) {
        setZ0(1);
        setZ1(2);
      } else {
        setZ0(2);
        setZ1(1);
      }
      setO0(incoming === 0 ? 1 : 0);
      setO1(incoming === 1 ? 1 : 0);
      frontRef.current = incoming;
    },
    [active]
  );

  const onTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!active) return;
      const v = e.currentTarget;
      const idx = (v === videoRef0.current ? 0 : 1) as 0 | 1;
      if (idx !== frontRef.current) return;
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const lead = d > LOOP_CROSSFADE_SEC + 0.02 ? LOOP_CROSSFADE_SEC : Math.max(0.05, d * 0.35);
      if (v.currentTime < d - lead) return;
      startLoopCrossfade(idx);
    },
    [active, startLoopCrossfade]
  );

  const onEnded = useCallback(
    (endedIdx: 0 | 1) => () => {
      if (!active) return;
      if (endedIdx !== frontRef.current) {
        pauseAndReset(endedIdx);
        return;
      }
      startLoopCrossfade(endedIdx);
    },
    [active, pauseAndReset, startLoopCrossfade]
  );

  const onOpacityTransitionEnd = useCallback(
    (idx: 0 | 1) => (e: React.TransitionEvent<HTMLVideoElement>) => {
      if (e.propertyName !== "opacity") return;
      if (idx === frontRef.current) return;
      pauseAndReset(idx);
      crossfadeScheduledRef.current = false;
    },
    [pauseAndReset]
  );

  useEffect(() => {
    const v0 = videoRef0.current;
    const v1 = videoRef1.current;
    if (!active) {
      crossfadeScheduledRef.current = false;
      frontRef.current = 0;
      setO0(0);
      setO1(0);
      setZ0(2);
      setZ1(1);
      if (v0) {
        v0.pause();
        v0.currentTime = 0;
      }
      if (v1) {
        v1.pause();
        v1.currentTime = 0;
      }
      return;
    }
    crossfadeScheduledRef.current = false;
    silenceIllustrationVideo(v0);
    silenceIllustrationVideo(v1);
    frontRef.current = 0;
    setZ0(2);
    setZ1(1);
    setO0(0);
    setO1(0);
    const p = v0?.play();
    if (p !== undefined) void p.catch(() => {});
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setO0(1);
        setO1(0);
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [active, illustrationSrc]);

  const onIllustrationPlay = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    silenceIllustrationVideo(e.currentTarget);
  }, []);

  const videoProps = {
    className: "hourglass-flash-overlay__interlude-art__video",
    src: illustrationSrc,
    muted: true as const,
    defaultMuted: true as const,
    playsInline: true as const,
    preload: "auto" as const,
    "aria-hidden": true as const,
  };

  const stackClass =
    `hourglass-flash-overlay__interlude-art__video-stack${
      useFlipAsset ? " hourglass-flash-overlay__interlude-art__video-stack--flip" : ""
    }`.trim();

  if (!active) return null;

  return (
    <div key={illustrationSrc} className={stackClass}>
      <video
        ref={videoRef0}
        {...videoProps}
        style={{ opacity: o0, zIndex: z0 }}
        onLoadedMetadata={onIllustrationPlay}
        onPlay={onIllustrationPlay}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded(0)}
        onTransitionEnd={onOpacityTransitionEnd(0)}
      />
      <video
        ref={videoRef1}
        {...videoProps}
        style={{ opacity: o1, zIndex: z1 }}
        onLoadedMetadata={onIllustrationPlay}
        onPlay={onIllustrationPlay}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded(1)}
        onTransitionEnd={onOpacityTransitionEnd(1)}
      />
    </div>
  );
}
