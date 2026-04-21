import { useCallback, useEffect, useMemo, useState } from "react";

const WEDDING = new Date("2026-11-21T13:00:00+09:00");

/** 로딩 화면 타이핑 문구 */
const INTRO_FULL = "김도연 ♥ 이지유 결혼합니다.";

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

function weddingCountLabel() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(WEDDING.getFullYear(), WEDDING.getMonth(), WEDDING.getDate()).getTime();
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return { head: "도연 · 지유 결혼식까지", value: String(diffDays), tail: "일 남았습니다." };
  if (diffDays < 0) return { head: "도연 · 지유의 결혼식이", value: String(Math.abs(diffDays)), tail: "일 지났습니다." };
  return { head: "오늘은", value: "바로", tail: "결혼식 당일입니다." };
}

const INTERVIEW = [
  {
    q: "1. 결혼하시는 소감이 어떠세요?",
    a: (
      <>
        <p className="qa-speaker">
          <span className="emoji">🤵🏻‍♂️</span> 도연
        </p>
        <p>
          인생은 지금부터 시작인 것 같아요. 앞으로 매일 함께 맛있는 밥을 먹고, 함께 기뻐하고, 함께 여행하고 모든 것을
          언제나 함께할 수 있다는 생각에 벌써부터 행복합니다. 😁
        </p>
        <p className="qa-speaker">
          <span className="emoji">👰🏻‍♀️</span> 지유
        </p>
        <p>
          매일 데이트하고 헤어질 때마다 아쉬웠는데 이제는 매일 함께 있을 수 있어서 행복해요. 💗 어떻게 하루를 보냈는지
          이야기하고 마주보며 웃는 그런 소박한 나날들을 보낼 생각에 설레입니다. 🥰
        </p>
      </>
    ),
  },
  {
    q: "2. 처음에 어떻게 만나셨어요?",
    a: (
      <p>
        인도네시아 여행 중에 여행가방을 통째로 잃어버려 어쩔 줄 몰라 하고 있을 때, 남편의 도움으로 가방도 찾고 무사히
        귀국할 수 있었어요. 그 모습이 어찌나 멋지고 듬직하던지 잊혀지지가 않습니다. 💕
      </p>
    ),
  },
  {
    q: "3. 신혼여행은 어디로 가시나요?",
    a: <p>바다를 좋아하는 저희는, 14박 15일 몰디브 🏝 로 떠납니다. ✈️</p>,
  },
  {
    q: "4. 신혼집은 어디인가요?",
    a: (
      <p>
        우리는 경치가 아름다운 양평에 아담한 집을 짓고 있어요! 편안하고 아늑한 공간을 만들기 위해 열심히 꾸미고 있어요.
        곧 새 집에서의 생활이 시작될 생각에 설레고 있어요!
      </p>
    ),
  },
];

