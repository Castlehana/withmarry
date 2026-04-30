/// <reference types="vite/client" />

/** `vite.config.ts` define — Cloudflare Pages production 빌드 시 기본 true */
declare const __RSVP_USE_REMOTE__: boolean;

interface ImportMetaEnv {
  /**
   * RSVP D1 API 사용 여부. 빌드 시 `vite.config`가 `__RSVP_USE_REMOTE__`로 박음.
   * production은 기본 켜짐; 끄려면 `false`. development 기본 끔; 켜려면 `true`.
   */
  readonly VITE_USE_RSVP_API?: string;
  /** 비우면 상대 `/api` (Vite 프록시 또는 Pages 동일 출처). 절대 URL이면 그 호스트 사용 */
  readonly VITE_RSVP_API_BASE?: string;
  /** [카카오](https://developers.kakao.com/docs/latest/ko/javascript) JavaScript 키 — `meta.kakaoJavaScriptKey`가 없을 때 사용 */
  readonly VITE_KAKAO_JAVASCRIPT_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
