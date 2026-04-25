import { useEffect } from "react";
import { createPortal } from "react-dom";

const COPY_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="9" y="9" width="11" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.35" />
    <path
      d="M6.8 14.5H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v0.8"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </svg>
);

export function CopyIconButton({
  onClick,
  ariaLabel,
  title,
}: {
  onClick: () => void;
  ariaLabel: string;
  title: string;
}) {
  return (
    <button type="button" className="heart-accounts__copy-inline" onClick={onClick} aria-label={ariaLabel} title={title}>
      {COPY_SVG}
    </button>
  );
}

type ToastProps = {
  open: boolean;
  closing: boolean;
  onClose: () => void;
  /** 생략 시 복사 토스트 공통 문구 */
  title?: string;
};

const COPY_TOAST_DEFAULT_TITLE = "클립보드에 복사되었어요.";

/**
 * `HeartAccountsSection` 토스트와 동일한 마크업·클래스(`heart-accounts__toast`).
 */
export function CopyFeedbackToast({
  open,
  closing,
  onClose,
  title = COPY_TOAST_DEFAULT_TITLE,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`heart-accounts__toast${closing ? " heart-accounts__toast--closing" : ""}`}
      role="status"
    >
      <div className="heart-accounts__toast-ic" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.25" />
          <path
            d="M8 12l2.5 2.5L16 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="heart-accounts__toast-title">{title}</p>
      <button type="button" className="heart-accounts__toast-close" onClick={onClose} aria-label="알림 닫기">
        닫기
      </button>
    </div>,
    document.body
  );
}
