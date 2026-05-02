import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Navigate, useParams } from "react-router-dom";
import type { WeddingLoadErrorState } from "./WeddingLoadErrorPage";
import { useScrollRevealRoot } from "./useScrollRevealRoot";
import { HeadsetSineWaves } from "./HeadsetSineWaves";
import { HourglassInteractive, type HourglassInterludeShellMode } from "./HourglassInteractive";
import {
  DEFAULT_WEDDING_ID,
  fetchWeddingData,
  isValidWeddingId,
  weddingBundleBaseUrl,
} from "./wedding-data";
import type { WeddingData } from "./wedding-data.types";
import { copyTextToClipboard } from "./clipboardUtils";
import { CopyFeedbackToast } from "./CopyFeedbackToast";
import { useCopyFeedbackToast } from "./useCopyFeedbackToast";
import { HeartAccountsSection } from "./HeartAccountsSection";
import { HeroParentsContact } from "./HeroParentsContact";
import { RsvpAttendanceSection } from "./RsvpAttendanceSection";
import { GuestbookSection } from "./GuestbookSection";
import { WeddingCalendar } from "./WeddingCalendar";
import { WeddingFlipCountdown } from "./WeddingFlipCountdown";
import { DirectionsNavLinks } from "./DirectionsNavLinks";
import { DirectionsTransportToggles } from "./DirectionsTransportToggles";
import { WeddingShareFab } from "./WeddingShareFab";
import { buildWeddingPageAbsoluteUrl } from "./kakaoSdk";
import { WeddingCircularGallery } from "./WeddingCircularGallery";
import { WeddingGalleryGrid } from "./WeddingGalleryGrid";
import { IntroTypingOverlay } from "./IntroTypingOverlay";
import { HeroSakuraPetals } from "./HeroSakuraPetals";
import { MainBgmToggle } from "./MainBgmToggle";
import "./audio-hint-waves";

/** `directionsNote` 한 줄에서 이모지·픽토그램만 제거 (본문은 유지) */
function stripDirectionNoteEmojis(line: string): string {
  return line
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F|\u200D/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** `wedding.heroImage`에서 확장자 제거 후 `.png` 우선, 로드 실패 시 `.jpg` */
function weddingHeroImageUrls(weddingAssetBase: string, heroImageFile: string): { png: string; jpg: string } {
  const stem = heroImageFile.trim().replace(/\.(png|jpe?g|webp)$/i, "");
  return {
    png: `${weddingAssetBase}${stem}.png`,
    jpg: `${weddingAssetBase}${stem}.jpg`,
  };
}

type HeroBwTone = "black" | "white" | "darkIvory";

/** 히어로 텍스트 톤. 그 외·생략 → `legacy` → 최종 흰색. */
function resolveHeroBwTone(explicit: unknown, legacy: unknown): HeroBwTone {
  if (explicit === "black") return "black";
  if (explicit === "white") return "white";
  if (explicit === "darkIvory") return "darkIvory";
  if (legacy === "black") return "black";
  if (legacy === "white") return "white";
  return "white";
}

/** 1=아래, 10=위. 1–10 정수만, 아니면 2. */
function resolveHeroScrollCuePosition(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isFinite(n)) return 2;
  return Math.min(10, Math.max(1, Math.round(n)));
}

