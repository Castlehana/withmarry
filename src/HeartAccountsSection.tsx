import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HeartAccountEntry, HeartAccountsSide, WeddingData } from "./wedding-data.types";

type HeartBlock = NonNullable<WeddingData["wedding"]["heartAccounts"]>;

type Props = {
  block: HeartBlock;
};

type Side = "groom" | "bride";

function hasAccountNumber(entry: HeartAccountEntry | undefined): entry is HeartAccountEntry {
  return Boolean(entry?.number?.trim());
}

function sideToEntries(side: HeartAccountsSide | undefined): HeartAccountEntry[] {
  if (!side) return [];
  return [side.self, side.father, side.mother].filter(hasAccountNumber);
}

async function copyLine(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function AccountCard({ entry, onCopyFeedback }: { entry: HeartAccountEntry; onCopyFeedback: () => void }) {
  const onCopy = useCallback(() => {
    void copyLine(entry.number.trim()).then(() => {
      onCopyFeedback();
    });
  }, [entry.number, onCopyFeedback]);

  const kakao = entry.kakaoPayUrl?.trim();

  return (
    <div className="heart-accounts__card">
      <p className="heart-accounts__sublabel">{entry.label}</p>
      <div className="heart-accounts__fields">
        <p className="heart-accounts__field">
          <span className="heart-accounts__v">{entry.bank}</span>
        </p>
        <p className="heart-accounts__field">
          <span className="heart-accounts__v heart-accounts__v--number">{entry.number}</span>
          <button
            type="button"
            className="heart-accounts__copy-inline"
            onClick={onCopy}
            aria-label={`${entry.label} 계좌번호 복사`}
            title="계좌번호 복사"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.35" />
              <path d="M6.8 14.5H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v0.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
            </svg>
          </button>
        </p>
        <p className="heart-accounts__field">
          <span className="heart-accounts__v">{entry.holder}</span>
        </p>
      </div>
      <div className="heart-accounts__actions">
        {kakao ? (
          <a className="heart-accounts__btn heart-accounts__btn--kakao" href={kakao} target="_blank" rel="noopener noreferrer">
            카카오페이 송금
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SideContent({ entries, onCopyAny }: { entries: HeartAccountEntry[]; onCopyAny: () => void }) {
  if (entries.length === 0) {
    return <p className="heart-accounts__empty">등록된 계좌가 없습니다.</p>;
  }
  return (
    <div className="heart-accounts__side-body">
      {entries.map((entry, i) => (
        <AccountCard key={`${entry.label}-${entry.number}-${i}`} entry={entry} onCopyFeedback={onCopyAny} />
      ))}
    </div>
  );
}

function CopyDonePopup({
  open,
  closing,
  onClose,
}: {
  open: boolean;
  closing: boolean;
  onClose: () => void;
}) {
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
    <div className={`heart-accounts__toast${closing ? " heart-accounts__toast--closing" : ""}`} role="status">
      <div className="heart-accounts__toast-ic" aria-hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="heart-accounts__toast-title">계좌번호를 복사했어요</p>
      <button type="button" className="heart-accounts__toast-close" onClick={onClose} aria-label="알림 닫기">
        닫기
      </button>
    </div>,
    document.body
  );
}

function SideBlock({
  side,
  open,
  onToggle,
  label,
  entries,
  onCopyAny,
}: {
  side: Side;
  open: boolean;
  onToggle: () => void;
  label: string;
  entries: HeartAccountEntry[];
  onCopyAny: () => void;
}) {
  const panelId = `heart-acc-${side}-panel`;
  const triggerId = `heart-acc-${side}-trigger`;
  return (
    <div className={`heart-accounts__side heart-accounts__side--${side}`}>
      <div className={`heart-accounts__item${open ? " heart-accounts__item--open" : ""}`}>
        <button
          type="button"
          className="heart-accounts__trigger"
          id={triggerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="heart-accounts__trigger-text">{label}</span>
          <span className={`heart-accounts__chev${open ? " heart-accounts__chev--open" : ""}`} aria-hidden>
            ▼
          </span>
        </button>
        <div
          id={panelId}
          className="heart-accounts__acc-panel"
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!open}
        >
          <div className="heart-accounts__acc-inner">
            <div className="heart-accounts__acc-body">
              <SideContent entries={entries} onCopyAny={onCopyAny} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeartAccountsSection({ block }: Props) {
  const groomEntries = useMemo(() => sideToEntries(block.groom), [block.groom]);
  const brideEntries = useMemo(() => sideToEntries(block.bride), [block.bride]);
  const groomLabel = block.groomToggleLabel?.trim() || "신랑측";
  const brideLabel = block.brideToggleLabel?.trim() || "신부측";

  const [openGroom, setOpenGroom] = useState(false);
  const [openBride, setOpenBride] = useState(false);
  const [copyPopupOpen, setCopyPopupOpen] = useState(false);
  const [copyPopupClosing, setCopyPopupClosing] = useState(false);
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

  const onCopyAny = useCallback(() => {
    clearPopupTimers();
    setCopyPopupOpen(true);
    setCopyPopupClosing(false);
    fadeTimerRef.current = window.setTimeout(() => setCopyPopupClosing(true), 1500);
    hideTimerRef.current = window.setTimeout(() => {
      setCopyPopupOpen(false);
      setCopyPopupClosing(false);
    }, 2400);
  }, [clearPopupTimers]);

  const closeCopyPopup = useCallback(() => {
    clearPopupTimers();
    setCopyPopupClosing(true);
    hideTimerRef.current = window.setTimeout(() => {
      setCopyPopupOpen(false);
      setCopyPopupClosing(false);
    }, 700);
  }, [clearPopupTimers]);

  useEffect(() => {
    return () => clearPopupTimers();
  }, [clearPopupTimers]);

  const title = block.title?.trim() || "마음 전하실 곳";

  return (
    <section id="accounts" className="section heart-accounts" aria-labelledby="heart-accounts-heading" lang="ko">
      <CopyDonePopup open={copyPopupOpen} closing={copyPopupClosing} onClose={closeCopyPopup} />
      <h2 id="heart-accounts-heading" className="heart-accounts__h2">
        {title}
      </h2>
      <div className="heart-accounts__box">
        <SideBlock
          side="groom"
          open={openGroom}
          onToggle={() => setOpenGroom((o) => !o)}
          label={groomLabel}
          entries={groomEntries}
          onCopyAny={onCopyAny}
        />
        <SideBlock
          side="bride"
          open={openBride}
          onToggle={() => setOpenBride((o) => !o)}
          label={brideLabel}
          entries={brideEntries}
          onCopyAny={onCopyAny}
        />
      </div>
    </section>
  );
}
