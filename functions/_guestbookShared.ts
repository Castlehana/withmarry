import { isValidWeddingId } from "./_rsvpShared";

export { isValidWeddingId };

/** D1에 `guestbook_entries` 마이그레이션이 없을 때 나는 오류 */
export function isGuestbookTableMissingError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("no such table") && msg.includes("guestbook_entries");
}

export function guestbookDbJsonError(e: unknown, logPrefix: string): { status: number; body: Record<string, unknown> } {
  console.error(logPrefix, e);
  if (isGuestbookTableMissingError(e)) {
    return { status: 503, body: { ok: false, error: "guestbook_table_missing" } };
  }
  return { status: 500, body: { ok: false, error: "Database error" } };
}

export type GuestbookSide = "groom" | "bride";

export async function hashGuestbookPin(weddingId: string, pin: string, pepper: string): Promise<string> {
  const p = pepper.trim() || "withmarry-guestbook-pepper-set-GUESTBOOK_PEPPER";
  const text = `${weddingId}|${pin}|${p}`;
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidGuestbookPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** 방명록 글의 4자리 PIN이 DB 해시와 일치하는지 */
export async function guestbookPinMatchesStored(
  db: D1Database,
  weddingId: string,
  entryId: string,
  pin: string,
  pepper: string
): Promise<boolean> {
  if (!isValidGuestbookPin(pin)) return false;
  const hash = await hashGuestbookPin(weddingId, pin, pepper);
  const row = await db
    .prepare(`SELECT password_hash FROM guestbook_entries WHERE id = ? AND wedding_id = ? LIMIT 1`)
    .bind(entryId, weddingId)
    .first<{ password_hash: string }>();
  return row?.password_hash === hash;
}
