import "./InterludePhotoFilm.css";

export type InterludePhotoFilmProps = {
  src: string;
  /** 접근성용 — 비어 있으면 장식용으로 처리 */
  alt?: string;
};

/**
 * 인터루드 실사 포토 위에 올드 필름(비네트·스크래치·그레인) 오버레이.
 */
export function InterludePhotoFilm({ src, alt = "" }: InterludePhotoFilmProps) {
  return (
    <div className="interlude-photo-film">
      <img
        className="interlude-photo-film__img hourglass-flash-overlay__interlude-bg-img"
        src={src}
        alt={alt}
        decoding="async"
      />
      <span className="interlude-photo-film__vignette" aria-hidden />
      <span className="interlude-photo-film__film" aria-hidden>
        <span className="interlude-photo-film__film-scratch" />
      </span>
      <span className="interlude-photo-film__effect" aria-hidden>
        <span className="interlude-photo-film__effect-scratch" />
      </span>
      <span className="interlude-photo-film__grain" aria-hidden />
    </div>
  );
}
