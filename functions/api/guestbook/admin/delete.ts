import type { PagesFunction } from "@cloudflare/workers-types";
import { guestbookDbJsonError } from "../../../_guestbookShared";
import { fetchExpectedAdminPassword, getBearerPassword, isValidWeddingId } from "../../../_rsvpShared";

type Env = { DB: D1Database; PUBLIC_SITE_BASE?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const bearer = getBearerPassword(request);
  if (!bearer) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: { weddingId?: string; ids?: unknown; deleteAll?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const expected = await fetchExpectedAdminPassword(request.url, weddingId, env.PUBLIC_SITE_BASE);
  if (bearer !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const deleteAll = body.deleteAll === true;
  let removed = 0;

  try {
    if (deleteAll) {
      const r = await env.DB.prepare(`DELETE FROM guestbook_entries WHERE wedding_id = ?`).bind(weddingId).run();
      removed = (r.meta as { changes?: number }).changes ?? 0;
    } else {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return json({ ok: false, error: "ids required unless deleteAll" }, 400);
      }
      const ids = body.ids.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 128);
      if (ids.length === 0) {
        return json({ ok: false, error: "No valid ids" }, 400);
      }
      const placeholders = ids.map(() => "?").join(", ");
      const stmt = `DELETE FROM guestbook_entries WHERE wedding_id = ? AND id IN (${placeholders})`;
      const r = await env.DB.prepare(stmt)
        .bind(weddingId, ...ids)
        .run();
      removed = (r.meta as { changes?: number }).changes ?? 0;
    }
  } catch (e) {
    const { status, body } = guestbookDbJsonError(e, "guestbook admin delete");
    return json(body, status);
  }

  return json({ ok: true, removed });
};
