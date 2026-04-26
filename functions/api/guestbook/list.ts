import type { PagesFunction } from "@cloudflare/workers-types";
import { guestbookDbJsonError, isGuestbookTableMissingError, isValidWeddingId } from "../../_guestbookShared";

type Env = { DB: D1Database };

type Row = {
  id: string;
  wedding_id: string;
  side: string;
  author_name: string;
  body: string;
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

  try {
    const res = await env.DB.prepare(
      `SELECT id, wedding_id, side, author_name, body, created_at FROM guestbook_entries WHERE wedding_id = ? ORDER BY created_at DESC`
    )
      .bind(weddingId)
      .all<Row>();
    const rows = res.results ?? [];
    const entries = rows.map((r) => ({
      id: r.id,
      weddingId: r.wedding_id,
      side: r.side,
      authorName: r.author_name,
      body: r.body,
      createdAt: r.created_at,
    }));
    return json({ ok: true, entries });
  } catch (e) {
    /* GET 목록은 페이지 로드마다 호출되므로, 테이블 미생성 시 503 대신 200으로 내려 콘솔에 빨간 실패 로그가 쌓이지 않게 함 */
    if (isGuestbookTableMissingError(e)) {
      console.error("guestbook list", e);
      return json({ ok: false, error: "guestbook_table_missing", entries: [] }, 200);
    }
    const { status, body } = guestbookDbJsonError(e, "guestbook list");
    return json(body, status);
  }
};
