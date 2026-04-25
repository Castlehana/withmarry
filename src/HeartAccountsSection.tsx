import { useCallback, useMemo, useState } from "react";
import { CopyFeedbackToast, CopyIconButton } from "./CopyFeedbackToast";
import { copyTextToClipboard } from "./clipboardUtils";
import { useCopyFeedbackToast } from "./useCopyFeedbackToast";
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

function AccountCard({ entry, onCopyFeedback }: { entry: HeartAccountEntry; onCopyFeedback: () => void }) {
  const onCopy = useCallback(() => {
    void copyTextToClipboard(entry.number.trim()).then(() => {
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
          <CopyIconButton
            onClick={onCopy}
            ariaLabel={`${entry.label} 계좌번호 복사`}
            title="계좌번호 복사"
          />
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
  const { open: copyPopupOpen, closing: copyPopupClosing, notify: onCopyAny, close: closeCopyPopup } =
    useCopyFeedbackToast();

  const title = block.title?.trim() || "마음 전하실 곳";

  return (
    <section id="accounts" className="section heart-accounts" aria-labelledby="heart-accounts-heading" lang="ko">
      <CopyFeedbackToast open={copyPopupOpen} closing={copyPopupClosing} onClose={closeCopyPopup} />
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
