import type { PagesFunction } from "@cloudflare/workers-types";
import {
  fetchExpectedAdminPassword,
  getBearerPassword,
  isValidWeddingId,
} from "../../_rsvpShared";

type Env = { DB: D1Database; PUBLIC_SITE_BASE?: string };

type Submission = {
  id?: string;
  submittedAt?: string;
  side?: string;
  name?: string;
  attend?: string;
  meal?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isValidSubmission(o: unknown): o is Required<Submission> {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.submittedAt !== "string" || typeof r.name !== "string") return false;
  if (r.side !== "groom" && r.side !== "bride") return false;
  if (r.attend !== "yes" && r.attend !== "no") return false;
  const meal = r.meal;
  if (meal !== "" && meal !== "yes" && meal !== "no" && meal !== "undecided") return false;
  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const bearer = getBearerPassword(request);
  if (!bearer) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: { weddingId?: string; submissions?: unknown[] };
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

  if (!Array.isArray(body.submissions)) {
    return json({ ok: false, error: "submissions must be an array" }, 400);
  }

  let merged = 0;
  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO rsvp_submissions (id, wedding_id, side, name, attend, meal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const item of body.submissions) {
      if (!isValidSubmission(item)) continue;
      const r = item as Required<Submission>;
      const result = await stmt.bind(r.id, weddingId, r.side, r.name, r.attend, r.meal, r.submittedAt).run();
      const ch = (result.meta as { changes?: number }).changes ?? 0;
      if (ch > 0) merged += 1;
    }
  } catch (e) {
    console.error("D1 import failed", e);
    return json({ ok: false, error: "Database error" }, 500);
  }

  return json({ ok: true, merged });
};
