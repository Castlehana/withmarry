import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { WEDDING_CIRCULAR_GALLERY_COUNT, weddingGalleryStillUrl } from "./weddingCircularGalleryData";
import "./WeddingCircularGallery.css";

const N = WEDDING_CIRCULAR_GALLERY_COUNT;
/** 전체 한 바퀴(초) — 자동 회전 */
const AUTO_REV_SECONDS = 110;
/** 드래그 1px당 `--k` 변화량 — 값 작을수록 드래그 시 천천히 회전 */
const DRAG_K_PER_PX = 0.0028;

/** 시야 기준 한 바퀴 위치 [0,1) — `j - k` */
function viewerTurn01(slotIndex0: number, n: number, k: number): number {
  const j = slotIndex0 / n;
  return (((j - k) % 1) + 1) % 1;
}

/** 위치를 0~9 스케일로 (2.5~7.5 구간이 정면 부근) */
function position09(slotIndex0: number, n: number, k: number): number {
  return viewerTurn01(slotIndex0, n, k) * 9;
}

const FACE_POS_LO = 2.5;
const FACE_POS_HI = 7.5;

/** 2.5~7.5: 1, 0·9 쪽으로 갈수록 0에 가까워짐 */
function faceOpacityFromPosition09(pos: number): number {
  if (pos >= FACE_POS_LO && pos <= FACE_POS_HI) return 1;
  if (pos < FACE_POS_LO) return FACE_POS_LO <= 0 ? 1 : Math.max(0, Math.min(1, pos / FACE_POS_LO));
  return Math.max(0, Math.min(1, (9 - pos) / (9 - FACE_POS_HI)));
}

export type WeddingCircularGalleryProps = {
  weddingId: string;
  reduceMotion: boolean;
};

export function WeddingCircularGallery({ weddingId, reduceMotion }: WeddingCircularGalleryProps) {
  const [k, setK] = useState(0);
  /** 로드된 이미지의 자연 픽셀 크기 — 카드 비율·블록 크기에 사용 */
  const [naturalSizeBySlot, setNaturalSizeBySlot] = useState<
    Record<number, { w: number; h: number }>
  >({});
  const pauseUntilRef = useRef(0);
  const kRef = useRef(0);
  kRef.current = k;
  const dragRef = useRef<{ pointerId: number; startX: number; k0: number } | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    let id = 0;
    let last = performance.now();
    const speed = 1 / (AUTO_REV_SECONDS * 1000);
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const dragging = dragRef.current !== null;
      if (!dragging && now >= pauseUntilRef.current) {
        setK((prev) => {
          const next = (prev + dt * speed) % 1;
          return next;
        });
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [reduceMotion]);

  const onScenePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        k0: kRef.current,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    },
    []
  );

  const onScenePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const deltaX = e.clientX - d.startX;
    const next = (d.k0 - (deltaX * DRAG_K_PER_PX)*(0.2) + 10) % 1;
    kRef.current = next;
    setK(next);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    pauseUntilRef.current = 0;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const onLostPointerCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      pauseUntilRef.current = 0;
    }
  }, []);

  const activeIndex = useMemo(() => {
    const idx = Math.floor(k * N + 1e-6) % N;
    return idx < 0 ? idx + N : idx;
  }, [k]);

  useEffect(() => {
    kRef.current = k;
  }, [k]);

  const rootStyle = useMemo(
    () =>
      ({
        "--k": k,
        "--n": N,
      }) as CSSProperties,
    [k]
  );

  const slots = useMemo(() => Array.from({ length: N }, (_, i) => i + 1), []);

  const onGalleryImgLoad = useCallback((slot: number, el: HTMLImageElement) => {
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    if (w <= 0 || h <= 0) return;
    setNaturalSizeBySlot((prev) => {
      if (prev[slot]?.w === w && prev[slot]?.h === h) return prev;
      return { ...prev, [slot]: { w, h } };
    });
  }, []);

  return (
    <div className="circular-gallery" style={rootStyle}>
      <div
        className="circular-gallery__scene"
        role="group"
        aria-roledescription="carousel"
        aria-label="웨딩 갤러리 사진. 좌우로 드래그하면 회전합니다."
        onPointerDown={onScenePointerDown}
        onPointerMove={onScenePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={onLostPointerCapture}
      >
        <section className="circular-gallery__assembly">
          {slots.map((slot, i) => {
            const url = weddingGalleryStillUrl(weddingId, slot);
            const nat = naturalSizeBySlot[slot];
            const pos09 = position09(i, N, k);
            const faceOp = faceOpacityFromPosition09(pos09);
            const cardStyle = {
              "--i": i,
              "--face-op": faceOp,
              ...(nat ? { "--aw": nat.w, "--ah": nat.h } : {}),
            } as CSSProperties;

            return (
              <article
                key={slot}
                className={`circular-gallery__card${nat ? " circular-gallery__card--sized" : ""}`}
                style={cardStyle}
                aria-current={i === activeIndex ? true : undefined}
              >
                <figure className="circular-gallery__card-figure">
                  <div className="circular-gallery__card-book">
                    <div className="circular-gallery__card-face circular-gallery__card-face--front">
                      <img
                        src={url}
                        alt={`웨딩 갤러리 사진 ${slot}`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onLoad={(e) => onGalleryImgLoad(slot, e.currentTarget)}
                      />
                    </div>
                    <div className="circular-gallery__card-face circular-gallery__card-face--back" aria-hidden>
                      <img src={url} alt="" loading="lazy" decoding="async" draggable={false} />
                    </div>
                  </div>
                </figure>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
