import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GALLERY_TRANSITION_MS } from "./galleryTransition";

export type GalleryEnterButtonProps = {
  /** 버튼 라벨 */
  label: string;
};

export function GalleryEnterButton({ label }: GalleryEnterButtonProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [veil, setVeil] = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const galleryOpen = searchParams.get("gallery") === "1";
  useLayoutEffect(() => {
    if (galleryOpen) setVeil(false);
  }, [galleryOpen]);

  const go = useCallback(() => {
    const next = { search: "?gallery=1" } as const;
    if (reduceMotion) {
      void navigate(next);
      return;
    }
    setVeil(true);
    window.setTimeout(() => {
      void navigate(next);
      setVeil(false);
    }, GALLERY_TRANSITION_MS);
  }, [navigate, reduceMotion]);

  return (
    <>
      {veil
        ? createPortal(
            <div className="gallery-nav-white-veil" aria-hidden>
              <div className="gallery-nav-white-veil__sheet" />
            </div>,
            document.body
          )
        : null}
      <button type="button" className="gallery__enter-btn" onClick={go}>
        {label}
      </button>
    </>
  );
}
