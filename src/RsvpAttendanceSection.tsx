import { type TransitionEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IntroEnvelopeLetterVisual } from "./IntroEnvelopeLetterVisual";
import { RsvpModalEnvelopeAnimated } from "./RsvpModalEnvelopeAnimated";
import { submitRsvpSubmission } from "./rsvp-storage";
import type { RsvpAttendanceBlock } from "./wedding-data.types";

type Props = {
  weddingId: string;
  groomName: string;
  brideName: string;
  block?: RsvpAttendanceBlock;
};

type GuestSide = "groom" | "bride" | "";
type Attend = "yes" | "no" | "";
type Meal = "yes" | "no" | "undecided" | "";

const QUIZ_SLIDE_COUNT = 6;

const PRIVACY_DETAIL = [
  { k: "수집 항목", v: "이름, 전화번호 등 RSVP에 입력된 항목" },
  { k: "이용 목적", v: "결혼식 참석 여부 확인 및 관련 서비스 제공" },
  { k: "보유 및 이용 기간", v: "동의일로부터 청첩장 유효기간 동안" },
  { k: "동의 거부권 및 불이익", v: "동의 거부 시 서비스 이용 불가" },
] as const;

function rsvpSideLabel(side: GuestSide): string {
  if (side === "groom") return "신랑";
  if (side === "bride") return "신부";
  return "—";
}

function rsvpAttendLabel(attend: Attend): string {
  if (attend === "yes") return "참석";
  if (attend === "no") return "불참석";
  return "—";
}

function rsvpMealLabel(meal: Meal): string {
  if (meal === "yes") return "O (식사)";
  if (meal === "no") return "X (식사 없음)";
  if (meal === "undecided") return "미정";
  return "—";
}

