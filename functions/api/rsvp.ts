import type { PagesFunction } from "@cloudflare/workers-types";
import { isValidWeddingId } from "../_rsvpShared";

type Env = { DB: D1Database };

type Body = {
  weddingId?: string;
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) {
    return json({ ok: false, error: "Invalid name" }, 400);
  }

  const attend = body.attend;
  if (attend !== "yes" && attend !== "no") {
    return json({ ok: false, error: "Invalid attend" }, 400);
  }

  let meal = typeof body.meal === "string" ? body.meal : "";
  if (attend === "no") {
    meal = "";
  } else if (meal !== "yes" && meal !== "no" && meal !== "undecided") {
    return json({ ok: false, error: "Invalid meal" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO rsvp_submissions (id, wedding_id, side, name, attend, meal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, weddingId, side, name, attend, meal, createdAt)
      .run();
  } catch (e) {
    console.error("D1 insert failed", e);
    return json({ ok: false, error: "Database error" }, 500);
  }

  return json({
    ok: true,
    submission: { id, submittedAt: createdAt, side, name, attend, meal },
  });
};
