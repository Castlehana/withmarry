import type { PagesFunction } from "@cloudflare/workers-types";
import {
  fetchExpectedAdminPassword,
  getBearerPassword,
  isValidWeddingId,
} from "../../_rsvpShared";

type Env = { DB: D1Database; PUBLIC_SITE_BASE?: string };

type Row = {
  id: string;
  wedding_id: string;
  side: string;
  name: string;
  attend: string;
  meal: string;
  created_at: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
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

  let rows: Row[];
  try {
    const res = await env.DB.prepare(
      `SELECT id, wedding_id, side, name, attend, meal, created_at FROM rsvp_submissions WHERE wedding_id = ? ORDER BY datetime(created_at) DESC`
    )
      .bind(weddingId)
      .all<Row>();
    rows = res.results ?? [];
  } catch (e) {
    console.error("D1 select failed", e);
    return json({ ok: false, error: "Database error" }, 500);
  }

  const submissions = rows.map((r) => ({
    id: r.id,
    submittedAt: r.created_at,
    side: r.side,
    name: r.name,
    attend: r.attend,
    meal: r.meal,
  }));

  return json({ ok: true, submissions });
};
