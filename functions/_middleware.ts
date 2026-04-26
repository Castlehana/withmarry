import type { PagesFunction } from "@cloudflare/workers-types";

function corsHeaders(origin: string | null): Headers {
  const h = new Headers();
  if (origin) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
  } else {
    h.set("Access-Control-Allow-Origin", "*");
  }
  h.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith("/api")) {
    return context.next();
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context.request.headers.get("Origin")) });
  }

  const res = await context.next();
  const merged = new Headers(res.headers);
  corsHeaders(context.request.headers.get("Origin")).forEach((v, k) => {
    merged.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: merged });
};
