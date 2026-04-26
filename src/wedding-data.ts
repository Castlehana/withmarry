import type { WeddingData, WeddingDateInput } from "./wedding-data.types";

/** 기본 청첩장 데이터 폴더 (`public/weddings/{id}/`) */
export const DEFAULT_WEDDING_ID = "sample01";

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

/** URL 세그먼트용 웨딩 ID (경로 침입 방지) */
export function isValidWeddingId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/** `public/weddings/{id}/` 기준 fetch URL 접두 — 끝에 `/` 포함 */
export function weddingBundleBaseUrl(weddingId: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const enc = encodeURIComponent(weddingId);
  return `${base}weddings/${enc}/`;
}

/** `#` 주석 제거 후 JSON 파싱·날짜 필드 보강 */
export function parseWeddingDataFromRaw(raw: string): WeddingData {
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
export function expandNamePlaceholders(data: WeddingData): WeddingData {
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

/** `public/weddings/{weddingId}/wedding-data.txt` 로드 */
export async function fetchWeddingData(weddingId: string): Promise<WeddingData> {
  const url = `${weddingBundleBaseUrl(weddingId)}wedding-data.txt`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`wedding-data 로드 실패 (${res.status}): ${url}`);
  }
  const raw = await res.text();
  return expandNamePlaceholders(parseWeddingDataFromRaw(raw));
}

/** 해당 웨딩 폴더에 `wedding-data.txt`가 있는지 (관리자 로그인 전 번들 확인) */
export async function weddingDataBundleExists(weddingId: string): Promise<boolean> {
  if (!isValidWeddingId(weddingId)) return false;
  const url = `${weddingBundleBaseUrl(weddingId)}wedding-data.txt`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * `public/weddings/{id}/admin-password.txt` 첫 줄(또는 전체 trim).
 * 파일 없음·빈 내용이면 기본값 `0000`. `#` 시작 줄은 무시.
 */
export async function fetchAdminExpectedPassword(weddingId: string): Promise<string> {
  if (!isValidWeddingId(weddingId)) return "0000";
  const url = `${weddingBundleBaseUrl(weddingId)}admin-password.txt`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", cache: "no-store" });
  } catch {
    return "0000";
  }
  if (!res.ok) return "0000";
  const raw = await res.text();
  const stripped = stripLeadingHashComments(raw).trim();
  if (!stripped) return "0000";
  const firstLine = stripped.split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.length > 0 ? firstLine : "0000";
}
