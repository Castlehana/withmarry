import { useMemo } from "react";

const WEEKDAYS: readonly string[] = ["일", "월", "화", "수", "목", "금", "토"];

/** 12~2 겨울(하늘), 3~5 봄(분홍), 6~8 여름(초록), 9~11 가을(가을색) */
type CalendarPalette = "winter" | "spring" | "summer" | "autumn";

function getCalendarPalette(jsMonthIndex: number): CalendarPalette {
  const m = jsMonthIndex + 1; /* 1~12 */
  if (m === 12 || m === 1 || m === 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "autumn";
}

type Props = {
  weddingDate: Date;
};

/**
 * `wedding.date`(로드 시 `dateTimeISO`와 동일한 날) 기준 월 그리드 — 식·예식이 있는 날(당일)만 강조합니다.
 * (월 이동 없이 해당 월만 표시)
 */
export function WeddingCalendar({ weddingDate }: Props) {
  const year = weddingDate.getFullYear();
  const month = weddingDate.getMonth();
  const weddingDay = weddingDate.getDate();
  const palette = getCalendarPalette(month);

  const { monthLabel, rows } = useMemo(() => {
    const first = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startPad = first.getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const r: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      r.push(cells.slice(i, i + 7) as (number | null)[]);
    }
    const monthLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(first);
    return { monthLabel, rows: r };
  }, [year, month]);

  return (
    <div
      className={`wedding-calendar wedding-calendar--${palette}`}
      id="wedding-calendar"
      role="group"
      aria-label={`${monthLabel} 결혼식 일정, ${weddingDay}일`}
    >
      <div className="wedding-calendar__head">
        <h2 className="wedding-calendar__month">{monthLabel}</h2>
      </div>
      <div className="wedding-calendar__body">
        <table className="wedding-calendar__table">
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} className="wedding-calendar__weekname" scope="col">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((day, di) => {
                  if (day == null) {
                    return <td key={di} className="wedding-calendar__td wedding-calendar__td--empty" aria-hidden />;
                  }
                  const isWedding = day === weddingDay;
                  return (
                    <td key={day} className="wedding-calendar__td">
                      <span
                        className={
                          isWedding
                            ? "wedding-calendar__day wedding-calendar__day--wedding"
                            : "wedding-calendar__day"
                        }
                        aria-current={isWedding ? "date" : undefined}
                      >
                        {day}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
