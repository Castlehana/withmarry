import { isValidWeddingId } from "./wedding-data";
import { rsvpApiUrl, rsvpUsesRemote } from "./rsvp-api";

const STORAGE_PREFIX = "withmarry_rsvp_v1";

export type RsvpStoredSide = "groom" | "bride";
export type RsvpStoredAttend = "yes" | "no";
export type RsvpStoredMeal = "yes" | "no" | "undecided" | "";

export type RsvpSubmission = {
  id: string;
  submittedAt: string;
  side: RsvpStoredSide;
  name: string;
  attend: RsvpStoredAttend;
  meal: RsvpStoredMeal;
};

export const RSVP_CHANGE_EVENT = "withmarry-rsvp-change";

function storageKey(weddingId: string): string {
  return `${STORAGE_PREFIX}:${weddingId}`;
}

/** `storage` 이벤트 등에서 키 일치 확인용 */
export function getRsvpStorageKey(weddingId: string): string {
  return storageKey(weddingId);
}

function notifyChange(weddingId: string): void {
  window.dispatchEvent(new CustomEvent(RSVP_CHANGE_EVENT, { detail: { weddingId } }));
}

function parseOneSubmission(row: unknown): RsvpSubmission | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.submittedAt !== "string" || typeof o.name !== "string") return null;
  if (o.side !== "groom" && o.side !== "bride") return null;
  if (o.attend !== "yes" && o.attend !== "no") return null;
  const meal = o.meal;
  if (meal !== "" && meal !== "yes" && meal !== "no" && meal !== "undecided") return null;
  return {
    id: o.id,
    submittedAt: o.submittedAt,
    side: o.side,
    name: o.name,
    attend: o.attend,
    meal: meal as RsvpStoredMeal,
  };
}

