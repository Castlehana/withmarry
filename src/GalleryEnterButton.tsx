import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const VEIL_FADE_MS = 480;

export type GalleryEnterButtonProps = {
  weddingId: string;
  /** 버튼 라벨 */
  label: string;
};

export function GalleryEnterButton({ weddingId, label }: GalleryEnterButtonProps) {
  const navigate = useNavigate();
  const [veil, setVeil] = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const go = useCallback(() => {
    const path = `/${encodeURIComponent(weddingId)}/gallery`;
    if (reduceMotion) {
      void navigate(path);
      return;
    }
    setVeil(true);
    window.setTimeout(() => {
      void navigate(path);
    }, VEIL_FADE_MS);
  }, [navigate, reduceMotion, weddingId]);

  return (
    <>
      {veil ? createPortal(<div className="gallery-nav-white-veil" aria-hidden />, document.body) : null}
      <button type="button" className="gallery__enter-btn" onClick={go}>
        {label}
      </button>
    </>
  );
}
