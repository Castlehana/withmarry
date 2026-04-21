import { useCallback, useEffect, useMemo, useState } from "react";
import { getCalendarWeeks } from "./calendar-grid";
import type { AccountRow, GreetingParagraph, InterviewBlock, InterviewItem } from "./wedding-data.types";
import { weddingData } from "./wedding-data";

const NAV: { id: string; label: string }[] = [
  { id: "main", label: "메인" },
  { id: "quote", label: "글귀" },
  { id: "greeting", label: "인사말" },
  { id: "intro", label: "소개" },
  { id: "calendar", label: "달력" },
  { id: "gallery", label: "갤러리" },
  { id: "interview", label: "웨딩 인터뷰" },
  { id: "map", label: "오시는 길" },
  { id: "notice", label: "안내문" },
  { id: "rsvp", label: "참석여부" },
  { id: "account", label: "계좌번호" },
  { id: "guestbook", label: "방명록" },
  { id: "timeline", label: "함께한 시간" },
  { id: "ending", label: "엔딩" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatDaysKo(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function weddingCountLabel(wedding: Date, c: (typeof weddingData)["countdown"]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(wedding.getFullYear(), wedding.getMonth(), wedding.getDate()).getTime();
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { head: c.headUntil, value: String(diffDays), tail: c.tailUntil };
  if (diffDays < 0) return { head: c.headPast, value: String(Math.abs(diffDays)), tail: c.tailPast };
  return { head: c.headToday, value: c.valueToday, tail: c.tailToday };
}

function GreetingLine({ paragraph }: { paragraph: GreetingParagraph }) {
  return (
    <p>
      {paragraph.segments.map(([text, bold], i) =>
        bold ? (
          <strong key={i}>{text}</strong>
        ) : (
          <span key={i}>{text}</span>
        )
      )}
    </p>
  );
}

function InterviewAnswer({ blocks }: { blocks: InterviewBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === "speaker" ? (
          <p key={i} className="qa-speaker">
            <span className="emoji">{b.emoji}</span> {b.name}
          </p>
        ) : (
          <p key={i}>{b.content}</p>
        )
      )}
    </>
  );
}

function CalendarMonth({
  year,
  month,
  weddingDay,
  ceremonyNote,
  caption,
}: {
  year: number;
  month: number;
  weddingDay: number;
  ceremonyNote: string;
  caption: string;
}) {
  const weeks = useMemo(() => getCalendarWeeks(year, month), [year, month]);
  return (
    <div className="cal-wrap">
      <p className="cal-caption">{caption}</p>
      <table className="cal-table">
        <thead>
          <tr>
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={cell === weddingDay ? "cal-wedding" : ""}>
                  {cell == null ? "" : cell === weddingDay ? <span className="cal-day">{cell}</span> : cell}
                  {cell === weddingDay ? <span className="cal-note">{ceremonyNote}</span> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const { meta, couple, wedding, calendar, countdown, greeting, poem, interview, map, reception, rsvp, accounts, contact, footer } =
    weddingData;

  const WEDDING = useMemo(() => new Date(wedding.dateTimeISO), [wedding.dateTimeISO]);
  const INTRO_FULL = meta.introTypingLine;

  const [menuOpen, setMenuOpen] = useState(false);
  const [musicHint, setMusicHint] = useState(true);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState<"typing" | "hold" | "fade" | "done">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "fade" : "typing"
  );
  const [introChars, setIntroChars] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? INTRO_FULL.length
      : 0
  );

  const count = useMemo(() => weddingCountLabel(WEDDING, countdown), [WEDDING, countdown]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    document.title = meta.documentTitle;
  }, [meta.documentTitle]);

  useEffect(() => {
    if (introPhase !== "typing") return;
    if (introChars >= INTRO_FULL.length) {
      setIntroPhase("hold");
      return;
    }
    const delay = introChars < 2 ? 140 : introChars > INTRO_FULL.length - 4 ? 100 : 72;
    const t = window.setTimeout(() => setIntroChars((c) => c + 1), delay);
    return () => window.clearTimeout(t);
  }, [introPhase, introChars, INTRO_FULL.length]);

  useEffect(() => {
    if (introPhase !== "hold") return;
    const t = window.setTimeout(() => setIntroPhase("fade"), 520);
    return () => window.clearTimeout(t);
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "fade") return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce ? 120 : 520;
    const t = window.setTimeout(() => setIntroPhase("done"), ms);
    return () => window.clearTimeout(t);
  }, [introPhase]);

  useEffect(() => {
    document.body.classList.toggle(
      "overflow-lock",
      menuOpen || rsvpOpen || privacyOpen || introPhase !== "done"
    );
    return () => document.body.classList.remove("overflow-lock");
  }, [menuOpen, rsvpOpen, privacyOpen, introPhase]);

  const coupleSignLine = `신랑 ${couple.groom.fullName}, 신부 ${couple.bride.fullName}`;
  const heroVenueLine = `${wedding.venueName} ${wedding.venueHall}`;

  return (
    <div className="desktop-stage">
      {introPhase !== "done" ? (
        <div
          className={`intro-loader${introPhase === "fade" ? " intro-loader--out" : ""}`}
          role="status"
          aria-live="polite"
          aria-busy={introPhase !== "done"}
        >
          <div className="intro-loader__inner">
            <p className="intro-loader__text">
              {INTRO_FULL.slice(0, introChars)}
              {introChars < INTRO_FULL.length ? <span className="intro-loader__caret" aria-hidden /> : null}
            </p>
          </div>
        </div>
      ) : null}

      <div className="phone-shell">
        <div className="sticky-head">
          {musicHint ? (
            <div className="music-hint" role="status">
              <span>배경음악이 준비 되었습니다.</span>
              <button type="button" className="music-hint-close" onClick={() => setMusicHint(false)} aria-label="닫기">
                ×
              </button>
            </div>
          ) : null}
          <header className="top-bar">
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="메뉴">
              <span className="hamburger" />
            </button>
            <span className="top-title">{couple.topBarTitle}</span>
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
              <h1 className="hero-names">
                <span>{couple.groom.fullName}</span>
                <span className="ampersand">&</span>
                <span>{couple.bride.fullName}</span>
              </h1>
              <p className="hero-venue">{heroVenueLine}</p>
              <div className="scroll-hint">
                <span>스크롤</span>
                <span className="chev" />
              </div>
            </div>
          </section>

          <section id="quote" className="section poem">
            <div className="poem-lines">
              {poem.lines.map((line, i) =>
                line === "" ? (
                  <p key={i} className="spacer" />
                ) : (
                  <p key={i}>{line}</p>
                )
              )}
            </div>
            <p className="poem-src">{poem.attribution}</p>
          </section>

          <section id="greeting" className="section greeting">
            <h2>{greeting.heading}</h2>
            {greeting.paragraphs.map((p, i) => (
              <GreetingLine key={i} paragraph={p} />
            ))}
          </section>

          <section id="intro" className="section couple">
            <div className="person-card groom">
              <div className="avatar groom-a" aria-hidden />
              <div>
                <p className="role">신랑</p>
                <p className="name">{couple.groom.fullName}</p>
                <p className="tag">{couple.groom.mbtiLine}</p>
                <p className="tag accent">{couple.groom.tagAccent}</p>
                <p className="desc">{couple.groom.description}</p>
              </div>
            </div>
            <div className="person-card bride">
              <div className="avatar bride-a" aria-hidden />
              <div>
                <p className="role">신부</p>
                <p className="name">{couple.bride.fullName}</p>
                <p className="tag">{couple.bride.mbtiLine}</p>
                <p className="tag accent">{couple.bride.tagAccent}</p>
                <p className="desc">{couple.bride.description}</p>
              </div>
            </div>
            <div className="parents">
              <p>{couple.groomParentsLine}</p>
              <p>{couple.brideParentsLine}</p>
            </div>
            <button type="button" className="text-link" onClick={() => scrollToId("contact-parents")}>
              혼주에게 연락하기
            </button>
          </section>

          <section id="calendar" className="section cal-section">
            <CalendarMonth
              year={calendar.year}
              month={calendar.month}
              weddingDay={calendar.weddingDay}
              ceremonyNote={calendar.ceremonyNote}
              caption={calendar.caption}
            />
            <div className="countdown">
              <p>{count.head}</p>
              <p className="count-big">{count.value}</p>
              <p>{count.tail}</p>
            </div>
          </section>

          <section id="gallery" className="section gallery">
            <h2>갤러리</h2>
            <div className="gallery-grid">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`g-cell g-${(i % 6) + 1}`}>
                  <span>{i + 1}</span>
                </div>
              ))}
            </div>
            <button type="button" className="outline-btn">
              더 보기
            </button>
          </section>

          <section id="interview" className="section interview">
            <h2>웨딩 인터뷰</h2>
            <p className="muted">두 분의 인터뷰를 준비했습니다.</p>
            <p className="muted">인터뷰를 확인해보세요.</p>
            <button type="button" className="outline-btn" onClick={() => setInterviewOpen(true)}>
              인터뷰 읽어보기
            </button>
          </section>

          <section id="map" className="section map">
            <h2>오시는 길</h2>
            <div className="map-card">
              <p className="map-place">{map.venueName}</p>
              <p>{map.hallLine}</p>
              <p className="addr">{map.address}</p>
              <div className="map-btns">
                {map.links.map((link) => (
                  <a key={link.href} className="map-chip" href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="trans">
              {map.transport.map((block) => (
                <div key={block.title}>
                  <h3>{block.title}</h3>
                  {block.lines.map((line, i) => (
                    <p
                      key={i}
                      className={
                        block.smallFromIndex != null && i >= block.smallFromIndex ? "small" : undefined
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section id="notice" className="section notice">
            <h2>{reception.title}</h2>
            {reception.paragraphs.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            <p className="sign">{reception.signLine}</p>
            <div className="notice-box">
              <p>{reception.boxAddressLine}</p>
              <p>{reception.boxWhenLine}</p>
              <button type="button" className="outline-btn sm" onClick={() => scrollToId("map")}>
                오시는 길
              </button>
            </div>
          </section>

          <section id="rsvp" className="section rsvp-intro">
            <h2>참석 여부 전달</h2>
            <p>{rsvp.intro}</p>
            <div className="rsvp-card">
              <p>{coupleSignLine}</p>
              <p>
                {formatDaysKo(WEDDING)} {wedding.ceremonyTimeLabel}
              </p>
              <p>{heroVenueLine}</p>
            </div>
            <button type="button" className="primary-btn" onClick={() => setRsvpOpen(true)}>
              참석 여부 전달
            </button>
            <label className="today-hide">
              <input type="checkbox" /> 오늘하루 보지않기
            </label>
          </section>

          <section id="account" className="section accounts">
            <h2>마음 전하실 곳</h2>
            <p>{accounts.intro}</p>
            <AccountBlock title={accounts.groomSideTitle} rows={accounts.groomSide} />
            <AccountBlock title={accounts.brideSideTitle} rows={accounts.brideSide} />
          </section>

          <section id="guestbook" className="section guestbook">
            <h2>방명록</h2>
            <div className="gb-actions">
              <button type="button" className="outline-btn">
                전체보기
              </button>
              <button type="button" className="primary-btn ghost">
                작성
              </button>
            </div>
          </section>

          <section id="timeline" className="section timeline">
            <h2>함께한 시간</h2>
            <p className="muted">추억이 담긴 순간들을 곧 채워 넣을 수 있어요.</p>
          </section>

          <section id="contact-parents" className="section contact">
            <h2>혼주에게 연락하기</h2>
            <div className="contact-grid">
              <div>
                <h3>{contact.groomSideHeading}</h3>
                <p>{contact.groomFather}</p>
                <p>{contact.groomMother}</p>
              </div>
              <div>
                <h3>{contact.brideSideHeading}</h3>
                <p>{contact.brideFather}</p>
                <p>{contact.brideMother}</p>
              </div>
            </div>
          </section>

          <footer id="ending" className="footer">
            <p className="heart">♥</p>
            <p>{footer.copyright}</p>
            <p className="small">
              {footer.creditBefore}
              <a href={footer.creditLinkHref} target="_blank" rel="noreferrer">
                {footer.creditLinkLabel}
              </a>
              {footer.creditAfter}
            </p>
          </footer>
        </main>

        {interviewOpen ? (
          <div className="modal" role="dialog" aria-modal="true" aria-label="웨딩 인터뷰">
            <div className="modal-back" onClick={() => setInterviewOpen(false)} />
            <div className="modal-sheet tall">
              <div className="modal-head">
                <h2>웨딩 인터뷰</h2>
                <button type="button" className="menu-close" onClick={() => setInterviewOpen(false)} aria-label="닫기">
                  ×
                </button>
              </div>
              <div className="modal-body">
                {interview.map((it: InterviewItem) => (
                  <article key={it.question} className="qa-block">
                    <h3>{it.question}</h3>
                    <div className="qa-a">
                      <InterviewAnswer blocks={it.blocks} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {rsvpOpen ? (
          <div className="modal" role="dialog" aria-modal="true" aria-label="참석 여부">
            <div className="modal-back" onClick={() => setRsvpOpen(false)} />
            <div className="modal-sheet">
              <div className="modal-head">
                <h2>참석 여부 전달</h2>
                <button type="button" className="menu-close" onClick={() => setRsvpOpen(false)} aria-label="닫기">
                  ×
                </button>
              </div>
              <form
                className="rsvp-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setRsvpOpen(false);
                }}
              >
                <label>
                  어느 측 하객이신가요? <span className="req">*</span>
                  <div className="seg">
                    <label>
                      <input type="radio" name="side" required /> 신랑
                    </label>
                    <label>
                      <input type="radio" name="side" /> 신부
                    </label>
                  </div>
                </label>
                <label>
                  참석여부 <span className="req">*</span>
                  <div className="seg">
                    <label>
                      <input type="radio" name="attend" required /> 참석
                    </label>
                    <label>
                      <input type="radio" name="attend" /> 불참석
                    </label>
                  </div>
                </label>
                <label>
                  식사여부 <span className="req">*</span>
                  <select required defaultValue="">
                    <option value="" disabled>
                      미정
                    </option>
                    <option>식사</option>
                    <option>식사 안 함</option>
                  </select>
                </label>
                <label>
                  성함 <span className="req">*</span>
                  <input required placeholder="홍길동" />
                </label>
                <label>
                  동행인 성함
                  <input placeholder="선택" />
                </label>
                <label>
                  전달사항
                  <textarea rows={3} placeholder="알려주실 내용이 있다면 적어주세요." />
                </label>
                <label className="inline-check">
                  <input type="checkbox" required />
                  개인정보 수집 및 활용 동의{" "}
                  <button type="button" className="linkish" onClick={() => setPrivacyOpen(true)}>
                    [자세히보기]
                  </button>
                </label>
                <button type="submit" className="primary-btn">
                  전달
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {privacyOpen ? (
          <div className="modal" role="dialog" aria-modal="true" aria-label="개인정보 동의">
            <div className="modal-back" onClick={() => setPrivacyOpen(false)} />
            <div className="modal-sheet">
              <div className="modal-head">
                <h2>(필수) 개인정보 수집 및 활용 동의</h2>
                <button type="button" className="menu-close" onClick={() => setPrivacyOpen(false)} aria-label="닫기">
                  ×
                </button>
              </div>
              <div className="modal-body legal">
                <p>
                  <strong>[수집 항목]</strong> 이름, 전화번호 등 RSVP에 입력된 항목
                </p>
                <p>
                  <strong>[이용 목적]</strong> 결혼식 참석 여부 확인 및 관련 서비스 제공
                </p>
                <p>
                  <strong>[보유 및 이용 기간]</strong> 동의일로부터 청첩장 유효기간 동안
                </p>
                <p>
                  <strong>[동의 거부권 및 불이익 사항]</strong> 동의 거부 시 서비스 이용 불가
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AccountBlock({ title, rows }: { title: string; rows: AccountRow[] }) {
  return (
    <div className="acc-group">
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.role}>
            <p className="acc-role">{row.role}</p>
            <p className="acc-num">{row.number}</p>
            <p className="acc-bank">{row.bankLine}</p>
            <div className="acc-actions">
              <button type="button" className="chip-btn">
                복사
              </button>
              <button type="button" className="chip-btn">
                PAY
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
