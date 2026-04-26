import { isValidWeddingId } from "./wedding-data";

const SESSION_KEY = "withmarry_admin_wedding_id";
/** RSVP API 목록·가져오기 시 `Authorization: Bearer` — 로그인 시 1회 저장, 로그아웃 시 삭제 */
const RSVP_API_SECRET_KEY = "withmarry_admin_rsvp_bearer";

export function getAdminSessionWeddingId(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (!v || !isValidWeddingId(v)) return null;
    return v;
  } catch {
    return null;
  }
}

export function setAdminSessionWeddingId(weddingId: string): void {
  sessionStorage.setItem(SESSION_KEY, weddingId);
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(RSVP_API_SECRET_KEY);
}

export function setAdminRsvpApiBearer(password: string): void {
  sessionStorage.setItem(RSVP_API_SECRET_KEY, password);
}

export function getAdminRsvpApiBearer(): string | null {
  try {
    return sessionStorage.getItem(RSVP_API_SECRET_KEY);
  } catch {
    return null;
  }
}
