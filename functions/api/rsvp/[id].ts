import type { PagesFunction } from "@cloudflare/workers-types";
import {
  fetchExpectedAdminPassword,
  getBearerPassword,
  isValidWeddingId,
} from "../../_rsvpShared";

type Env = { DB: D1Database; PUBLIC_SITE_BASE?: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const submissionId = typeof params.id === "string" ? params.id.trim() : "";
  if (!submissionId || submissionId.length > 128) {
    return json({ ok: false, error: "Invalid id" }, 400);
  }

  const url = new URL(request.url);
  const weddingId = (url.searchParams.get("weddingId") ?? "").trim();
  if (!isValidWeddingId(weddingId)) {
    return json({ ok: false, error: "Invalid weddingId" }, 400);
  }

  const bearer = getBearerPassword(request);
  if (!bearer) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const expected = await fetchExpectedAdminPassword(request.url, weddingId, env.PUBLIC_SITE_BASE);
  if (bearer !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await env.DB.prepare(`DELETE FROM rsvp_submissions WHERE id = ? AND wedding_id = ?`)
      .bind(submissionId, weddingId)
      .run();
    const ch = (result.meta as { changes?: number }).changes ?? 0;
    if (ch === 0) {
      return json({ ok: false, error: "Not found" }, 404);
    }
  } catch (e) {
    console.error("D1 delete failed", e);
    return json({ ok: false, error: "Database error" }, 500);
  }

  return json({ ok: true });
};
