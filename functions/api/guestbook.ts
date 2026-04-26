import type { PagesFunction } from "@cloudflare/workers-types";
import { guestbookDbJsonError, hashGuestbookPin, isValidGuestbookPin, isValidWeddingId } from "../_guestbookShared";

type Env = { DB: D1Database; GUESTBOOK_PEPPER?: string };

type Body = {
  weddingId?: string;
  side?: string;
  authorName?: string;
  body?: string;
  password?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const side = body.side;
  if (side !== "groom" && side !== "bride") {
    return json({ ok: false, error: "Invalid side" }, 400);
  }

  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : "";
  if (!authorName || authorName.length > 80) {
    return json({ ok: false, error: "Invalid name" }, 400);
  }

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 2000) {
    return json({ ok: false, error: "Invalid body" }, 400);
  }

  const pin = typeof body.password === "string" ? body.password.trim() : "";
  if (!isValidGuestbookPin(pin)) {
    return json({ ok: false, error: "Password must be 4 digits" }, 400);
  }

  const pepper = env.GUESTBOOK_PEPPER ?? "";
  const passwordHash = await hashGuestbookPin(weddingId, pin, pepper);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO guestbook_entries (id, wedding_id, side, author_name, body, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, weddingId, side, authorName, text, passwordHash, createdAt)
      .run();
  } catch (e) {
    const { status, body } = guestbookDbJsonError(e, "guestbook insert");
    return json(body, status);
  }

  return json({
    ok: true,
    entry: { id, weddingId, side, authorName, body: text, createdAt },
  });
};
