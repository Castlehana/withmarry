import { useEffect, useMemo, useState } from "react";
import "./IntroLetterEnvelope.css";
import "./IntroLetterGate.css";

export type IntroLetterGateProps = {
  /** 인트로가 끝나고 본문으로 넘어갈 때 한 번 호출 */
  onComplete: () => void;
};

export function IntroLetterGate({ onComplete }: IntroLetterGateProps) {
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const showMs = reduceMotion ? 900 : 2400;
    const t = window.setTimeout(() => setExiting(true), showMs);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (!exiting) return;
    const fadeMs = reduceMotion ? 180 : 420;
    const t = window.setTimeout(onComplete, fadeMs);
    return () => window.clearTimeout(t);
  }, [exiting, reduceMotion, onComplete]);

  return (
    <div
      className={`intro-letter-gate${exiting ? " intro-letter-gate--exiting" : ""}`}
      role="presentation"
    >
      <div className="intro-letter-gate__content">
        <div className="intro-letter-gate__inner">
          <div className="intro-letter-gate__envelope-wrap">
            <div className="intro-letter-skin intro-letter-skin--gate-scale intro-letter-skin--close">
              <div className="intro-letter-skin__pocket intro-letter-skin__front" />
              <div className="intro-letter-skin__flap intro-letter-skin__front" />
              <img
                className="intro-letter-gate__wax-seal"
                src={`${import.meta.env.BASE_URL}static/wax-seal-wm.png`}
                alt=""
                decoding="async"
                draggable={false}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
