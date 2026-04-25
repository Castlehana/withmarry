import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useScrollRevealRoot } from "./useScrollRevealRoot";
import { HeadsetSineWaves } from "./HeadsetSineWaves";
import { HourglassInteractive, type HourglassInterludeShellMode } from "./HourglassInteractive";
import { GuestbookSection } from "./GuestbookSection";
import { weddingData } from "./wedding-data";
import { HeartAccountsSection } from "./HeartAccountsSection";
import { HeroParentsContact } from "./HeroParentsContact";
import { WeddingCalendar } from "./WeddingCalendar";
import { IntroEnvelopeGate, type IntroGatePhase } from "./IntroEnvelopeGate";
import "./audio-hint-waves";

const NAV: { id: string; label: string }[] = [
  { id: "main", label: "메인" },
  { id: "our-stroy", label: "Our Stroy" },
  { id: "gallery", label: "Gallery" },
  { id: "guestbook", label: "방명록" },
  { id: "accounts", label: "마음 전하실 곳" },
  { id: "directions", label: "오시는 길" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [hourglassScrollLock, setHourglassScrollLock] = useState(false);
  const [hourglassShellMode, setHourglassShellMode] = useState<HourglassInterludeShellMode>("normal");
  /** 인트로: 검은 화면 → 봉투(흔들림·클릭) → 열림 애니메이션 → 본문 — UI는 `IntroEnvelopeGate` */
  const [introPhase, setIntroPhase] = useState<IntroGatePhase>(() => (reduceIntroMotion ? "idle" : "black"));

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
    document.body.classList.toggle(
      "overflow-lock",
      menuOpen || introPhase !== "done" || hourglassScrollLock
    );
  }, [menuOpen, introPhase, hourglassScrollLock]);

  const heroVenueLine = `${wedding.venueName} ${wedding.venueHall}`;
  const groomMbti = splitMbtiLine(couple.groom.mbtiLine);
  const brideMbti = splitMbtiLine(couple.bride.mbtiLine);

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
        <div className="sticky-head">
          <header className="top-bar">
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="메뉴">
              <span className="hamburger" />
            </button>
            <span className="top-title">
              {couple.topBarTitle ?? `${couple.groom.이름} · ${couple.bride.이름}`}
            </span>
            <button type="button" className="icon-btn ghost" aria-label="음악(데모)">
              ♪
            </button>
          </header>
        </div>

        {menuOpen ? (
          <div className="menu-overlay" onClick={closeMenu}>
            <nav className="menu-panel" onClick={(e) => e.stopPropagation()}>
              <div className="menu-head">
                <span>메뉴</span>
                <button type="button" className="menu-close" onClick={closeMenu} aria-label="메뉴 닫기">
                  ×
                </button>
              </div>
              <ul className="menu-list">
                {NAV.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToId(item.id);
                        closeMenu();
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        ) : null}

        <main
          ref={mainContentRef}
          className="content"
          aria-hidden={hourglassShellMode === "interlude" ? true : undefined}
        >
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
              <p className="hero-venue">{heroVenueLine}</p>
              <div data-scroll-reveal="" data-scroll-reveal-delay-ms="90">
                <section className="hero-couple-intro" aria-label="신랑·신부 소개">
                  <div className="hero-couple-intro__grid">
                    <div className="hero-couple-intro__col hero-couple-intro__col--groom">
                      <p className="hero-couple-intro__head">
                        <span className="hero-couple-intro__role">신랑</span>
                        <span className="hero-couple-intro__name">{couple.groom.성이름}</span>
                        <HeroCoupleTelIcon />
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
                        <HeroCoupleTelIcon />
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
              <div className="wedding-calendar-wrap" data-scroll-reveal="" data-scroll-reveal-delay-ms="150">
                <WeddingCalendar weddingDate={WEDDING} />
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

          <GuestbookSection flockReady={introPhase === "done"} />

          {wedding.heartAccounts ? <HeartAccountsSection block={wedding.heartAccounts} /> : null}

          <section id="directions" className="section directions" aria-labelledby="directions-heading">
            <h2 id="directions-heading">오시는 길</h2>
            <div className="directions__inner">
              <p className="directions__venue">
                {wedding.venueName} {wedding.venueHall}
              </p>
              {wedding.venueAddress ? <p className="directions__address">{wedding.venueAddress}</p> : null}
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
                alt="스팩스페이스 오피스 위치 안내 지도(서울 강서구 마곡 일대)"
                loading="lazy"
                decoding="async"
              />
            </figure>
          </section>

          <footer className="site-credit" role="contentinfo">
            <p className="site-credit__text">Powered by With Marry</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
