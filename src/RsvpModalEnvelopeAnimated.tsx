import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import "./IntroEnvEnvelope.css";

type Props = {
  groomName: string;
  brideName: string;
};

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 모달 안 — 인트로와 동일 봉투 마크업, 닫힘 → 열림 전환(뚜껑·편지·하트 애니 재생).
 */
export function RsvpModalEnvelopeAnimated({ groomName, brideName }: Props) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const [opened, setOpened] = useState(reduceMotion);

  useLayoutEffect(() => {
    if (reduceMotion) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setOpened(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [reduceMotion]);

  const openClass = opened ? "intro-env--open" : "intro-env--close";

  return (
    <div className={`intro-env ${openClass} rsvp-modal-envelope`}>
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
  );
}
