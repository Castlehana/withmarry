import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useScrollRevealRoot } from "./useScrollRevealRoot";
import { HeadsetSineWaves } from "./HeadsetSineWaves";
import { HourglassInteractive, type HourglassInterludeShellMode } from "./HourglassInteractive";
import { weddingData } from "./wedding-data";
import { copyTextToClipboard } from "./clipboardUtils";
import { CopyFeedbackToast } from "./CopyFeedbackToast";
import { useCopyFeedbackToast } from "./useCopyFeedbackToast";
import { HeartAccountsSection } from "./HeartAccountsSection";
import { HeroParentsContact } from "./HeroParentsContact";
import { RsvpAttendanceSection } from "./RsvpAttendanceSection";
import { WeddingCalendar } from "./WeddingCalendar";
import { WeddingFlipCountdown } from "./WeddingFlipCountdown";
import { DirectionsNavLinks } from "./DirectionsNavLinks";
import { DirectionsTransportToggles } from "./DirectionsTransportToggles";
import { IntroEnvelopeGate, type IntroGatePhase } from "./IntroEnvelopeGate";
import "./audio-hint-waves";

/** `directionsNote` 한 줄에서 이모지·픽토그램만 제거 (본문은 유지) */
function stripDirectionNoteEmojis(line: string): string {
  return line
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F|\u200D/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatDaysKo(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

/** `mbtiLine` 끝의 대문자 4글자(예: ESFJ)를 타입 코드로 분리 — 없으면 전체를 한 줄로 */
function splitMbtiLine(line: string): { lead: string; code: string | null } {
  const t = line.trim();
  const words = t.split(/\s+/);
  const last = words[words.length - 1] ?? "";
  if (words.length > 1 && /^[A-Z]{4}$/.test(last)) {
    return { lead: words.slice(0, -1).join(" "), code: last };
  }
  return { lead: t, code: null };
}

function heroCoupleTelDigits(phone: string | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

function HeroCoupleTelIcon() {
  return (
    <svg
      className="hero-couple-intro__tel"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroCoupleTelLink({ phone, ariaLabel }: { phone: string | undefined; ariaLabel: string }) {
  const digits = heroCoupleTelDigits(phone);
  if (!digits) return null;
  return (
    <a className="hero-couple-intro__tel-link" href={`tel:${digits}`} aria-label={ariaLabel}>
      <HeroCoupleTelIcon />
    </a>
  );
}

export default function App() {
  const { meta, couple, wedding } = weddingData;

  const WEDDING = useMemo(() => new Date(wedding.dateTimeISO), [wedding.dateTimeISO]);
  const reduceIntroMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const heroAudioWaveTrackRef = useRef<HTMLSpanElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const phoneShellRef = useRef<HTMLDivElement>(null);
  const [hourglassScrollLock, setHourglassScrollLock] = useState(false);
  const [hourglassShellMode, setHourglassShellMode] = useState<HourglassInterludeShellMode>("normal");
  /** 인트로: 검은 화면 → 봉투(흔들림·클릭) → 열림 애니메이션 → 본문 — UI는 `IntroEnvelopeGate` */
  const [introPhase, setIntroPhase] = useState<IntroGatePhase>(() => (reduceIntroMotion ? "idle" : "black"));
  const { open: copyToastOpen, closing: copyToastClosing, notify: notifyCopied, close: closeCopyToast } =
    useCopyFeedbackToast();

  useScrollRevealRoot(mainContentRef, [introPhase, hourglassShellMode]);

  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const shell = phoneShellRef.current;
      if (shell) shell.scrollTop = 0;
    };
    resetScroll();
    const raf = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    document.title = meta.documentTitle;
  }, [meta.documentTitle]);

  useEffect(() => {
    if (introPhase !== "black") return;
    const ms = reduceIntroMotion ? 0 : 720;
    const t = window.setTimeout(() => setIntroPhase("idle"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase, reduceIntroMotion]);

  useEffect(() => {
    if (introPhase !== "opening") return;
    /* 2s 대기 후 커튼·봉투 퇴장(~0.45s) — `IntroEnvelopeGate.css` animation-delay와 맞춤 */
    const ms = reduceIntroMotion ? 2000 : 2480;
    const t = window.setTimeout(() => setIntroPhase("done"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase, reduceIntroMotion]);

  useEffect(() => {
    document.body.classList.toggle("overflow-lock", introPhase !== "done" || hourglassScrollLock);
  }, [introPhase, hourglassScrollLock]);

  const heroVenueLine = `${wedding.venueName} ${wedding.venueHall}`;
  const groomMbti = splitMbtiLine(couple.groom.mbtiLine);
  const brideMbti = splitMbtiLine(couple.bride.mbtiLine);

  const copyDirectionsStreetAddress = useCallback(() => {
    const t = wedding.venueAddress?.trim();
    if (!t) return;
    void copyTextToClipboard(t).then(() => notifyCopied());
  }, [notifyCopied, wedding.venueAddress]);

  return (
    <div className="desktop-stage">
      <IntroEnvelopeGate
        phase={introPhase}
        onOpen={() => setIntroPhase("opening")}
        groomName={couple.groom.이름}
        brideName={couple.bride.이름}
      />

      <div
        ref={phoneShellRef}
        className="phone-shell"
        data-hourglass-interlude={hourglassShellMode !== "normal" ? "" : undefined}
        data-hourglass-interlude-exit-reveal={hourglassShellMode === "exit-reveal" ? "" : undefined}
        {...(hourglassShellMode !== "normal" ? { inert: true } : {})}
      >
        <main
          ref={mainContentRef}
          className="content"
          aria-hidden={hourglassShellMode === "interlude" ? true : undefined}
        >
          <CopyFeedbackToast open={copyToastOpen} closing={copyToastClosing} onClose={closeCopyToast} />
          <section id="main" className="hero">
            <div className="hero-inner">
              <p className="hero-kicker">
                SAVE <em className="the-italic">The</em> DATE
              </p>
              <p className="hero-date-nums">{wedding.saveTheDateNums}</p>
              <p className="hero-date-line">
                {formatDaysKo(WEDDING)} {wedding.ceremonyTimeLabel}
              </p>
              <img
                className="hero-title-photo"
                src={`${import.meta.env.BASE_URL}static/title-couple.png`}
                alt={`${couple.groom.성이름}, ${couple.bride.성이름}`}
                loading="eager"
                decoding="async"
              />
              <h1 className="hero-names">
                <span>{couple.groom.성이름}</span>
                <span className="ampersand">&</span>
                <span>{couple.bride.성이름}</span>
              </h1>
              <div className="hero-venue-block">
                <p className="hero-venue">{heroVenueLine}</p>
                {wedding.venueAddress?.trim() ? (
                  <button
                    type="button"
                    className="hero-venue hero-venue--copy hero-venue--address"
                    onClick={copyDirectionsStreetAddress}
                    aria-label={`주소 복사: ${wedding.venueAddress.trim()}`}
                    title="눌러서 복사"
                  >
                    {wedding.venueAddress.trim()}
                  </button>
                ) : null}
              </div>
              <div data-scroll-reveal="" data-scroll-reveal-delay-ms="90">
                <section className="hero-couple-intro" aria-label="신랑·신부 소개">
                  <div className="hero-couple-intro__grid">
                    <div className="hero-couple-intro__col hero-couple-intro__col--groom">
                      <p className="hero-couple-intro__head">
                        <span className="hero-couple-intro__role">신랑</span>
                        <span className="hero-couple-intro__name">{couple.groom.성이름}</span>
                        <HeroCoupleTelLink
                          phone={couple.groom.phone}
                          ariaLabel={`신랑 ${couple.groom.성이름}에게 전화`}
                        />
                      </p>
                      <p className="hero-couple-intro__mbti">
                        {groomMbti.lead}
                        {groomMbti.code ? <span className="hero-couple-intro__mbti-code"> {groomMbti.code}</span> : null}
                      </p>
                      <p className="hero-couple-intro__accent">{couple.groom.tagAccent}</p>
                      <p className="hero-couple-intro__desc">{couple.groom.description}</p>
                      <p className="hero-couple-intro__parents">
                        <strong>
                          {couple.groomFatherName}·{couple.groomMotherName} 의 {couple.groomFamilyChildLine}
                        </strong>
                      </p>
                    </div>
                    <div className="hero-couple-intro__col hero-couple-intro__col--bride">
                      <p className="hero-couple-intro__head">
                        <span className="hero-couple-intro__role">신부</span>
                        <span className="hero-couple-intro__name">{couple.bride.성이름}</span>
                        <HeroCoupleTelLink
                          phone={couple.bride.phone}
                          ariaLabel={`신부 ${couple.bride.성이름}에게 전화`}
                        />
                      </p>
                      <p className="hero-couple-intro__mbti">
                        {brideMbti.lead}
                        {brideMbti.code ? <span className="hero-couple-intro__mbti-code"> {brideMbti.code}</span> : null}
                      </p>
                      <p className="hero-couple-intro__accent">{couple.bride.tagAccent}</p>
                      <p className="hero-couple-intro__desc">{couple.bride.description}</p>
                      <p className="hero-couple-intro__parents">
                        <strong>
                          {couple.brideFatherName}·{couple.brideMotherName} 의 {couple.brideFamilyChildLine}
                        </strong>
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              {couple.parentsContact ? (
                <div data-scroll-reveal="" data-scroll-reveal-delay-ms="120">
                  <HeroParentsContact block={couple.parentsContact} />
                </div>
              ) : null}
              <div data-scroll-reveal="" data-scroll-reveal-delay-ms="128">
                <RsvpAttendanceSection
                  groomName={couple.groom.이름}
                  brideName={couple.bride.이름}
                  block={couple.rsvpAttendance}
                />
              </div>
              <div className="wedding-calendar-wrap">
                <div data-scroll-reveal="" data-scroll-reveal-delay-ms="150">
                  <WeddingCalendar weddingDate={WEDDING} />
                </div>
                <WeddingFlipCountdown
                  targetDate={WEDDING}
                  groomName={couple.groom.이름}
                  brideName={couple.bride.이름}
                />
              </div>
            </div>
          </section>

          <div className="audio-hint-block" data-scroll-reveal="">
            <p className="hero-audio-hint" role="note">
              <span ref={heroAudioWaveTrackRef} className="hero-audio-hint__wave-track">
                <HeadsetSineWaves containerRef={heroAudioWaveTrackRef} />
                <span className="hero-audio-hint__ic">
                  <svg
                    className="hero-audio-hint__svg"
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 18v-6a9 9 0 0 1 18 0v6"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </span>
              <span className="hero-audio-hint__text">이어폰과 함께 해주세요.</span>
            </p>
          </div>

          <section id="our-stroy" className="section our-stroy" lang="en">
            <h2>Our Stroy</h2>
            <div className="our-stroy__body">
              <HourglassInteractive
                onScrollLockChange={setHourglassScrollLock}
                onInterludePageChange={setHourglassShellMode}
              />
            </div>
          </section>

          <section id="gallery" className="section gallery gallery--cinemagraph" lang="en" aria-labelledby="gallery-heading">
            <h2 id="gallery-heading">Gallery</h2>
            <div className="gallery__grid">
              <figure className="gallery__figure">
                <img
                  className="gallery__image"
                  src={`${import.meta.env.BASE_URL}gallery-thumbnail.png`}
                  alt="Bride and groom in silhouette, foreheads touching at sunset on a terrace overlooking hills and the sea"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
          </section>

          {wedding.heartAccounts ? <HeartAccountsSection block={wedding.heartAccounts} /> : null}

          <section id="directions" className="section directions" aria-labelledby="directions-heading">
            <h2 id="directions-heading">오시는 길</h2>
            <div className="directions__inner">
              <p className="directions__venue">
                {wedding.venueName} {wedding.venueHall}
              </p>
              {wedding.venueAddress ? (
                <button
                  type="button"
                  className="directions__address directions__address--copy"
                  onClick={copyDirectionsStreetAddress}
                  aria-label={`주소 복사: ${wedding.venueAddress}`}
                  title="눌러서 복사"
                >
                  {wedding.venueAddress}
                </button>
              ) : null}
              {wedding.directionsNote ? (
                <div className="directions__note">
                  {wedding.directionsNote
                    .split("\n")
                    .map(stripDirectionNoteEmojis)
                    .filter((line) => line.length > 0)
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              ) : null}
              {wedding.mapUrl ? (
                <a className="directions__maplink" href={wedding.mapUrl} target="_blank" rel="noopener noreferrer">
                  지도에서 보기
                </a>
              ) : null}
            </div>
            <figure className="directions__mapfigure">
              <img
                className="directions__mapimage"
                src={`${import.meta.env.BASE_URL}directions-map.png`}
                alt={`${wedding.venueName} ${wedding.venueHall} 위치 안내 지도`}
                loading="lazy"
                decoding="async"
              />
            </figure>
            <DirectionsNavLinks wedding={wedding} />
            {wedding.directionsTransport ? (
              <DirectionsTransportToggles block={wedding.directionsTransport} />
            ) : null}
          </section>

          <footer className="site-credit" role="contentinfo">
            <p className="site-credit__text">Powered by With Marry</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
