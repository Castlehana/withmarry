/**
 * 방명록 서버 미연결 시(또는 API 실패 시) 개발·로컬 테스트용 저장소.
 * PIN은 평문으로 저장되므로 프로덕션 전용 데이터로 사용하지 말 것.
 */
import type { GuestbookEntry, GuestbookSide } from "./guestbook-types";

type StoredRow = GuestbookEntry & { _pin: string };

function storageKey(weddingId: string): string {
  return `withmarry:guestbook:v1:${encodeURIComponent(weddingId)}`;
}

function readRows(weddingId: string): StoredRow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(weddingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is StoredRow =>
        r &&
        typeof r === "object" &&
        typeof (r as StoredRow).id === "string" &&
        typeof (r as StoredRow)._pin === "string"
    );
  } catch {
    return [];
  }
}

function writeRows(weddingId: string, rows: StoredRow[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(weddingId), JSON.stringify(rows));
  } catch {
    /* quota 등 */
  }
}

export function localGuestbookRead(weddingId: string): GuestbookEntry[] {
  return readRows(weddingId).map(({ _pin: _p, ...e }) => e);
}

export function localGuestbookCreate(payload: {
  weddingId: string;
  side: GuestbookSide;
  authorName: string;
  body: string;
  password: string;
}): GuestbookEntry {
  const rows = readRows(payload.weddingId);
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = new Date().toISOString();
  const entry: GuestbookEntry = {
    id,
    weddingId: payload.weddingId,
    side: payload.side,
    authorName: payload.authorName,
    body: payload.body,
    createdAt,
  };
  rows.unshift({ ...entry, _pin: payload.password });
  writeRows(payload.weddingId, rows);
  return entry;
}

export function localGuestbookVerifyPin(weddingId: string, entryId: string, pin: string): boolean {
  const row = readRows(weddingId).find((r) => r.id === entryId);
  return row !== undefined && row._pin === pin;
}

export function localGuestbookUpdate(
  weddingId: string,
  id: string,
  payload: { password: string; authorName: string; body: string }
): boolean {
  const rows = readRows(weddingId);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0 || rows[i]!._pin !== payload.password) return false;
  rows[i] = { ...rows[i]!, authorName: payload.authorName, body: payload.body };
  writeRows(weddingId, rows);
  return true;
}

export function localGuestbookDelete(weddingId: string, id: string, password: string): boolean {
  const rows = readRows(weddingId);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0 || rows[i]!._pin !== password) return false;
  rows.splice(i, 1);
  writeRows(weddingId, rows);
  return true;
}

export function isLocalGuestbookEntryId(id: string): boolean {
  return id.startsWith("local-");
}
