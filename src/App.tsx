import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeadsetSineWaves } from "./HeadsetSineWaves";
import { HourglassInteractive, type HourglassInterludeShellMode } from "./HourglassInteractive";
import { GuestbookSection } from "./GuestbookSection";
import { weddingData } from "./wedding-data";
import "./audio-hint-waves";

const NAV: { id: string; label: string }[] = [
  { id: "main", label: "메인" },
  { id: "our-stroy", label: "Our Stroy" },
  { id: "gallery", label: "Gallery" },
  { id: "guestbook", label: "방명록" },
  { id: "directions", label: "오시는 길" },
  { id: "accounts", label: "마음 전하실 곳" },
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

export default function App() {
  const { meta, couple, wedding } = weddingData;

  const WEDDING = useMemo(() => new Date(wedding.dateTimeISO), [wedding.dateTimeISO]);
  const reduceIntroMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const heroAudioWaveTrackRef = useRef<HTMLSpanElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hourglassScrollLock, setHourglassScrollLock] = useState(false);
  const [hourglassShellMode, setHourglassShellMode] = useState<HourglassInterludeShellMode>("normal");
  /** 인트로: 검은 화면 → 봉투(흔들림·클릭) → 열림 애니메이션 → 본문 */
  const [introPhase, setIntroPhase] = useState<"black" | "idle" | "opening" | "done">(() =>
    reduceIntroMotion ? "idle" : "black"
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
    /* 2s 대기 후 커튼·봉퇴 퇴장(~0.45s) — App.css animation-delay와 맞춤 */
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

  return (
    <div className="desktop-stage">
      {introPhase !== "done" ? (
        <div
          className={`intro-gate${introPhase === "opening" ? " intro-gate--opening" : ""}`}
          data-phase={introPhase}
          role="presentation"
        >
          <div className="intro-gate__vignette" aria-hidden />
          {(introPhase === "idle" || introPhase === "opening") && (
            <div className="intro-gate__stage">
              <button
                type="button"
                className={`intro-gate__envelope-wrap${introPhase === "idle" ? " intro-gate__envelope-wrap--shake" : ""}`}
                onClick={() => {
                  if (introPhase === "idle") setIntroPhase("opening");
                }}
                aria-label="청첩장 열기"
                disabled={introPhase === "opening"}
              >
                <div className={`intro-env ${introPhase === "opening" ? "intro-env--open" : "intro-env--close"}`}>
                  <div className="intro-env__letter" aria-hidden />
                  <div className="intro-env__hearts" aria-hidden>
                    <div className="intro-env__heart intro-env__heart--a1" />
                    <div className="intro-env__heart intro-env__heart--a2" />
                    <div className="intro-env__heart intro-env__heart--a3" />
                  </div>
                  <div className="intro-env__pocket intro-env__front" />
                  <div className="intro-env__flap intro-env__front" />
                </div>
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div
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

        <main className="content" aria-hidden={hourglassShellMode === "interlude" ? true : undefined}>
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
          </section>

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

          <section id="accounts" className="section accounts" aria-labelledby="accounts-heading">
            <h2 id="accounts-heading">마음 전하실 곳</h2>
            <div className="accounts__inner">
              {wedding.accounts && wedding.accounts.length > 0 ? (
                <ul className="accounts__list">
                  {wedding.accounts.map((row, i) => (
                    <li key={i} className="accounts__card">
                      <p className="accounts__label">{row.label}</p>
                      <p className="accounts__bank">{row.bank}</p>
                      <p className="accounts__number">{row.number}</p>
                      <p className="accounts__holder">예금주 {row.holder}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="accounts__empty">계좌 정보는 준비 중입니다.</p>
              )}
            </div>
          </section>

          <footer className="site-credit" role="contentinfo">
            <p className="site-credit__text">Powered by With Marry</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
