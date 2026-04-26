import type { PagesFunction } from "@cloudflare/workers-types";
import {
  guestbookDbJsonError,
  guestbookPinMatchesStored,
  isValidGuestbookPin,
  isValidWeddingId,
} from "../../_guestbookShared";

type Env = { DB: D1Database; GUESTBOOK_PEPPER?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function verifyPin(env: Env, weddingId: string, entryId: string, pin: string): Promise<boolean> {
  return guestbookPinMatchesStored(env.DB, weddingId, entryId, pin, env.GUESTBOOK_PEPPER ?? "");
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const entryId = typeof params.id === "string" ? params.id.trim() : "";
  if (!entryId || entryId.length > 128) {
    return json({ ok: false, error: "Invalid id" }, 400);
  }

  let body: { weddingId?: string; password?: string; authorName?: string; body?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const pin = typeof body.password === "string" ? body.password.trim() : "";
  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : undefined;
  const text = typeof body.body === "string" ? body.body.trim() : undefined;
  if (authorName === undefined && text === undefined) {
    return json({ ok: false, error: "Nothing to update" }, 400);
  }
  if (authorName !== undefined && (!authorName || authorName.length > 80)) {
    return json({ ok: false, error: "Invalid name" }, 400);
  }
  if (text !== undefined && (!text || text.length > 2000)) {
    return json({ ok: false, error: "Invalid body" }, 400);
  }

  try {
    const okPin = await verifyPin(env, weddingId, entryId, pin);
    if (!okPin) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (authorName !== undefined && text !== undefined) {
      const r = await env.DB.prepare(
        `UPDATE guestbook_entries SET author_name = ?, body = ? WHERE id = ? AND wedding_id = ?`
      )
        .bind(authorName, text, entryId, weddingId)
        .run();
      if (((r.meta as { changes?: number }).changes ?? 0) === 0) {
        return json({ ok: false, error: "Not found" }, 404);
      }
    } else if (authorName !== undefined) {
      const r = await env.DB.prepare(`UPDATE guestbook_entries SET author_name = ? WHERE id = ? AND wedding_id = ?`)
        .bind(authorName, entryId, weddingId)
        .run();
      if (((r.meta as { changes?: number }).changes ?? 0) === 0) {
        return json({ ok: false, error: "Not found" }, 404);
      }
    } else if (text !== undefined) {
      const r = await env.DB.prepare(`UPDATE guestbook_entries SET body = ? WHERE id = ? AND wedding_id = ?`)
        .bind(text, entryId, weddingId)
        .run();
      if (((r.meta as { changes?: number }).changes ?? 0) === 0) {
        return json({ ok: false, error: "Not found" }, 404);
      }
    }
  } catch (e) {
    const { status, body: errBody } = guestbookDbJsonError(e, "guestbook patch");
    return json(errBody, status);
  }

  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const entryId = typeof params.id === "string" ? params.id.trim() : "";
  if (!entryId || entryId.length > 128) {
    return json({ ok: false, error: "Invalid id" }, 400);
  }

  let body: { weddingId?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const weddingId = typeof body.weddingId === "string" ? body.weddingId.trim() : "";
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const pin = typeof body.password === "string" ? body.password.trim() : "";

  try {
    const okPin = await verifyPin(env, weddingId, entryId, pin);
    if (!okPin) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const result = await env.DB.prepare(`DELETE FROM guestbook_entries WHERE id = ? AND wedding_id = ?`)
      .bind(entryId, weddingId)
      .run();
    const ch = (result.meta as { changes?: number }).changes ?? 0;
    if (ch === 0) {
      return json({ ok: false, error: "Not found" }, 404);
    }
  } catch (e) {
    const { status, body: errBody } = guestbookDbJsonError(e, "guestbook user delete");
    return json(errBody, status);
  }

  return json({ ok: true });
};
