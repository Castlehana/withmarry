import { useCallback, useMemo, useState } from "react";
import { copyTextToClipboard } from "./clipboardUtils";
import { resolveKakaoJavaScriptKey, shareWeddingKakao } from "./kakaoSdk";
import "./WeddingShareFab.css";

export type WeddingShareFabProps = {
  /** 현재 청첩장 페이지 전체 URL */
  pageUrl: string;
  shareTitle: string;
  shareDescription: string;
  /** 피드 썸네일(HTTPS). 없으면 카카오 텍스트 템플릿 */
  shareImageUrl: string | null;
  /** `VITE_KAKAO_JAVASCRIPT_KEY` */
  envKakaoKey: string | undefined;
  /** `wedding-data` `meta.kakaoJavaScriptKey` (선택) */
  metaKakaoKey: string | undefined;
  onLinkCopied: () => void;
};

function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function WeddingShareFab({
  pageUrl,
  shareTitle,
  shareDescription,
  shareImageUrl,
  envKakaoKey,
  metaKakaoKey,
  onLinkCopied,
}: WeddingShareFabProps) {
  const [busy, setBusy] = useState(false);
  const kakaoKey = useMemo(() => resolveKakaoJavaScriptKey(envKakaoKey, metaKakaoKey), [envKakaoKey, metaKakaoKey]);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (kakaoKey) {
        await shareWeddingKakao({
          javascriptKey: kakaoKey,
          pageUrl,
          title: shareTitle,
          description: shareDescription,
          imageUrl: shareImageUrl,
        });
        return;
      }
      if (canUseWebShare()) {
        try {
          await navigator.share({ title: shareTitle, text: shareDescription, url: pageUrl });
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          await copyTextToClipboard(pageUrl);
          onLinkCopied();
        }
        return;
      }
      await copyTextToClipboard(pageUrl);
      onLinkCopied();
    } catch (e) {
      console.error(e);
      try {
        await copyTextToClipboard(pageUrl);
        onLinkCopied();
      } catch {
        /* noop */
      }
    } finally {
      setBusy(false);
    }
  }, [busy, kakaoKey, onLinkCopied, pageUrl, shareDescription, shareImageUrl, shareTitle]);

  return (
    <div className="wedding-share-fab">
      <button
        type="button"
        className="wedding-share-fab__btn"
        onClick={onClick}
        disabled={busy}
        aria-label={kakaoKey ? "카카오톡으로 공유" : "공유 (링크 복사 또는 시스템 공유)"}
        title={kakaoKey ? "카카오톡으로 공유" : "공유"}
      >
        <span className="wedding-share-fab__icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
            <path
              fill="currentColor"
              d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}