export function loadRsvpSubmissions(weddingId: string): RsvpSubmission[] {
  if (!isValidWeddingId(weddingId)) return [];
  try {
    const raw = localStorage.getItem(storageKey(weddingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RsvpSubmission[] = [];
    for (const row of parsed) {
      const p = parseOneSubmission(row);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

/** D1 API에서 목록 (관리자 비밀번호 = Bearer 토큰) */
export async function loadRsvpSubmissionsFromRemote(
  weddingId: string,
  adminPassword: string
): Promise<RsvpSubmission[]> {
  if (!isValidWeddingId(weddingId)) return [];
  const url = `${rsvpApiUrl("/api/rsvp/list")}?weddingId=${encodeURIComponent(weddingId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${adminPassword}` },
    credentials: "same-origin",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; submissions?: unknown[] };
  if (!data.ok || !Array.isArray(data.submissions)) return [];
  const out: RsvpSubmission[] = [];
  for (const row of data.submissions) {
    const p = parseOneSubmission(row);
    if (p) out.push(p);
  }
  return out;
}

/**
 * 관리자 참석 목록 — **localStorage 사용 안 함**, D1 `GET /api/rsvp/list` 만.
 * API가 꺼져 있거나(`!rsvpUsesRemote`) 비밀번호가 없으면 빈 배열.
 */
export async function loadAllRsvpSubmissions(
  weddingId: string,
  adminPassword: string | null
): Promise<RsvpSubmission[]> {
  if (!rsvpUsesRemote()) return [];
  const p = adminPassword?.trim();
  if (!p) return [];
  return loadRsvpSubmissionsFromRemote(weddingId, p);
}

export async function submitRsvpSubmission(
  weddingId: string,
  row: Omit<RsvpSubmission, "id" | "submittedAt">
): Promise<RsvpSubmission | null> {
  if (!isValidWeddingId(weddingId)) return null;

  if (rsvpUsesRemote()) {
    const res = await fetch(rsvpApiUrl("/api/rsvp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        weddingId,
        side: row.side,
        name: row.name,
        attend: row.attend,
        meal: row.meal,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; submission?: unknown };
    if (!res.ok || !data.ok) return null;
    const sub = parseOneSubmission(data.submission);
    if (sub) notifyChange(weddingId);
    return sub;
  }

  const full: RsvpSubmission = {
    ...row,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    submittedAt: new Date().toISOString(),
  };
  const prev = loadRsvpSubmissions(weddingId);
  prev.push(full);
  localStorage.setItem(storageKey(weddingId), JSON.stringify(prev));
  notifyChange(weddingId);
  return full;
}

function deleteRsvpSubmissionLocal(weddingId: string, submissionId: string): boolean {
  if (!isValidWeddingId(weddingId)) return false;
  const prev = loadRsvpSubmissions(weddingId);
  const next = prev.filter((r) => r.id !== submissionId);
  if (next.length === prev.length) return false;
  localStorage.setItem(storageKey(weddingId), JSON.stringify(next));
  notifyChange(weddingId);
  return true;
}

async function deleteRsvpSubmissionRemote(
  weddingId: string,
  submissionId: string,
  adminPassword: string
): Promise<boolean> {
  const path = `/api/rsvp/${encodeURIComponent(submissionId)}?weddingId=${encodeURIComponent(weddingId)}`;
  const res = await fetch(rsvpApiUrl(path), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminPassword}` },
    credentials: "same-origin",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { ok?: boolean };
  if (!data.ok) return false;
  notifyChange(weddingId);
  return true;
}

/** 참석 한 건 삭제 (로컬 또는 D1). 원격 모드는 관리자 비밀번호 Bearer 필요. */
export async function deleteRsvpSubmission(
  weddingId: string,
  submissionId: string,
  adminPassword: string | null
): Promise<boolean> {
  const sid = submissionId.trim();
  if (!isValidWeddingId(weddingId) || !sid) return false;
  if (rsvpUsesRemote()) {
    if (!adminPassword) return false;
    return deleteRsvpSubmissionRemote(weddingId, sid, adminPassword);
  }
  return deleteRsvpSubmissionLocal(weddingId, sid);
}

function sideLabel(side: RsvpStoredSide): string {
  return side === "groom" ? "신랑" : "신부";
}

function attendLabel(attend: RsvpStoredAttend): string {
  return attend === "yes" ? "참석" : "불참석";
}

function mealLabel(r: RsvpSubmission): string {
  if (r.attend === "no") return "해당 없음";
  if (r.meal === "yes") return "O (식사)";
  if (r.meal === "no") return "X (식사 없음)";
  if (r.meal === "undecided") return "미정";
  return "—";
}

function formatSubmittedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export async function downloadRsvpXlsx(weddingId: string, rows: RsvpSubmission[]): Promise<void> {
  const XLSX = await import("xlsx");
  const sheetRows = rows.map((r) => ({
    제출일시: formatSubmittedAt(r.submittedAt),
    하객측: sideLabel(r.side),
    성함: r.name,
    참석: attendLabel(r.attend),
    식사: mealLabel(r),
  }));
  const ws = sheetRows.length
    ? XLSX.utils.json_to_sheet(sheetRows)
    : XLSX.utils.aoa_to_sheet([["제출일시", "하객측", "성함", "참석", "식사"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "참석");
  const ab = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array;
  const blob = new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rsvp-${weddingId}.xlsx`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRsvpBackupJson(weddingId: string, rows: RsvpSubmission[]): string {
  const payload = { v: 1 as const, weddingId, submissions: rows };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function importRsvpBackupJsonMerge(
  weddingId: string,
  text: string
): { ok: true; merged: number } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "JSON 형식이 아닙니다." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "데이터가 비어 있습니다." };
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return { ok: false, error: "지원하지 않는 백업 버전입니다." };
  if (o.weddingId !== weddingId) return { ok: false, error: "백업의 웨딩 ID가 현재 관리 중인 ID와 다릅니다." };
  if (!Array.isArray(o.submissions)) return { ok: false, error: "submissions 배열이 없습니다." };
  const incoming: RsvpSubmission[] = [];
  for (const item of o.submissions) {
    const p = parseOneSubmission(item);
    if (p) incoming.push(p);
  }
  const existing = loadRsvpSubmissions(weddingId);
  const byId = new Map<string, RsvpSubmission>();
  for (const r of existing) {
    byId.set(r.id, r);
  }
  let merged = 0;
  for (const r of incoming) {
    if (!byId.has(r.id)) {
      byId.set(r.id, r);
      merged += 1;
    }
  }
  localStorage.setItem(storageKey(weddingId), JSON.stringify([...byId.values()]));
  notifyChange(weddingId);
  return { ok: true, merged };
}

export async function importRsvpBackupJsonMergeRemote(
  weddingId: string,
  text: string,
  adminPassword: string
): Promise<{ ok: true; merged: number } | { ok: false; error: string }> {
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "JSON 형식이 아닙니다." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "데이터가 비어 있습니다." };
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return { ok: false, error: "지원하지 않는 백업 버전입니다." };
  if (o.weddingId !== weddingId) return { ok: false, error: "백업의 웨딩 ID가 현재 관리 중인 ID와 다릅니다." };
  if (!Array.isArray(o.submissions)) return { ok: false, error: "submissions 배열이 없습니다." };

  const res = await fetch(rsvpApiUrl("/api/rsvp/import"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminPassword}`,
    },
    credentials: "same-origin",
    body: JSON.stringify({ weddingId, submissions: o.submissions }),
  });
  const out = (await res.json()) as { ok?: boolean; merged?: number; error?: string };
  if (!res.ok || !out.ok) {
    return { ok: false, error: typeof out.error === "string" ? out.error : "가져오기 실패" };
  }
  const merged = typeof out.merged === "number" ? out.merged : 0;
  notifyChange(weddingId);
  return { ok: true, merged };
}