/** `heroImage` 있을 때만: sticky 히어로의 부모 높이가 본문까지 포함되어 스크롤 내내 사진이 고정되고 본문이 위로 덮임 */
function WeddingHeroScrollInner({
  active,
  heroSrcPng,
  heroSrcJpg,
  heroGivenNamesLine,
  heroNameTone,
  heroInfoTone,
  heroScrollCueTone,
  heroScrollCuePosition,
  heroDateTimeLine,
  heroVenueLine,
  reduceMotion,
  children,
}: {
  active: boolean;
  heroSrcPng: string;
  heroSrcJpg: string;
  /** `couple.groom.heroGivenNameEn` + 공백 + `couple.bride.heroGivenNameEn` 한 줄 */
  heroGivenNamesLine?: string;
  heroNameTone: HeroBwTone;
  heroInfoTone: HeroBwTone;
  heroScrollCueTone: HeroBwTone;
  heroScrollCuePosition: number;
  heroDateTimeLine: string;
  heroVenueLine: string;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const [heroImgSrc, setHeroImgSrc] = useState(heroSrcPng);
  useEffect(() => {
    setHeroImgSrc(heroSrcPng);
  }, [heroSrcPng, heroSrcJpg]);

  const scrollCueStyle = {
    "--wedding-hero-scroll-cue-pos": heroScrollCuePosition,
  } as CSSProperties;

  const onScrollCueClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("main");
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  if (!active) {
    return children;
  }
  return (
    <div className="wedding-hero-scroll-inner">
      <div className="wedding-hero-sticky">
        <img
          className="wedding-hero-img"
          src={heroImgSrc}
          alt=""
          decoding="async"
          fetchPriority="high"
          aria-hidden
          onError={() => {
            setHeroImgSrc((prev) => (prev === heroSrcPng ? heroSrcJpg : prev));
          }}
        />
        <div className="wedding-hero-sticky__paper-grain" aria-hidden />
        <HeroSakuraPetals />
        <div className="wedding-hero-sticky__hero-tagline" aria-hidden>
          {heroGivenNamesLine ? (
            <div className="wedding-hero-sticky__en-names" data-hero-bw-tone={heroNameTone}>
              {heroGivenNamesLine}
            </div>
          ) : null}
        </div>
        <div className="wedding-hero-sticky__event-info" data-hero-bw-tone={heroInfoTone} aria-hidden>
          <p>{heroDateTimeLine}</p>
          <p>{heroVenueLine}</p>
        </div>
        <a
          href="#main"
          className="wedding-hero-sticky__scroll-cue"
          style={scrollCueStyle}
          data-hero-bw-tone={heroScrollCueTone}
          aria-label="아래 본문으로 이동"
          onClick={onScrollCueClick}
        >
          <span className="wedding-hero-sticky__scroll-cue-box" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </a>
      </div>
      {children}
    </div>
  );
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
  const { weddingId: rid } = useParams();
  /** 주소에 id 세그먼트가 없으면(예: `/` 또는 basename만) 기본 샘플로 */
  if (!rid?.trim()) {
    return <Navigate to={`/${DEFAULT_WEDDING_ID}`} replace />;
  }
  const id = rid.trim();
  if (!isValidWeddingId(id)) {
    return <Navigate to={`/${DEFAULT_WEDDING_ID}`} replace />;
  }
  return <WeddingApp weddingId={id} />;
}

type WeddingAppProps = { weddingId: string };

function WeddingApp({ weddingId }: WeddingAppProps) {
  const [bundle, setBundle] = useState<WeddingData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [introActive, setIntroActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setLoadErr(null);
    void fetchWeddingData(weddingId)
      .then((d) => {
        if (!cancelled) setBundle(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [weddingId]);

  if (loadErr) {
    const errState: WeddingLoadErrorState = { weddingId, message: loadErr };
    return <Navigate to="/wedding-load-error" replace state={errState} />;
  }

  if (!bundle) {
    return (
      <>
        {introActive ? <IntroTypingOverlay onComplete={() => setIntroActive(false)} /> : null}
        <div className="wedding-load-screen wedding-load-screen--intro-backdrop" aria-busy="true" aria-label="청첩장 로딩 중" />
      </>
    );
  }

  return (
    <WeddingAppContent
      weddingId={weddingId}
      data={bundle}
      introActive={introActive}
      onIntroComplete={() => setIntroActive(false)}
    />
  );
}

type WeddingAppContentProps = {
  weddingId: string;
  data: WeddingData;
  introActive: boolean;
  onIntroComplete: () => void;
};

function WeddingAppContent({ weddingId, data, introActive, onIntroComplete }: WeddingAppContentProps) {
  const { meta, couple, wedding } = data;
  const weddingAssetBase = weddingBundleBaseUrl(weddingId);
  const heroImageFile = wedding.heroImage?.trim();
  const heroImageUrls = heroImageFile ? weddingHeroImageUrls(weddingAssetBase, heroImageFile) : null;
  const heroGivenNamesLine = [couple.groom.heroGivenNameEn?.trim(), couple.bride.heroGivenNameEn?.trim()]
    .filter((s): s is string => Boolean(s && s.length > 0))
    .join(" & ");
  const legacyHeroTone = wedding.heroGivenNamesTone;
  const heroNameTone = resolveHeroBwTone(wedding.heroNameTone, legacyHeroTone);
  const heroInfoTone = resolveHeroBwTone(wedding.heroInfoTone, legacyHeroTone);
  const heroScrollCueTone = resolveHeroBwTone(wedding.heroScrollCueTone, legacyHeroTone);
  const heroScrollCuePosition = resolveHeroScrollCuePosition(wedding.heroScrollCuePosition);

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
  const [ourStoryStartSignal, setOurStoryStartSignal] = useState(0);
  const [introHandwritingMaxWidth, setIntroHandwritingMaxWidth] = useState<number | null>(null);
  const { open: copyToastOpen, closing: copyToastClosing, notify: notifyCopied, close: closeCopyToast } =
    useCopyFeedbackToast();

  useScrollRevealRoot(
    mainContentRef,
    [hourglassShellMode, introActive, heroImageUrls?.png],
    heroImageUrls ? phoneShellRef : undefined
  );

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
  }, [weddingId, data]);

  useEffect(() => {
    document.title = meta.documentTitle;
  }, [meta.documentTitle]);

  useEffect(() => {
    document.body.classList.toggle("overflow-lock", introActive || hourglassScrollLock);
  }, [hourglassScrollLock, introActive]);

  useEffect(() => {
    const shell = phoneShellRef.current;
    const main = mainContentRef.current;
    if (!shell) return;
    const log = () => {
      const shellW = shell.clientWidth;
      const mainW = main?.clientWidth ?? null;
      setIntroHandwritingMaxWidth(mainW ?? shellW);
      console.log(
        "[withmarry] 콘텐츠 영역 너비",
        `phone-shell: ${shellW}px`,
        mainW != null ? `main.content: ${mainW}px` : "main.content: (없음)"
      );
    };
    log();
    const ro = new ResizeObserver(() => log());
    ro.observe(shell);
    if (main) ro.observe(main);
    return () => ro.disconnect();
  }, [hourglassShellMode]);

  const heroVenueLine = `${wedding.venueName} ${wedding.venueHall}`;
  const heroDateTimeLine = `${wedding.saveTheDateNums} ${wedding.ceremonyTimeLabel}`;
  const groomMbti = splitMbtiLine(couple.groom.mbtiLine);
  const brideMbti = splitMbtiLine(couple.bride.mbtiLine);

  const copyDirectionsStreetAddress = useCallback(() => {
    const t = wedding.venueAddress?.trim();
    if (!t) return;
    void copyTextToClipboard(t).then(() => notifyCopied());
  }, [notifyCopied, wedding.venueAddress]);

  const sharePageUrl = useMemo(() => buildWeddingPageAbsoluteUrl(weddingId), [weddingId]);
  const kakaoShareImageUrl = useMemo((): string | null => {
    const u = data.meta.kakaoShareImageUrl?.trim();
    if (u) return u;
    if (heroImageUrls) {
      return new URL(heroImageUrls.png, window.location.origin).href;
    }
    return null;
  }, [data.meta.kakaoShareImageUrl, heroImageUrls]);

  return (
    <>
      <MainBgmToggle />
      <svg className="paper-filter-defs" aria-hidden width={0} height={0}>
        <defs>
          <filter id="roughpaper" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" result="noise" numOctaves="5" />
            <feDiffuseLighting in="noise" lightingColor="#fff" surfaceScale={2}>
              <feDistantLight azimuth={45} elevation={60} />
            </feDiffuseLighting>
          </filter>
        </defs>
      </svg>
    <div className="desktop-stage">
      {introActive ? (
        <IntroTypingOverlay onComplete={onIntroComplete} maxWidthPx={introHandwritingMaxWidth} />
      ) : null}
      <div className="desktop-stage__phone-wrap">
        <div
          ref={phoneShellRef}
          className={`phone-shell${heroImageUrls ? " phone-shell--wedding-hero" : ""}`}
          data-hourglass-interlude={hourglassShellMode !== "normal" ? "" : undefined}
          data-hourglass-interlude-exit-reveal={hourglassShellMode === "exit-reveal" ? "" : undefined}
          {...(introActive || hourglassShellMode !== "normal" ? { inert: true } : {})}
        >
        <WeddingHeroScrollInner
          active={Boolean(heroImageUrls)}
          heroSrcPng={heroImageUrls?.png ?? ""}
          heroSrcJpg={heroImageUrls?.jpg ?? ""}
          heroGivenNamesLine={heroGivenNamesLine || undefined}
          heroNameTone={heroNameTone}
          heroInfoTone={heroInfoTone}
          heroScrollCueTone={heroScrollCueTone}
          heroScrollCuePosition={heroScrollCuePosition}
          heroDateTimeLine={heroDateTimeLine}
          heroVenueLine={heroVenueLine}
          reduceMotion={reduceIntroMotion}
        >
          <main
            ref={mainContentRef}
            className={`content${heroImageUrls ? " content--wedding-hero" : ""}`}
            aria-hidden={introActive || hourglassShellMode === "interlude" ? true : undefined}
          >
          <CopyFeedbackToast open={copyToastOpen} closing={copyToastClosing} onClose={closeCopyToast} />
          <section id="invitation" className="section invitation" lang="ko" aria-labelledby="invitation-heading">
            <h2 id="invitation-heading" data-title-en="INVITATION">초대합니다</h2>
            <div className="invitation__body">
              <p>
                서로가 마주보며 다져온 사랑을<br />
                이제 함께 한 곳을 바라보며<br />
                걸어갈 수 있는 큰 사랑으로 키우고자 합니다.
              </p>
              <p>
                저희 두 사람이 사랑의 이름으로<br />
                지켜나갈 수 있도록 앞날을<br />
                축복해 주시면 감사하겠습니다.
              </p>
            </div>
          </section>
          <section id="main" className="hero">
            <div className="hero-inner">
              <div data-scroll-reveal="" data-scroll-reveal-delay-ms="90">
                <div className="profile-circular-gallery">
                  <WeddingCircularGallery weddingId={weddingId} reduceMotion={reduceIntroMotion} />
                </div>
                <section className="hero-couple-intro" aria-labelledby="profile-heading">
                  <h2 id="profile-heading" className="hero-couple-intro__title" data-title-en="PROFILE">우리의 소개</h2>
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
              <section className="wedding-calendar-wrap" aria-labelledby="wedding-date-heading">
                <h2 id="wedding-date-heading" className="wedding-calendar-wrap__title" data-title-en="DATE">
                  예식일
                </h2>
                <div data-scroll-reveal="" data-scroll-reveal-delay-ms="128">
                  <WeddingCalendar weddingDate={WEDDING} />
                </div>
                <WeddingFlipCountdown
                  targetDate={WEDDING}
                  groomName={couple.groom.이름}
                  brideName={couple.bride.이름}
                />
              </section>
              <div data-scroll-reveal="" data-scroll-reveal-delay-ms="150">
                <RsvpAttendanceSection
                  weddingId={weddingId}
                  groomName={couple.groom.이름}
                  brideName={couple.bride.이름}
                  block={couple.rsvpAttendance}
                />
              </div>
            </div>
          </section>

          <section id="our-stroy" className="section our-stroy" lang="ko">
            <h2 data-title-en="OUR STORY">우리 이야기</h2>
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
            <div className="our-story-back-preview" data-scroll-reveal="" data-scroll-reveal-delay-ms="120">
              <figure className="our-story-back-preview__item">
                <img
                  className="our-story-back-preview__img"
                  src={`${weddingAssetBase}static/${encodeURIComponent("Our Story")}/Back/01_boy/back.png`}
                  alt="우리 이야기 01페이지 배경 이미지"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <figure className="our-story-back-preview__item">
                <img
                  className="our-story-back-preview__img"
                  src={`${weddingAssetBase}static/${encodeURIComponent("Our Story")}/Back/01_girl/back.png`}
                  alt="우리 이야기 02페이지 배경 이미지"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
            <div className="our-story-action" data-scroll-reveal="" data-scroll-reveal-delay-ms="180">
              <button
                type="button"
                className="our-story-action__btn"
                onClick={() => setOurStoryStartSignal((n) => n + 1)}
              >
                연애 스토리 살펴보기
              </button>
            </div>
            <HourglassInteractive
              key={weddingId}
              weddingId={weddingId}
              couple={couple}
              startSignal={ourStoryStartSignal}
              hideTrigger
              onScrollLockChange={setHourglassScrollLock}
              onInterludePageChange={setHourglassShellMode}
            />
          </section>

          <section id="gallery" className="section wedding-circular-gallery-section" lang="ko" aria-labelledby="gallery-heading">
            <h2 id="gallery-heading" data-title-en="GALLERY">갤러리</h2>
            <div data-scroll-reveal="" data-scroll-reveal-delay-ms="140">
              <WeddingGalleryGrid weddingId={weddingId} />
            </div>
          </section>

          <section id="guestbook" className="section guestbook" aria-labelledby="guestbook-heading" lang="ko">
            <h2 id="guestbook-heading" data-title-en="GUESTBOOK">방명록</h2>
            <GuestbookSection weddingId={weddingId} />
          </section>

          {wedding.heartAccounts ? <HeartAccountsSection block={wedding.heartAccounts} /> : null}

          <section id="directions" className="section directions" aria-labelledby="directions-heading">
            <h2 id="directions-heading" data-title-en="LOCATION">오시는 길</h2>
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
                src={`${weddingAssetBase}directions-map.png`}
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

          <section className="closing-photo" aria-label="감사 인사">
            <img
              className="hero-title-photo hero-title-photo--pre-footer"
              src={`${weddingAssetBase}title-couple.png`}
              alt={`${couple.groom.성이름}, ${couple.bride.성이름}`}
              loading="lazy"
              decoding="async"
            />
            <div className="closing-photo__message">
              <p className="closing-photo__heart" aria-hidden="true">
                ♥
              </p>
              <p className="closing-photo__title">THANK YOU</p>
              <p className="closing-photo__text">저희의 새로운 시작을 응원해 주세요.</p>
            </div>
            <footer className="site-credit closing-photo__credit" role="contentinfo">
              <p className="site-credit__text">Powered by withmarry</p>
            </footer>
          </section>
        </main>
        </WeddingHeroScrollInner>
        <WeddingShareFab
          pageUrl={sharePageUrl}
          shareTitle={meta.documentTitle}
          shareDescription={meta.introTypingLine}
          shareImageUrl={kakaoShareImageUrl}
          envKakaoKey={import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY}
          metaKakaoKey={data.meta.kakaoJavaScriptKey}
          onLinkCopied={notifyCopied}
        />
        </div>
      </div>
    </div>
    </>
  );
}
