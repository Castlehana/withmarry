import { useEffect, useRef, useState } from "react";

const MAX_FRAME_PROBE = 120;
/** 프레임 전환 간격(이중 버퍼로 빈 틈 없이 즉시 전환) */
const FRAME_INTERVAL_MS = 1000;

function probeFrameExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => resolve(false), 12000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(true);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(false);
    };
    img.src = url;
  });
}

async function discoverFrameUrls(assetBase: string): Promise<string[]> {
  const urls: string[] = [];
  for (let n = 1; n <= MAX_FRAME_PROBE; n++) {
    const u = `${assetBase}/frame${n}.png`;
    if (!(await probeFrameExists(u))) break;
    urls.push(u);
  }
  if (urls.length === 0) {
    const fallback = `${assetBase}/frame1.png`;
    if (await probeFrameExists(fallback)) return [fallback];
  }
  return urls;
}

type InterludeIllustrationFramesProps = {
  baseUrl: string;
  active: boolean;
};

/**
 * `frame1.png` … 연속 번호. 두 `<img>`에 현재·다음 프레임을 유지하고
 * 앞만 opacity 1·뒤는 0으로 두어 반투명 PNG가 겹쳐 보이지 않게 함(z-index도 교체).
 */
export function InterludeIllustrationFrames({ baseUrl, active }: InterludeIllustrationFramesProps) {
  const assetBase = baseUrl.replace(/\/$/, "");
  const [urls, setUrls] = useState<string[]>([]);
  /** 현재 화면에 보이는 프레임 인덱스 */
  const [k, setK] = useState(0);
  /** true면 A가 위(앞), false면 B가 위 */
  const [aOnTop, setAOnTop] = useState(true);
  const lenRef = useRef(0);
  lenRef.current = urls.length;

  useEffect(() => {
    if (!active) {
      setUrls([]);
      setK(0);
      setAOnTop(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const found = await discoverFrameUrls(assetBase);
      if (cancelled) return;
      setUrls(found);
      setK(0);
      setAOnTop(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, assetBase]);

  useEffect(() => {
    if (!active || urls.length < 2) return;
    const id = window.setInterval(() => {
      const len = lenRef.current;
      if (len < 2) return;
      setK((i) => (i + 1) % len);
      setAOnTop((v) => !v);
    }, FRAME_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, urls.length]);

  if (!active) return null;

  if (urls.length === 0) {
    return (
      <img
        className="hourglass-flash-overlay__couple-img"
        alt=""
        width={1638}
        height={2048}
        decoding="async"
        src={`${assetBase}/frame1.png`}
      />
    );
  }

  if (urls.length === 1) {
    return (
      <img
        className="hourglass-flash-overlay__couple-img"
        alt=""
        width={1638}
        height={2048}
        decoding="async"
        src={urls[0]}
      />
    );
  }

  const n = urls.length;
  const srcA = aOnTop ? urls[k]! : urls[(k + 1) % n]!;
  const srcB = aOnTop ? urls[(k + 1) % n]! : urls[k]!;
  const zA = aOnTop ? 2 : 1;
  const zB = aOnTop ? 1 : 2;
  const opA = aOnTop ? 1 : 0;
  const opB = aOnTop ? 0 : 1;

  return (
    <div className="hourglass-interlude-frame-stack" aria-hidden>
      <img
        className="hourglass-flash-overlay__couple-img hourglass-interlude-frame-stack__img"
        alt=""
        width={1638}
        height={2048}
        decoding="async"
        loading="eager"
        src={srcA}
        style={{ zIndex: zA, opacity: opA }}
      />
      <img
        className="hourglass-flash-overlay__couple-img hourglass-interlude-frame-stack__img"
        alt=""
        width={1638}
        height={2048}
        decoding="async"
        loading="eager"
        src={srcB}
        style={{ zIndex: zB, opacity: opB }}
      />
    </div>
  );
}
