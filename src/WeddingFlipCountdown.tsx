import { useEffect, useRef } from "react";
import "./WeddingFlipCountdown.css";

type Props = {
  targetDate: Date;
  groomName: string;
  brideName: string;
};

type TimeParts = {
  Days: number;
  Hours: number;
  Minutes: number;
  Seconds: number;
};

function getTimeRemaining(endtime: number): { Total: number } & TimeParts {
  const t = endtime - Date.now();
  const safe = Math.max(0, t);
  return {
    Total: t,
    Days: Math.floor(safe / (1000 * 60 * 60 * 24)),
    Hours: Math.floor((safe / (1000 * 60 * 60)) % 24),
    Minutes: Math.floor((safe / 1000 / 60) % 60),
    Seconds: Math.floor((safe / 1000) % 60),
  };
}

/**
 * 정답 JS의 CountdownTracker 로직을 그대로 옮긴 헬퍼.
 * top/bottom/back/backBottom 4개 노드를 직접 조작한다.
 */
function createTracker(piece: HTMLSpanElement, pad2: boolean) {
  const top = piece.querySelector<HTMLElement>(".wfc-card__top")!;
  const bottom = piece.querySelector<HTMLElement>(".wfc-card > .wfc-card__bottom")!;
  const back = piece.querySelector<HTMLElement>(".wfc-card__back")!;
  const backBottom = piece.querySelector<HTMLElement>(".wfc-card__back .wfc-card__bottom")!;

  let currentValue: string | null = null;

  return {
    update(val: number) {
      const formatted = pad2
        ? String(Math.max(0, val)).padStart(2, "0")
        : String(Math.max(0, val));

      if (formatted === currentValue) return;

      // 첫 렌더: 애니메이션 없이 값만 세팅
      if (currentValue === null) {
        currentValue = formatted;
        top.innerText = formatted;
        bottom.setAttribute("data-value", formatted);
        backBottom.setAttribute("data-value", formatted);
        return;
      }

      // 이전 값 → back/bottom-front (떨어지기 전 상태)
      back.setAttribute("data-value", currentValue);
      bottom.setAttribute("data-value", currentValue);

      // 새 값 → top + back-bottom (떨어진 후 보일 면)
      currentValue = formatted;
      top.innerText = formatted;
      backBottom.setAttribute("data-value", formatted);

      // 리플로우 후 애니메이션 트리거
      piece.classList.remove("wfc-piece--flip");
      void piece.offsetWidth;
      piece.classList.add("wfc-piece--flip");
    },
  };
}

export function WeddingFlipCountdown({ targetDate, groomName, brideName }: Props) {
  const targetMs = targetDate.getTime();

  const daysRef = useRef<HTMLSpanElement>(null);
  const hoursRef = useRef<HTMLSpanElement>(null);
  const minutesRef = useRef<HTMLSpanElement>(null);
  const secondsRef = useRef<HTMLSpanElement>(null);
  const srRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!daysRef.current || !hoursRef.current || !minutesRef.current || !secondsRef.current) {
      return;
    }

    const trackers = {
      Days: createTracker(daysRef.current, false),
      Hours: createTracker(hoursRef.current, true),
      Minutes: createTracker(minutesRef.current, true),
      Seconds: createTracker(secondsRef.current, true),
    };

    let rafId = 0;
    let i = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      // 정답 코드의 throttle 패턴 (10프레임에 1번만 업데이트)
      if (i++ % 10) return;

      const t = getTimeRemaining(targetMs);

      if (t.Total < 0) {
        cancelAnimationFrame(rafId);
        trackers.Days.update(0);
        trackers.Hours.update(0);
        trackers.Minutes.update(0);
        trackers.Seconds.update(0);
        if (srRef.current) {
          srRef.current.textContent = "결혼식 당일입니다.";
        }
        return;
      }

      trackers.Days.update(t.Days);
      trackers.Hours.update(t.Hours);
      trackers.Minutes.update(t.Minutes);
      trackers.Seconds.update(t.Seconds);

      if (srRef.current) {
        srRef.current.textContent = `결혼식까지 ${t.Days}일 ${t.Hours}시간 ${t.Minutes}분 ${t.Seconds}초 남았습니다.`;
      }
    };

    // 정답 코드와 동일하게 약간 딜레이 후 시작
    const startId = window.setTimeout(tick, 500);

    return () => {
      window.clearTimeout(startId);
      cancelAnimationFrame(rafId);
    };
  }, [targetMs]);

  const title = `${groomName.trim()} ♥ ${brideName.trim()} 결혼식까지`;

  return (
    <section className="wfc-root" aria-labelledby="wfc-heading" lang="ko">
      <h2 id="wfc-heading" className="wfc-title">
        {title}
      </h2>
      <p ref={srRef} className="wfc-sr" aria-live="polite" />
      <div className="wfc-flip-clock" role="presentation">
        <span ref={daysRef} className="wfc-piece">
          <b className="wfc-card wfc-card--days">
            <b className="wfc-card__top" />
            <b className="wfc-card__bottom" />
            <b className="wfc-card__back">
              <b className="wfc-card__bottom" />
            </b>
          </b>
          <span className="wfc-slot">Days</span>
        </span>
        <span ref={hoursRef} className="wfc-piece">
          <b className="wfc-card">
            <b className="wfc-card__top" />
            <b className="wfc-card__bottom" />
            <b className="wfc-card__back">
              <b className="wfc-card__bottom" />
            </b>
          </b>
          <span className="wfc-slot">Hours</span>
        </span>
        <span ref={minutesRef} className="wfc-piece">
          <b className="wfc-card">
            <b className="wfc-card__top" />
            <b className="wfc-card__bottom" />
            <b className="wfc-card__back">
              <b className="wfc-card__bottom" />
            </b>
          </b>
          <span className="wfc-slot">Minutes</span>
        </span>
        <span ref={secondsRef} className="wfc-piece">
          <b className="wfc-card">
            <b className="wfc-card__top" />
            <b className="wfc-card__bottom" />
            <b className="wfc-card__back">
              <b className="wfc-card__bottom" />
            </b>
          </b>
          <span className="wfc-slot">Seconds</span>
        </span>
      </div>
    </section>
  );
}