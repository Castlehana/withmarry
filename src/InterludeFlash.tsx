import "./InterludePhotoFilm.css";

/** `back_photo_layer` 안 사진과 동일 박스 — 비네트·필름·그레인 */
export function InterludeFlash() {
  return (
    <div className="flash" aria-hidden>
      <span className="back_img__vignette" />
      <span className="back_img__film">
        <span className="back_img__film_scratch" />
      </span>
      <span className="flash__sparkle">
        <span className="flash__scratch" />
      </span>
      <span className="grain" />
    </div>
  );
}
