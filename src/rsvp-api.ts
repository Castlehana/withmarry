/** RSVP를 D1(Cloudflare) API로 보내 여러 기기에서 같은 목록을 볼지 여부 */
export function rsvpUsesRemote(): boolean {
  return __RSVP_USE_REMOTE__;
}

/** 예: `https://api.example.com` 또는 비우면 상대 `/api/...` (같은 출처·Vite 프록시) */
export function rsvpApiUrl(path: string): string {
  const raw = (import.meta.env.VITE_RSVP_API_BASE as string | undefined)?.trim() ?? "";
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!raw) return p;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return `${raw.replace(/\/$/, "")}${p}`;
  }
  return `${raw.replace(/\/$/, "")}${p}`;
}
