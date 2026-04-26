import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 프로젝트 사이트는 `/저장소이름/` 이어야 자산이 로드됩니다. Actions에서 VITE_BASE_PATH 로 넘깁니다. */
function resolveBase() {
  return process.env.VITE_BASE_PATH?.replace(/\/?$/, "/") || "/";
}

/**
 * RSVP를 D1 API로 보낼지 (여러 기기 → 한 DB).
 * - VITE_USE_RSVP_API=true / false 가 있으면 그걸 따름.
 * - production 빌드는 기본 true (로컬에서 `npm run build` 해도 동일 — 배포본이 항상 API를 쓰게).
 * - development(`npm run dev`)는 기본 false; 로컬에서 D1 테스트 시 `.env.development.local`에 true.
 * - API 없는 정적 호스팅만 쓰면 production 빌드 시 반드시 VITE_USE_RSVP_API=false.
 */
function resolveRsvpUseRemote(mode: string): boolean {
  const env = loadEnv(mode, process.cwd(), "");
  const explicit = env.VITE_USE_RSVP_API || process.env.VITE_USE_RSVP_API;
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  if (mode === "production") return true;
  return false;
}

export default defineConfig(({ mode }) => {
  const rsvpRemote = resolveRsvpUseRemote(mode);
  return {
    base: resolveBase(),
    plugins: [react()],
    define: {
      __RSVP_USE_REMOTE__: JSON.stringify(rsvpRemote),
    },
    server: {
      /** `npm run pages:dev`(wrangler pages dev :8788)와 함께 쓰면 `/api` → Functions */
      proxy: {
        "/api": { target: "http://127.0.0.1:8788", changeOrigin: true },
      },
    },
  };
});
