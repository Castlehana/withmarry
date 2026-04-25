import type { WeddingData, WeddingDateInput } from "./wedding-data.types";
import raw from "./wedding-data.txt?raw";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** `wedding.date` → `dateTimeISO`·`saveTheDateNums` (또는 구형 `dateTimeISO`만 있으면 `date` 보완) */
function applyWeddingDateFields(
  wedding: WeddingData["wedding"] & { dateTimeISO?: string; saveTheDateNums?: string; date?: WeddingDateInput }
) {
  let y: number;
  let m: number;
  let d: number;

  if (wedding.date && typeof wedding.date.year === "number") {
    ({ year: y, month: m, day: d } = wedding.date);
  } else if (wedding.dateTimeISO) {
    const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(wedding.dateTimeISO);
    if (!p) {
      throw new Error("wedding.dateTimeISO는 YYYY-MM-DD로 시작해야 합니다.");
    }
    y = +p[1];
    m = +p[2];
    d = +p[3];
    wedding.date = { year: y, month: m, day: d };
  } else {
    throw new Error("wedding에 date { year, month, day }를 넣어 주세요. (구형: dateTimeISO만)");
  }

  if (!isValidYmd(y, m, d)) {
    throw new Error(`wedding.date가 유효한 날짜가 아닙니다: ${y}-${m}-${d}`);
  }

  wedding.dateTimeISO = `${y}-${pad2(m)}-${pad2(d)}T13:00:00+09:00`;
  const y2 = y % 100;
  wedding.saveTheDateNums = `${String(y2).padStart(2, "0")} · ${m} · ${d}`;
}

function stripLeadingHashComments(source: string) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
}

function loadWeddingData(): WeddingData {
  const json = stripLeadingHashComments(raw);
  try {
    const data = JSON.parse(json) as WeddingData;
    applyWeddingDateFields(data.wedding);
    return data;
  } catch (e) {
    console.error("wedding-data.txt JSON 파싱 실패:", e);
    throw new Error("wedding-data.txt 형식을 확인해 주세요. (# 주석 다음 유효한 JSON)");
  }
}

/** `wedding-data.txt` 안 문자열에 넣은 `{{groom.성이름}}` 등을 실제 이름으로 치환 */
function expandNamePlaceholders(data: WeddingData): WeddingData {
  const { groom, bride } = data.couple;
  const rep: Record<string, string> = {
    "{{groom.성이름}}": groom.성이름,
    "{{groom.이름}}": groom.이름,
    "{{bride.성이름}}": bride.성이름,
    "{{bride.이름}}": bride.이름,
    "{{groomFatherName}}": data.couple.groomFatherName,
    "{{groomMotherName}}": data.couple.groomMotherName,
    "{{brideFatherName}}": data.couple.brideFatherName,
    "{{brideMotherName}}": data.couple.brideMotherName,
  };

  const applyString = (s: string) => {
    let out = s;
    for (const [token, val] of Object.entries(rep)) {
      out = out.split(token).join(val);
    }
    return out;
  };

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return applyString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, walk(val)])
      );
    }
    return v;
  };

  const expanded = walk(data) as WeddingData;
  if (!expanded.couple.topBarTitle?.trim()) {
    expanded.couple.topBarTitle = `${expanded.couple.groom.이름} · ${expanded.couple.bride.이름}`;
  }
  return expanded;
}

export const weddingData: WeddingData = expandNamePlaceholders(loadWeddingData());