function CalendarNovember2026() {
  const weeks = [
    [null, null, null, null, null, null, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, null, null, null, null, null, null],
  ];
  return (
    <div className="cal-wrap">
      <p className="cal-caption">십일월의 스물한 번째 날.</p>
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
                <td key={ci} className={cell === 21 ? "cal-wedding" : ""}>
                  {cell == null ? "" : cell === 21 ? <span className="cal-day">21</span> : cell}
                  {cell === 21 ? <span className="cal-note">오후 1시</span> : null}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [musicHint, setMusicHint] = useState(true);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState<"typing" | "hold" | "fade" | "done">(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "fade"
      : "typing"
  );
  const [introChars, setIntroChars] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? INTRO_FULL.length
      : 0
  );

  const count = useMemo(() => weddingCountLabel(), []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (introPhase !== "typing") return;
    if (introChars >= INTRO_FULL.length) {
      setIntroPhase("hold");
      return;
    }
    const delay = introChars < 2 ? 140 : introChars > INTRO_FULL.length - 4 ? 100 : 72;
    const t = window.setTimeout(() => setIntroChars((c) => c + 1), delay);
    return () => window.clearTimeout(t);
  }, [introPhase, introChars]);

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
            <span className="top-title">도연 · 지유</span>
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
              <p className="hero-date-nums">26 · 11 · 21</p>
              <p className="hero-date-line">{formatDaysKo(WEDDING)} 오후 1시</p>
              <h1 className="hero-names">
                <span>김도연</span>
                <span className="ampersand">&</span>
                <span>이지유</span>
              </h1>
              <p className="hero-venue">더살롱드웨딩홀 1층 레터홀</p>
              <div className="scroll-hint">
                <span>스크롤</span>
                <span className="chev" />
              </div>
            </div>
          </section>

          <section id="quote" className="section poem">
            <div className="poem-lines">
              <p>내가 그다지 사랑하던 그대여</p>
              <p>내 한 평생에 차마</p>
              <p>그대를 잊을 수 없소이다.</p>
              <p>내 차례에 못 올 사랑인 줄 알면서도</p>
              <p>나 혼자는 꾸준히 생각하리라.</p>
              <p className="spacer" />
              <p>자, 그러면 내내 어여쁘소서.</p>
            </div>
            <p className="poem-src">《이런 시》, 이상</p>
          </section>

          <section id="greeting" className="section greeting">
            <h2>소중한 분들을 초대합니다.</h2>
            <p>오늘도, 내일<strong>도</strong> 함께하고 싶은 사람이 생겼습니다.</p>
            <p>
              함께라는 걸 당<strong>연</strong>하게 생각하지 않겠습니다.
            </p>
            <p>
              서로가 함께한<strong>지</strong> 10년, 평생을 함께하려 합니다.
            </p>
            <p>
              김도연, 이지<strong>유</strong> 결혼식에 초대합니다.
            </p>
          </section>

          <section id="intro" className="section couple">
            <div className="person-card groom">
              <div className="avatar groom-a" aria-hidden />
              <div>
                <p className="role">신랑</p>
                <p className="name">김도연</p>
                <p className="tag">다정한 사랑꾼 ESFJ</p>
                <p className="tag accent">빵 굽는 남자</p>
                <p className="desc">사교적, 열정적, 적응력</p>
              </div>
            </div>
            <div className="person-card bride">
              <div className="avatar bride-a" aria-hidden />
              <div>
                <p className="role">신부</p>
                <p className="name">이지유</p>
                <p className="tag">세상의 소금형 ISTJ</p>
                <p className="tag accent">붓질하는 여자</p>
                <p className="desc">책임감, 논리적, 헌신</p>
              </div>
            </div>
            <div className="parents">
              <p>故 김종혁 · 故 최은혜의 장남</p>
              <p>故 이주영 · 故 강지은의 장녀</p>
            </div>
            <button type="button" className="text-link" onClick={() => scrollToId("contact-parents")}>
              혼주에게 연락하기
            </button>
          </section>

          <section id="calendar" className="section cal-section">
            <CalendarNovember2026 />
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
              <p className="map-place">더살롱드웨딩홀</p>
              <p>1층 레터홀</p>
              <p className="addr">제주특별자치도 서귀포시 중앙로 105</p>
              <div className="map-btns">
                <a className="map-chip" href="https://tmap.co.kr/" target="_blank" rel="noreferrer">
                  티맵
                </a>
                <a className="map-chip" href="https://map.kakao.com/" target="_blank" rel="noreferrer">
                  카카오내비
                </a>
                <a className="map-chip" href="https://map.naver.com/" target="_blank" rel="noreferrer">
                  네이버지도
                </a>
              </div>
            </div>
            <div className="trans">
              <h3>🚌 버스</h3>
              <p>000번, 000번, 000번</p>
              <p className="small">살롱드레터 정류소 하차 후 도보 3분</p>
              <h3>🚆 지하철</h3>
              <p>1호선: 살롱드레터 역 1번 출구 하차</p>
              <p>2호선: 살롱드레터 역 2번 출구 하차</p>
              <p className="small">출구 나와서 우측 신호등 건너 셔틀버스 탑승 또는 도보 5분</p>
              <h3>🚗 자차</h3>
              <p>살롱드레터 주차장 검색</p>
              <p>살롱드레터 웨딩홀 검색</p>
            </div>
          </section>

          <section id="notice" className="section notice">
            <h2>피로연 안내</h2>
            <p>거리가 멀어 본식에 참석하지 못하시는 분들을 위해 피로연 자리를 마련하였습니다.</p>
            <p>부디 참석하시어 두 사람의 앞날을 축복해 주시길 바랍니다.</p>
            <p className="sign">신랑 김도연, 신부 이지유</p>
            <div className="notice-box">
              <p>📍 제주도 서귀포시 천지연로 00-00</p>
              <p>⏰ 2023년 5월 14일 토요일 오후 1시</p>
              <button type="button" className="outline-btn sm" onClick={() => scrollToId("map")}>
                오시는 길
              </button>
            </div>
          </section>

          <section id="rsvp" className="section rsvp-intro">
            <h2>참석 여부 전달</h2>
            <p>
              소중한 시간을 내어 결혼식에 참석해 주시는 모든 분들께 감사드립니다. 예식이 지정좌석제로 진행되오니, 참석
              여부를 회신해 주시면 더욱 감사하겠습니다.
            </p>
            <div className="rsvp-card">
              <p>신랑 김도연, 신부 이지유</p>
              <p>{formatDaysKo(WEDDING)} 오후 1시</p>
              <p>더살롱드웨딩홀 1층 레터홀</p>
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
            <p>
              비대면으로 축하를 전하고자 하시는 분들을 위해 계좌번호를 기재하였습니다. 너그러운 마음으로 양해
              부탁드립니다.
            </p>
            <AccountBlock title="신랑측" rows={[["신랑", "1111-1111-1111-1111", "카카오뱅크 김도연"], ["신랑 아버지", "1111-1111-1111-1111", "카카오뱅크 김종혁"], ["신랑 어머니", "1111-1111-1111-1111", "카카오뱅크 최은혜"]]} />
            <AccountBlock title="신부측" rows={[["신부", "1111-1111-1111-1111", "카카오뱅크 이지유"], ["신부 아버지", "1111-1111-1111-1111", "카카오뱅크 이주영"], ["신부 어머니", "1111-1111-1111-1111", "카카오뱅크 강지은"]]} />
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
                <h3>신랑측</h3>
                <p>아버지 김종혁</p>
                <p>어머니 최은혜</p>
              </div>
              <div>
                <h3>신부측</h3>
                <p>아버지 이주영</p>
                <p>어머니 강지은</p>
              </div>
            </div>
          </section>

          <footer id="ending" className="footer">
            <p className="heart">♥</p>
            <p>COPYRIGHT NeedIT. All rights reserved.</p>
            <p className="small">
              본 페이지는{" "}
              <a href="https://salondeletter.com/w/sample1_3" target="_blank" rel="noreferrer">
                살롱드레터 샘플
              </a>
              을 참고한 데모입니다.
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
                {INTERVIEW.map((it) => (
                  <article key={it.q} className="qa-block">
                    <h3>{it.q}</h3>
                    <div className="qa-a">{it.a}</div>
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

function AccountBlock({ title, rows }: { title: string; rows: [string, string, string][] }) {
  return (
    <div className="acc-group">
      <h3>{title}</h3>
      <ul>
        {rows.map(([role, num, bank]) => (
          <li key={role}>
            <p className="acc-role">{role}</p>
            <p className="acc-num">{num}</p>
            <p className="acc-bank">{bank}</p>
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
