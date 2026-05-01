import { useEffect, useState } from "react";
import "./InterludePhotoFilm.css";

export type InterludePhotoFilmProps = {
  src: string;
  fallbackSrc?: string;
  /** 접근성용 — 비어 있으면 장식용으로 처리 */
  alt?: string;
};

/** 백 사진만(가로: `--interlude-content-w` 꽉 참) · `InterludeFlash`는 `back_photo_layer`에서 겹침 */
export function InterludePhotoFilm({ src, fallbackSrc, alt = "" }: InterludePhotoFilmProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <div className="back_img_inner">
      <div className="back_img__wrap">
        <img
          className="back_img__img"
          src={currentSrc}
          alt={alt}
          decoding="async"
          onError={() => {
            if (fallbackSrc && currentSrc !== fallbackSrc) {
              setCurrentSrc(fallbackSrc);
            }
          }}
        />
      </div>
    </div>
  );
}
