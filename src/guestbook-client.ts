import { rsvpApiUrl, rsvpUsesRemote } from "./rsvp-api";

export type GuestbookSide = "groom" | "bride";

export type GuestbookEntry = {
  id: string;
  weddingId: string;
  side: GuestbookSide;
  authorName: string;
  body: string;
  createdAt: string;
};

export function guestbookUsesRemote(): boolean {
  return rsvpUsesRemote();
}

const GUESTBOOK_DB_NOT_READY_KO =
  "방명록용 DB 테이블이 아직 없습니다. 프로젝트 루트에서 `npx wrangler d1 migrations apply withmarry-rsvp --remote`(DB 이름은 wrangler.toml과 동일)를 실행한 뒤 다시 시도해 주세요.";

function mapGuestbookApiError(code: string | undefined): string {
  if (code === "guestbook_table_missing") return GUESTBOOK_DB_NOT_READY_KO;
  return typeof code === "string" && code.length > 0 ? code : "요청에 실패했습니다.";
}

export type GuestbookListResult = { entries: GuestbookEntry[]; error: string | null };

export async function fetchGuestbookList(weddingId: string): Promise<GuestbookListResult> {
  const url = rsvpApiUrl(`/api/guestbook/list?weddingId=${encodeURIComponent(weddingId)}`);
  const res = await fetch(url);
  let data: { ok?: boolean; entries?: GuestbookEntry[]; error?: string };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { entries: [], error: "목록을 불러오지 못했습니다." };
  }
  if (data.error === "guestbook_table_missing") {
    return { entries: [], error: GUESTBOOK_DB_NOT_READY_KO };
  }
  if (!res.ok || !data.ok || !Array.isArray(data.entries)) {
    if (!data.ok && typeof data.error === "string" && data.error.length > 0) {
      return { entries: [], error: mapGuestbookApiError(data.error) };
    }
    return { entries: [], error: !res.ok ? "목록을 불러오지 못했습니다." : null };
  }
  const entries = data.entries.filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      (e.side === "groom" || e.side === "bride") &&
      typeof e.authorName === "string" &&
      typeof e.body === "string"
  );
  return { entries, error: null };
}

export async function createGuestbookEntry(payload: {
  weddingId: string;
  side: GuestbookSide;
  authorName: string;
  body: string;
  password: string;
}): Promise<{ ok: true; entry: GuestbookEntry } | { ok: false; error: string }> {
  const res = await fetch(rsvpApiUrl("/api/guestbook"), {
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
  const data = (await res.json()) as { ok?: boolean; error?: string; entry?: GuestbookEntry };
  if (!res.ok || !data.ok || !data.entry) {
    return { ok: false, error: mapGuestbookApiError(data.error) };
  }
  return { ok: true, entry: data.entry };
}

/** 수정·삭제 전 PIN만 검증 (본문 변경 없음) */
export async function verifyGuestbookEntryPin(weddingId: string, entryId: string, pin: string): Promise<boolean> {
  const res = await fetch(rsvpApiUrl("/api/guestbook/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weddingId, entryId, password: pin }),
  });
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
  const res = await fetch(rsvpApiUrl(`/api/guestbook/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      weddingId: payload.weddingId,
      password: payload.password,
      authorName: payload.authorName,
      body: payload.body,
    }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return res.ok && data.ok === true;
}

export async function deleteGuestbookEntryAsAuthor(
  id: string,
  weddingId: string,
  password: string
): Promise<boolean> {
  const res = await fetch(rsvpApiUrl(`/api/guestbook/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weddingId, password }),
  });
  const data = (await res.json()) as { ok?: boolean };
  return res.ok && data.ok === true;
}

export async function adminDeleteGuestbookEntries(
  weddingId: string,
  bearer: string,
  opts: { ids: string[] } | { deleteAll: true }
): Promise<{ ok: boolean; removed?: number; error?: string }> {
  const body =
    "deleteAll" in opts && opts.deleteAll
      ? { weddingId, deleteAll: true }
      : { weddingId, ids: opts.ids };
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
