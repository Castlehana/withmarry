/**
 * Kakao JavaScript SDK 동적 로드 + 카카오톡 공유(피드 / 텍스트).
 * @see https://developers.kakao.com/docs/latest/ko/kakaojavaScript/kakaoshare
 */

const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

declare global {
  interface Window {
    Kakao?: KakaoGlobal;
  }
}

type KakaoGlobal = {
  isInitialized: () => boolean;
  init: (javascriptKey: string) => void;
  Share: {
    sendDefault: (options: Record<string, unknown>) => Promise<unknown>;
  };
};

let loadPromise: Promise<KakaoGlobal> | null = null;

function getKakao(): KakaoGlobal | undefined {
  return window.Kakao;
}

export function loadKakaoSdk(): Promise<KakaoGlobal> {
  const k = getKakao();
  if (k) return Promise.resolve(k);
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = KAKAO_SDK_SRC;
      s.async = true;
      s.onload = () => {
        const k2 = getKakao();
        if (k2) resolve(k2);
        else reject(new Error("Kakao SDK를 찾을 수 없습니다."));
      };
      s.onerror = () => reject(new Error("Kakao SDK 로드에 실패했습니다."));
      document.head.appendChild(s);
    });
  }
  return loadPromise;
}

export function resolveKakaoJavaScriptKey(envKey: string | undefined, metaKey: string | undefined): string | undefined {
  const e = envKey?.trim();
  if (e) return e;
  const m = metaKey?.trim();
  if (m) return m;
  return undefined;
}

/** 브라우저 기준 현재 호스트 + Vite `base` + `/:weddingId` 전체 URL */
export function buildWeddingPageAbsoluteUrl(weddingId: string): string {
  const id = encodeURIComponent(weddingId);
  const base = import.meta.env.BASE_URL || "/";
  const path = base === "/" ? `/${id}` : `${base.replace(/\/$/, "")}/${id}`;
  return new URL(path, window.location.origin).href;
}

/**
 * @param imageUrl  HTTPS 절대 URL(피드 썸네일). 없으면 텍스트 템플릿으로 전송.
 */
export async function shareWeddingKakao(params: {
  javascriptKey: string;
  pageUrl: string;
  title: string;
  description: string;
  imageUrl: string | null;
}): Promise<void> {
  const Kakao = await loadKakaoSdk();
  if (!Kakao.isInitialized()) {
    Kakao.init(params.javascriptKey);
  }
  const { pageUrl, title, description, imageUrl } = params;
  if (imageUrl) {
    await Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description,
        imageUrl,
        link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
      },
      buttons: [{ title: "청첩장 열기", link: { mobileWebUrl: pageUrl, webUrl: pageUrl } }],
    });
    return;
  }
  await Kakao.Share.sendDefault({
    objectType: "text",
    text: [title, description, pageUrl].filter(Boolean).join("\n"),
    link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
    buttonTitle: "청첩장 열기",
  });
}
