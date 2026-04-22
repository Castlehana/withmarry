import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeadsetSineWaves } from "./HeadsetSineWaves";
import { HourglassInteractive } from "./HourglassInteractive";
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
  /** 인트로: 검은 화면 → 편지 등장 → 탭 유도 → 열림 → 본문 */
  const [introPhase, setIntroPhase] = useState<
    "black" | "letterIn" | "awaitClick" | "opening" | "done"
  >(() => (reduceIntroMotion ? "letterIn" : "black"));

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    document.title = meta.documentTitle;
  }, [meta.documentTitle]);

  useEffect(() => {
    if (introPhase !== "black") return;
    const ms = reduceIntroMotion ? 0 : 720;
    const t = window.setTimeout(() => setIntroPhase("letterIn"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase, reduceIntroMotion]);

  useEffect(() => {
    if (introPhase !== "letterIn") return;
    const ms = reduceIntroMotion ? 0 : 2400;
    const t = window.setTimeout(() => setIntroPhase("awaitClick"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase, reduceIntroMotion]);

  useEffect(() => {
    if (introPhase !== "opening") return;
    const ms = reduceIntroMotion ? 220 : 980;
    const t = window.setTimeout(() => setIntroPhase("done"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase, reduceIntroMotion]);

  useEffect(() => {
    document.body.classList.toggle("overflow-lock", menuOpen || introPhase !== "done");
    return () => document.body.classList.remove("overflow-lock");
  }, [menuOpen, introPhase]);

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
          {(introPhase === "letterIn" || introPhase === "awaitClick" || introPhase === "opening") && (
            <div className="intro-gate__stage">
              <div className="intro-gate__envelope">
                <div className="intro-gate__paper">
                  <p className="intro-gate__eyebrow">청첩장</p>
                  <p className="intro-gate__names">
                    {couple.groom.성이름} <span className="intro-gate__heart">♥</span> {couple.bride.성이름}
                  </p>
                  <p className="intro-gate__body">{meta.introTypingLine}</p>
                </div>
                <div className="intro-gate__wax" aria-hidden />
                <div className="intro-gate__flap" aria-hidden />
              </div>
              {introPhase === "awaitClick" || introPhase === "opening" ? (
                <button
                  type="button"
                  className={`intro-gate__tap${introPhase === "opening" ? " intro-gate__tap--pressed" : ""}`}
                  onClick={() => {
                    if (introPhase === "awaitClick") setIntroPhase("opening");
                  }}
                  aria-label="청첩장 열기"
                  disabled={introPhase === "opening"}
                >
                  <span className="intro-gate__tap-visual" aria-hidden>
                    <span className="intro-gate__tap-ring" />
                    <span className="intro-gate__tap-icon" />
                  </span>
                  <span className="intro-gate__tap-label">탭하여 열기</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="phone-shell">
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

        <main className="content">
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
              <HourglassInteractive />
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