function RsvpDialog({
  mounted,
  revealed,
  dialogId,
  titleId,
  onRequestClose,
  onBackdropTransitionEnd,
  formUrl,
  formLabel,
  weddingId,
  groomName,
  brideName,
}: {
  mounted: boolean;
  revealed: boolean;
  dialogId: string;
  titleId: string;
  onRequestClose: () => void;
  onBackdropTransitionEnd: (e: TransitionEvent<HTMLDivElement>) => void;
  formUrl?: string;
  formLabel: string;
  weddingId: string;
  groomName: string;
  brideName: string;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<"form" | "success">("form");
  const [quizIndex, setQuizIndex] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [side, setSide] = useState<GuestSide>("");
  const [attend, setAttend] = useState<Attend>("");
  const [meal, setMeal] = useState<Meal>("");
  const [name, setName] = useState("");
  const [privacyOk, setPrivacyOk] = useState(false);

  useEffect(() => {
    if (!mounted) {
      setStep("form");
      setQuizIndex(0);
      setPrivacyOpen(false);
      setSide("");
      setAttend("");
      setMeal("");
      setName("");
      setPrivacyOk(false);
      setSubmitting(false);
      setSubmitError(null);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (privacyOpen) {
        setPrivacyOpen(false);
        return;
      }
      onRequestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onRequestClose, privacyOpen]);

  useEffect(() => {
    if (!mounted || !revealed || step !== "form") return;
    const id = window.requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [mounted, revealed, step]);

  if (!mounted) return null;

  const trackPct = (100 / QUIZ_SLIDE_COUNT) * quizIndex;

  const goNext = () => setQuizIndex((q) => Math.min(q + 1, QUIZ_SLIDE_COUNT - 1));
  const goPrev = () => {
    setQuizIndex((q) => {
      if (q === 5) {
        queueMicrotask(() => setPrivacyOk(false));
        return 4;
      }
      if (q === 4 && attend === "no") {
        queueMicrotask(() => setPrivacyOk(false));
        return 2;
      }
      if (q === 4 && attend === "yes") {
        queueMicrotask(() => setPrivacyOk(false));
        return 3;
      }
      return Math.max(0, q - 1);
    });
  };

  const pickSide = (v: GuestSide) => {
    setSide(v);
    goNext();
  };
  const pickAttend = (v: Attend) => {
    setAttend(v);
    if (v === "no") {
      setMeal("");
      setQuizIndex((q) => Math.min(q + 2, QUIZ_SLIDE_COUNT - 1));
      return;
    }
    goNext();
  };
  const pickMeal = (v: Meal) => {
    setMeal(v);
    goNext();
  };

  const nameNext = () => {
    if (!name.trim()) return;
    goNext();
  };

  const privacyAgreeNext = () => {
    setPrivacyOk(true);
    goNext();
  };

  const finishSubmit = () => {
    void (async () => {
      if (!privacyOk) return;
      if (side !== "groom" && side !== "bride") return;
      if (attend !== "yes" && attend !== "no") return;
      setSubmitError(null);
      setSubmitting(true);
      const mealVal =
        attend === "no" ? ("" as const) : meal === "yes" || meal === "no" || meal === "undecided" ? meal : ("undecided" as const);
      try {
        const saved = await submitRsvpSubmission(weddingId, {
          side,
          name: name.trim(),
          attend,
          meal: mealVal,
        });
        if (!saved) {
          setSubmitError("전달에 실패했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
        setStep("success");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return createPortal(
    <div
      className={`rsvp-attendance__backdrop${revealed ? " rsvp-attendance__backdrop--visible" : ""}`}
      onClick={onRequestClose}
      onTransitionEnd={onBackdropTransitionEnd}
      role="presentation"
    >
      <div
        id={dialogId}
        className={`rsvp-attendance__dialog${step === "form" ? " rsvp-attendance__dialog--form" : " rsvp-attendance__dialog--success"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(ev) => ev.stopPropagation()}
      >
        {step === "form" && quizIndex > 0 && !privacyOpen ? (
          <button type="button" className="rsvp-quiz-back" onClick={goPrev} aria-label="이전 단계">
            <span className="rsvp-quiz-back__chev" aria-hidden>
              &lt;
            </span>
          </button>
        ) : null}
        <button ref={closeBtnRef} type="button" className="rsvp-attendance__dialog-close" onClick={onRequestClose}>
          닫기
        </button>

        {step === "form" ? (
          <>
            <h3
              id={titleId}
              className={`rsvp-attendance__dialog-title rsvp-attendance__dialog-title--form${
                quizIndex > 0 && !privacyOpen ? " rsvp-attendance__dialog-title--with-quiz-back" : ""
              }`}
            >
              참석 여부 전달
            </h3>

            <div className="rsvp-quiz-viewport">
              <div
                className="rsvp-quiz-track"
                style={{
                  width: `${QUIZ_SLIDE_COUNT * 100}%`,
                  transform: `translateX(-${trackPct}%)`,
                }}
              >
                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 0}
                  aria-labelledby={`${dialogId}-q1`}
                >
                  <h4 id={`${dialogId}-q1`} className="rsvp-quiz-question">
                    어느 측 하객이신가요?
                  </h4>
                  <div className="rsvp-quiz-options" role="group" aria-label="신랑 또는 신부">
                    <button type="button" className="rsvp-op" onClick={() => pickSide("groom")}>
                      신랑
                    </button>
                    <button type="button" className="rsvp-op rsvp-op--tr" onClick={() => pickSide("bride")}>
                      신부
                    </button>
                  </div>
                </section>

                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 1}
                  aria-labelledby={`${dialogId}-q2`}
                >
                  <h4 id={`${dialogId}-q2`} className="rsvp-quiz-question">
                    성함을 알려 주세요
                  </h4>
                  <input
                    id={`${dialogId}-name`}
                    className="rsvp-input rsvp-input--quiz"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    placeholder="홍길동"
                  />
                  <button
                    type="button"
                    className="rsvp-quiz-next"
                    disabled={!name.trim()}
                    title={name.trim() ? undefined : "성함을 입력해 주세요"}
                    onClick={nameNext}
                  >
                    다음
                  </button>
                </section>

                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 2}
                  aria-labelledby={`${dialogId}-q3`}
                >
                  <h4 id={`${dialogId}-q3`} className="rsvp-quiz-question">
                    참석 여부를 알려 주세요
                  </h4>
                  <div className="rsvp-quiz-options" role="group" aria-label="참석 여부">
                    <button type="button" className="rsvp-op" onClick={() => pickAttend("yes")}>
                      참석
                    </button>
                    <button type="button" className="rsvp-op rsvp-op--tr" onClick={() => pickAttend("no")}>
                      불참석
                    </button>
                  </div>
                </section>

                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 3}
                  aria-labelledby={`${dialogId}-q4`}
                >
                  <h4 id={`${dialogId}-q4`} className="rsvp-quiz-question">
                    식사 여부는요?
                  </h4>
                  <div className="rsvp-quiz-options rsvp-quiz-options--meal" role="group" aria-label="식사 여부">
                    <button type="button" className="rsvp-op" onClick={() => pickMeal("yes")}>
                      O
                    </button>
                    <button type="button" className="rsvp-op rsvp-op--tr" onClick={() => pickMeal("no")}>
                      X
                    </button>
                    <button type="button" className="rsvp-op rsvp-op--full" onClick={() => pickMeal("undecided")}>
                      미정
                    </button>
                  </div>
                </section>

                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 4}
                  aria-labelledby={`${dialogId}-q5`}
                >
                  <h4 id={`${dialogId}-q5`} className="rsvp-quiz-question">
                    개인정보 수집 및 활용에 동의해 주세요
                  </h4>
                  <p className="rsvp-quiz-privacy-lead">
                    자세한 내용은 아래에서 확인하신 뒤,
                    <br />
                    동의를 눌러 주세요.
                  </p>
                  <div className="rsvp-privacy-detail-trigger">
                    <button
                      type="button"
                      className="rsvp-privacy__detail-link"
                      onClick={() => setPrivacyOpen(true)}
                    >
                      [자세히보기]
                    </button>
                  </div>
                  <div className="rsvp-quiz-options rsvp-quiz-options--privacy-agree" role="group" aria-label="동의">
                    <button type="button" className="rsvp-op rsvp-op--privacy-agree" onClick={privacyAgreeNext}>
                      동의
                    </button>
                  </div>
                </section>

                <section
                  className="rsvp-quiz-slide"
                  aria-hidden={quizIndex !== 5}
                  aria-labelledby={`${dialogId}-q6`}
                >
                  <h4 id={`${dialogId}-q6`} className="rsvp-quiz-question">
                    입력 내용을 확인해 주세요
                  </h4>
                  <div className="rsvp-quiz-summary" role="group" aria-label="선택 요약">
                    <ul className="rsvp-quiz-summary__list">
                      <li className="rsvp-quiz-summary__item">
                        <span className="rsvp-quiz-summary__k">하객</span>
                        <span className="rsvp-quiz-summary__v">{rsvpSideLabel(side)}</span>
                      </li>
                      <li className="rsvp-quiz-summary__item">
                        <span className="rsvp-quiz-summary__k">성함</span>
                        <span className="rsvp-quiz-summary__v">{name.trim() || "—"}</span>
                      </li>
                      <li className="rsvp-quiz-summary__item">
                        <span className="rsvp-quiz-summary__k">참석</span>
                        <span className="rsvp-quiz-summary__v">{rsvpAttendLabel(attend)}</span>
                      </li>
                      <li className="rsvp-quiz-summary__item">
                        <span className="rsvp-quiz-summary__k">식사</span>
                        <span className="rsvp-quiz-summary__v">
                          {attend === "no" ? "해당 없음" : rsvpMealLabel(meal)}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <p className="rsvp-quiz-summary-lead">내용이 맞으면 전달해 주세요.</p>
                  {submitError ? (
                    <p className="rsvp-form__error" role="alert">
                      {submitError}
                    </p>
                  ) : null}
                  {formUrl ? (
                    <a className="rsvp-form__external" href={formUrl} target="_blank" rel="noopener noreferrer">
                      {formLabel}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="rsvp-form__submit"
                    disabled={!privacyOk || submitting}
                    title={privacyOk ? undefined : "이전 단계에서 개인정보 동의를 눌러 주세요"}
                    onClick={finishSubmit}
                  >
                    {submitting ? "전달 중…" : "전달"}
                  </button>
                </section>
              </div>
            </div>

            <nav
              className="rsvp-quiz-milestones"
              aria-label={`질문 진행, ${quizIndex + 1}번째 단계 중 ${QUIZ_SLIDE_COUNT}단계`}
            >
              <div className="rsvp-quiz-milestones__rail" aria-hidden>
                <div
                  className="rsvp-quiz-milestones__rail-fill"
                  style={{
                    width: `${(quizIndex / Math.max(1, QUIZ_SLIDE_COUNT - 1)) * 100}%`,
                  }}
                />
              </div>
              <ol className="rsvp-quiz-milestones__steps">
                {Array.from({ length: QUIZ_SLIDE_COUNT }, (_, i) => {
                  const state = i < quizIndex ? "done" : i === quizIndex ? "current" : "upcoming";
                  return (
                    <li
                      key={i}
                      className={`rsvp-quiz-milestones__step rsvp-quiz-milestones__step--${state}`}
                      aria-label={`${i + 1}단계`}
                      aria-current={i === quizIndex ? "step" : undefined}
                    >
                      <span className="rsvp-quiz-milestones__dot" aria-hidden />
                    </li>
                  );
                })}
              </ol>
            </nav>

            {privacyOpen ? (
              <div
                className="rsvp-privacy-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${dialogId}-privacy-title`}
                onClick={(ev) => ev.stopPropagation()}
              >
                <button type="button" className="rsvp-privacy-sheet__close" onClick={() => setPrivacyOpen(false)}>
                  ✕
                </button>
                <h4 id={`${dialogId}-privacy-title`} className="rsvp-privacy-sheet__title">
                  (필수) 개인정보 수집 및 활용 동의
                </h4>
                <ul className="rsvp-privacy-sheet__list">
                  {PRIVACY_DETAIL.map((row) => (
                    <li key={row.k}>
                      <strong>[{row.k}]</strong> {row.v}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rsvp-success" aria-live="polite">
            <h3 id={titleId} className="rsvp-success__sr-title">
              전달이 완료되었습니다.
            </h3>
            <div className="rsvp-success__envelope-wrap">
              <RsvpModalEnvelopeAnimated groomName={groomName} brideName={brideName} />
            </div>
            <p className="rsvp-success__msg">전달이 완료되었습니다.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function RsvpAttendanceSection({ weddingId, groomName, brideName, block }: Props) {
  const [dlgMounted, setDlgMounted] = useState(false);
  const [dlgRevealed, setDlgRevealed] = useState(false);
  const dlgRevealedRef = useRef(dlgRevealed);
  dlgRevealedRef.current = dlgRevealed;

  const dialogId = useId().replace(/:/g, "");
  const titleId = `${dialogId}-title`;

  const formUrl = block?.formUrl?.trim();
  const formLabel = block?.formLabel?.trim() || "참석 여부 입력하기";

  const openDialog = () => {
    setDlgMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setDlgRevealed(true));
    });
  };

  const requestCloseDialog = () => {
    setDlgRevealed(false);
  };

  const onBackdropTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "opacity") return;
    if (dlgRevealedRef.current) return;
    setDlgMounted(false);
  };

  return (
    <section className="rsvp-attendance" aria-labelledby="rsvp-attendance-heading" lang="ko">
      <h2 id="rsvp-attendance-heading" className="rsvp-attendance__title">
        참석 여부 전달하기
      </h2>
      <button
        type="button"
        className="rsvp-attendance__trigger"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-expanded={dlgMounted && dlgRevealed}
        aria-controls={dialogId}
        aria-label="참석 여부 안내 — 편지 열기"
      >
        <span className="rsvp-envelope-figure" aria-hidden>
          <IntroEnvelopeLetterVisual groomName={groomName} brideName={brideName} />
        </span>
      </button>
      <RsvpDialog
        mounted={dlgMounted}
        revealed={dlgRevealed}
        dialogId={dialogId}
        titleId={titleId}
        onRequestClose={requestCloseDialog}
        onBackdropTransitionEnd={onBackdropTransitionEnd}
        formUrl={formUrl}
        formLabel={formLabel}
        weddingId={weddingId}
        groomName={groomName}
        brideName={brideName}
      />
    </section>
  );
}
