import {
  isLocalGuestbookEntryId,
  localGuestbookCreate,
  localGuestbookDelete,
  localGuestbookRead,
  localGuestbookUpdate,
  localGuestbookVerifyPin,
} from "./guestbook-local-store";
import type { GuestbookEntry, GuestbookSide } from "./guestbook-types";
import { rsvpApiUrl, rsvpUsesRemote } from "./rsvp-api";

export type { GuestbookEntry, GuestbookSide } from "./guestbook-types";

export function guestbookUsesRemote(): boolean {
  return rsvpUsesRemote();
}

const GUESTBOOK_DB_NOT_READY_KO =
  "방명록용 DB 테이블이 아직 없습니다. 프로젝트 루트에서 `npx wrangler d1 migrations apply withmarry-rsvp --remote`(DB 이름은 wrangler.toml과 동일)를 실행한 뒤 다시 시도해 주세요.";

function mapGuestbookApiError(code: string | undefined): string {
  if (code === "guestbook_table_missing") return GUESTBOOK_DB_NOT_READY_KO;
  return typeof code === "string" && code.length > 0 ? code : "요청에 실패했습니다.";
}

export type GuestbookListResult = {
  entries: GuestbookEntry[];
  error: string | null;
  /** 서버 대신(또는 실패 후) 이 브라우저 localStorage만 사용 중 */
  usedLocalStore?: boolean;
};

function listFromLocal(weddingId: string): GuestbookListResult {
  return { entries: localGuestbookRead(weddingId), error: null, usedLocalStore: true };
}

export async function fetchGuestbookList(weddingId: string): Promise<GuestbookListResult> {
  if (!guestbookUsesRemote()) {
    return listFromLocal(weddingId);
  }

  const url = rsvpApiUrl(`/api/guestbook/list?weddingId=${encodeURIComponent(weddingId)}`);
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return listFromLocal(weddingId);
  }

  let data: { ok?: boolean; entries?: GuestbookEntry[]; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return listFromLocal(weddingId);
  }

  if (data.error === "guestbook_table_missing") {
    return listFromLocal(weddingId);
  }

  if (!res.ok || !data.ok || !Array.isArray(data.entries)) {
    const httpClientErr = res.status >= 400 && res.status < 500;
    if (httpClientErr && typeof data.error === "string" && data.error.length > 0) {
      return { entries: [], error: mapGuestbookApiError(data.error), usedLocalStore: false };
    }
    return listFromLocal(weddingId);
  }

  const entries = data.entries.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      (e.side === "groom" || e.side === "bride") &&
      typeof e.authorName === "string" &&
      typeof e.body === "string"
  );
  return { entries, error: null, usedLocalStore: false };
}

export async function createGuestbookEntry(payload: {
  weddingId: string;
  side: GuestbookSide;
  authorName: string;
  body: string;
  password: string;
}): Promise<{ ok: true; entry: GuestbookEntry } | { ok: false; error: string }> {
  if (!guestbookUsesRemote()) {
    return { ok: true, entry: localGuestbookCreate(payload) };
  }

  let res: Response;
  try {
    res = await fetch(rsvpApiUrl("/api/guestbook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weddingId: payload.weddingId,
        side: payload.side,
        authorName: payload.authorName,
        body: payload.body,
        password: payload.password,
      }),
    });
  } catch {
    return { ok: true, entry: localGuestbookCreate(payload) };
  }

  let data: { ok?: boolean; error?: string; entry?: GuestbookEntry };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: true, entry: localGuestbookCreate(payload) };
  }

  if (res.ok && data.ok && data.entry) {
    return { ok: true, entry: data.entry };
  }

  const clientErr = res.status >= 400 && res.status < 500;
  if (clientErr && typeof data.error === "string" && data.error.length > 0) {
    return { ok: false, error: mapGuestbookApiError(data.error) };
  }

  return { ok: true, entry: localGuestbookCreate(payload) };
}

/** 수정·삭제 전 PIN만 검증 (본문 변경 없음) */
export async function verifyGuestbookEntryPin(weddingId: string, entryId: string, pin: string): Promise<boolean> {
  if (isLocalGuestbookEntryId(entryId)) {
    return localGuestbookVerifyPin(weddingId, entryId, pin);
  }
  if (!guestbookUsesRemote()) {
    return localGuestbookVerifyPin(weddingId, entryId, pin);
  }

  let res: Response;
  try {
    res = await fetch(rsvpApiUrl("/api/guestbook/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weddingId, entryId, password: pin }),
    });
  } catch {
    return false;
  }
  let data: { ok?: boolean };
  try {
    data = (await res.json()) as { ok?: boolean };
  } catch {
    return false;
  }
  return data.ok === true;
}

export async function updateGuestbookEntry(
  id: string,
  payload: { weddingId: string; password: string; authorName: string; body: string }
): Promise<boolean> {
  if (isLocalGuestbookEntryId(id) || !guestbookUsesRemote()) {
    return localGuestbookUpdate(payload.weddingId, id, {
      password: payload.password,
      authorName: payload.authorName,
      body: payload.body,
    });
  }

  let res: Response;
  try {
    res = await fetch(rsvpApiUrl(`/api/guestbook/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weddingId: payload.weddingId,
        password: payload.password,
        authorName: payload.authorName,
        body: payload.body,
      }),
    });
  } catch {
    return false;
  }
  let data: { ok?: boolean };
  try {
    data = (await res.json()) as { ok?: boolean };
  } catch {
    return false;
  }
  return res.ok && data.ok === true;
}

export async function deleteGuestbookEntryAsAuthor(
  id: string,
  weddingId: string,
  password: string
): Promise<boolean> {
  if (isLocalGuestbookEntryId(id) || !guestbookUsesRemote()) {
    return localGuestbookDelete(weddingId, id, password);
  }

  let res: Response;
  try {
    res = await fetch(rsvpApiUrl(`/api/guestbook/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weddingId, password }),
    });
  } catch {
    return false;
  }
  let data: { ok?: boolean };
  try {
    data = (await res.json()) as { ok?: boolean };
  } catch {
    return false;
  }
  return res.ok && data.ok === true;
}

export async function adminDeleteGuestbookEntries(
  weddingId: string,
  bearer: string,
  opts: { ids: string[] } | { deleteAll: true }
): Promise<{ ok: boolean; removed?: number; error?: string }> {
  const body = "ids" in opts ? { weddingId, ids: opts.ids } : { weddingId, deleteAll: true };
  const res = await fetch(rsvpApiUrl("/api/guestbook/admin/delete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok?: boolean; removed?: number; error?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: mapGuestbookApiError(data.error) };
  }
  return { ok: true, removed: data.removed };
}
