import "./IntroEnvelopeGate.css";

type Props = {
  groomName: string;
  brideName: string;
};

/**
 * 인트로(`IntroEnvelopeGate`)와 동일한 봉투·편지 DOM.
 * `intro-env--static-visual`로 애니·트랜지션 없이 닫힌 상태만 표시합니다.
 */
export function IntroEnvelopeLetterVisual({ groomName, brideName }: Props) {
  return (
    <div className="intro-env intro-env--close intro-env--static-visual">
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
