import type { PagesFunction } from "@cloudflare/workers-types";
import { guestbookDbJsonError, guestbookPinMatchesStored, isValidGuestbookPin, isValidWeddingId } from "../../_guestbookShared";

type Env = { DB: D1Database; GUESTBOOK_PEPPER?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { weddingId?: string; entryId?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const entryId = typeof body.entryId === "string" ? body.entryId.trim() : "";
  if (!entryId || entryId.length > 128) {
    return json({ ok: false, error: "Invalid entryId" }, 400);
  }

  const pin = typeof body.password === "string" ? body.password.trim() : "";
  if (!isValidGuestbookPin(pin)) {
    return json({ ok: false });
  }

  try {
    const ok = await guestbookPinMatchesStored(env.DB, weddingId, entryId, pin, env.GUESTBOOK_PEPPER ?? "");
    return json({ ok });
  } catch (e) {
    const { status, body: errBody } = guestbookDbJsonError(e, "guestbook verify");
    return json(errBody, status);
  }
};
