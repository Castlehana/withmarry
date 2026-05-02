import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WEDDING_CIRCULAR_GALLERY_COUNT, weddingGalleryStillUrl } from "./weddingCircularGalleryData";
import "./WeddingGalleryGrid.css";

const INITIAL_VISIBLE = 9;
const LIGHTBOX_EXIT_MS = 220;

type Props = {
  weddingId: string;
};

export function WeddingGalleryGrid({ weddingId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [gridMaxHeight, setGridMaxHeight] = useState<string | undefined>(undefined);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [navDir, setNavDir] = useState<"prev" | "next">("next");
  const gridRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const slots = useMemo(
    () => Array.from({ length: WEDDING_CIRCULAR_GALLERY_COUNT }, (_, i) => i + 1),
    []
  );
  const hasMore = slots.length > INITIAL_VISIBLE;
  const activeIndex = activeSlot ? slots.indexOf(activeSlot) : -1;

  const measureCollapsedHeight = useCallback(() => {
    const el = gridRef.current;
    const lastVisible = el?.children[INITIAL_VISIBLE - 1] as HTMLElement | undefined;
    if (!el || !lastVisible) return 0;
    const gridTop = el.getBoundingClientRect().top;
    const itemBottom = lastVisible.getBoundingClientRect().bottom;
    return Math.max(0, itemBottom - gridTop);
  }, []);

  const syncGridHeight = useCallback(
    (nextExpanded = expanded) => {
      const el = gridRef.current;
      if (!el) return;
      const nextHeight = nextExpanded ? el.scrollHeight : measureCollapsedHeight();
      if (nextHeight > 0) setGridMaxHeight(`${Math.ceil(nextHeight)}px`);
    },
    [expanded, measureCollapsedHeight]
  );

  useLayoutEffect(() => {
    syncGridHeight(expanded);
  }, [expanded, syncGridHeight]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncGridHeight(expanded));
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, syncGridHeight]);

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      requestAnimationFrame(() => syncGridHeight(next));
      return next;
    });
  }, [syncGridHeight]);

  const openLightbox = useCallback((slot: number) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    setNavDir("next");
    setActiveSlot(slot);
  }, []);
  const closeLightbox = useCallback(() => {
    setClosing(true);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setActiveSlot(null);
      setClosing(false);
      closeTimerRef.current = null;
    }, LIGHTBOX_EXIT_MS);
  }, []);
  const showPrev = useCallback(() => {
    setNavDir("prev");
    setActiveSlot((current) => {
      if (!current) return current;
      const i = slots.indexOf(current);
      return slots[(i - 1 + slots.length) % slots.length] ?? current;
    });
  }, [slots]);
  const showNext = useCallback(() => {
    setNavDir("next");
    setActiveSlot((current) => {
      if (!current) return current;
      const i = slots.indexOf(current);
      return slots[(i + 1) % slots.length] ?? current;
    });
  }, [slots]);

  useEffect(() => {
    if (!activeSlot) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        showPrev();
      } else if (e.key === "ArrowRight") {
        showNext();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeSlot, closeLightbox, showNext, showPrev]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  return (
    <div className="wedding-gallery-grid">
      <div
        ref={gridRef}
        className={`wedding-gallery-grid__items${expanded ? " wedding-gallery-grid__items--expanded" : ""}`}
        style={gridMaxHeight ? { maxHeight: gridMaxHeight } : undefined}
      >
        {slots.map((slot, index) => (
          <figure
            key={slot}
            className={`wedding-gallery-grid__item${index >= INITIAL_VISIBLE ? " wedding-gallery-grid__item--extra" : ""}`}
          >
            <button
              type="button"
              className="wedding-gallery-grid__thumb"
              onClick={() => openLightbox(slot)}
              aria-label={`웨딩 갤러리 사진 ${slot} 크게 보기`}
            >
              <img
                src={weddingGalleryStillUrl(weddingId, slot)}
                alt={`웨딩 갤러리 사진 ${slot}`}
                loading="lazy"
                decoding="async"
              />
            </button>
          </figure>
        ))}
      </div>
      {hasMore ? (
        <button
          type="button"
          className="wedding-gallery-grid__more"
          onClick={toggleExpanded}
          aria-expanded={expanded}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      ) : null}
      {activeSlot
        ? createPortal(
            <div
              className={`wedding-gallery-lightbox${closing ? " wedding-gallery-lightbox--closing" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label="웨딩 갤러리 사진첩"
            >
              <button
                type="button"
                className="wedding-gallery-lightbox__scrim"
                onClick={closeLightbox}
                aria-label="사진첩 닫기"
              />
              <div className="wedding-gallery-lightbox__stage">
                <button
                  type="button"
                  className="wedding-gallery-lightbox__nav wedding-gallery-lightbox__nav--prev"
                  onClick={showPrev}
                  aria-label="이전 사진"
                >
                  <span aria-hidden>‹</span>
                </button>
                <figure
                  key={activeSlot}
                  className={`wedding-gallery-lightbox__figure wedding-gallery-lightbox__figure--${navDir}`}
                >
                  <img
                    src={weddingGalleryStillUrl(weddingId, activeSlot)}
                    alt={`웨딩 갤러리 사진 ${activeSlot}`}
                    decoding="async"
                  />
                  <figcaption className="wedding-gallery-lightbox__count">
                    {activeIndex + 1} / {slots.length}
                  </figcaption>
                </figure>
                <button
                  type="button"
                  className="wedding-gallery-lightbox__nav wedding-gallery-lightbox__nav--next"
                  onClick={showNext}
                  aria-label="다음 사진"
                >
                  <span aria-hidden>›</span>
                </button>
                <button
                  type="button"
                  className="wedding-gallery-lightbox__close"
                  onClick={closeLightbox}
                  aria-label="사진첩 닫기"
                >
                  닫기
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
