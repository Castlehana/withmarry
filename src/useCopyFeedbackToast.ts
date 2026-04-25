import { useCallback, useEffect, useRef, useState } from "react";

/** `App.css` `heart-acc-toast-out` 길이(0.4s) + 여유 */
const TOAST_OUT_MS = 430;
/** 표시 후 자동으로 닫기 시작 */
const TOAST_VISIBLE_MS = 800;
/** 닫기 시작 후 언마운트(표시 + 퇴장 애니) */
const TOAST_UNMOUNT_MS = TOAST_VISIBLE_MS + TOAST_OUT_MS;

/**
 * 복사 완료 토스트: 짧게 보였다가 빠르게 사라짐.
 */
export function useCopyFeedbackToast() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearPopupTimers = useCallback(() => {
    if (fadeTimerRef.current != null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const notify = useCallback(() => {
    clearPopupTimers();
    setOpen(true);
    setClosing(false);
    fadeTimerRef.current = window.setTimeout(() => setClosing(true), TOAST_VISIBLE_MS);
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, TOAST_UNMOUNT_MS);
  }, [clearPopupTimers]);

  const close = useCallback(() => {
    clearPopupTimers();
    setClosing(true);
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, TOAST_OUT_MS);
  }, [clearPopupTimers]);

  useEffect(() => () => clearPopupTimers(), [clearPopupTimers]);

  return { open, closing, notify, close };
}
