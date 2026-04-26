/** wedding-data.txt 와 동일: `#` 시작 줄 제거 후 trim */
export function stripLeadingHashComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
}

export function parseExpectedPasswordFromTxt(raw: string): string {
  const stripped = stripLeadingHashComments(raw).trim();
  if (!stripped) return "0000";
  const firstLine = stripped.split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.length > 0 ? firstLine : "0000";
}

export function siteAssetPrefix(publicSiteBase: string | undefined): string {
  const b = (publicSiteBase ?? "").trim();
  if (!b) return "";
  const withSlash = b.startsWith("/") ? b : `/${b}`;
  return withSlash.replace(/\/$/, "");
}

export function isValidWeddingId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export async function fetchExpectedAdminPassword(
  requestUrl: string,
  weddingId: string,
  publicSiteBase: string | undefined
): Promise<string> {
  const u = new URL(requestUrl);
  const prefix = siteAssetPrefix(publicSiteBase);
  const path = `${prefix}/weddings/${encodeURIComponent(weddingId)}/admin-password.txt`;
  const passwordUrl = `${u.origin}${path}`;
  const res = await fetch(passwordUrl);
  if (!res.ok) return "0000";
  const raw = await res.text();
  return parseExpectedPasswordFromTxt(raw);
}

export function getBearerPassword(request: Request): string | null {
  const h = request.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}
