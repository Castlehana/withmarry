import { useEffect, useState } from "react";
import "./IntroEnvelopeGate.css";

const INTRO_FINGER_HINT_SVG = `${import.meta.env.BASE_URL}static/interlude-home-tap-hint.svg`;

const FINGER_HINT_SHOW_MS = 3000;

export type IntroGatePhase = "black" | "idle" | "opening" | "done";

type IntroEnvelopeGateProps = {
  phase: IntroGatePhase;
  onOpen: () => void;
  /** 편지지에 표시 — 보통 `couple.groom.이름` / `couple.bride.이름` */
  groomName: string;
  brideName: string;
};

/**
 * 인트로: 검은 화면 → 봉투(흔들림·탭) → 열림 애니 — 단계·타이머는 부모(App)에서 관리.
 * 봉투 마크업은 CodePen식 DOM 순서(pocket→flap→letter→hearts), 클릭은 투명 `button` 오버레이(B).
 */
export function IntroEnvelopeGate({ phase, onOpen, groomName, brideName }: IntroEnvelopeGateProps) {
  const [fingerHintVisible, setFingerHintVisible] = useState(false);

  useEffect(() => {
    if (phase !== "idle") {
      return;
    }
    const t0 = typeof performance !== "undefined" && Number.isFinite(performance.timeOrigin)
      ? performance.timeOrigin
      : Date.now();
    const elapsed = Date.now() - t0;
    const wait = Math.max(0, FINGER_HINT_SHOW_MS - elapsed);
    setFingerHintVisible(false);
    const id = window.setTimeout(() => setFingerHintVisible(true), wait);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={`intro-gate${phase === "opening" ? " intro-gate--opening" : ""}`}
      data-phase={phase}
      role="region"
      aria-label="청첩장 인트로"
    >
      <div className="intro-gate__vignette" aria-hidden />
      {(phase === "idle" || phase === "opening") && (
        <div className="intro-gate__stage">
          <div className="intro-gate__intro-stack">
            <div className={`intro-gate__envelope-wrap${phase === "idle" ? " intro-gate__envelope-wrap--shake" : ""}`}>
              <div className={`intro-env ${phase === "opening" ? "intro-env--open" : "intro-env--close"}`}>
                <div className="intro-env__pocket intro-env__front" />
                <div className="intro-env__flap intro-env__front" />
                <div className="intro-env__letter">
                  <p className="intro-env__letter-line">
                    <span className="intro-env__letter-groom">{groomName}</span>
                    <span className="intro-env__letter-heart" aria-hidden>
                      ♥
                    </span>
                    <span className="intro-env__letter-bride">{brideName}</span>
                  </p>
                </div>
                <div className="intro-env__hearts" aria-hidden>
                  <div className="intro-env__heart intro-env__heart--a1" />
                  <div className="intro-env__heart intro-env__heart--a2" />
                  <div className="intro-env__heart intro-env__heart--a3" />
                </div>
              </div>
              <button
                type="button"
                className="intro-gate__envelope-hit"
                onClick={onOpen}
                aria-label="청첩장 열기"
                disabled={phase === "opening"}
              />
            </div>
            <div
              className={`intro-gate__finger-hint${fingerHintVisible ? " intro-gate__finger-hint--visible" : ""}`}
              aria-hidden
            >
              <div
                className={`intro-gate__finger-hint__bob${
                  fingerHintVisible ? " intro-gate__finger-hint__bob--playing" : ""
                }`}
              >
                <img
                  className="intro-gate__finger-hint__img"
                  src={INTRO_FINGER_HINT_SVG}
                  alt=""
                  width={512}
                  height={512}
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
