import { useCallback, useState } from "react";
import { CopyFeedbackToast } from "./CopyFeedbackToast";
import { copyTextToClipboard } from "./clipboardUtils";
import { useCopyFeedbackToast } from "./useCopyFeedbackToast";
import type { DirectionsTransportBlock } from "./wedding-data.types";

type Props = { block: DirectionsTransportBlock };

/** 표시 문장 끝의 ` 검색`을 뗀 검색어 (없으면 줄 전체) */
function searchTextToCopy(line: string): string {
  return line.replace(/\s*검색\s*$/u, "").trim() || line.trim();
}

export function DirectionsTransportToggles({ block }: Props) {
  const sections = (block.sections ?? []).filter(
    (s) =>
      Boolean(s.title?.trim()) &&
      Boolean((s.bullets && s.bullets.length > 0) || s.note?.trim())
  );
  const { open, closing, notify, close } = useCopyFeedbackToast();
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  const copySearchLine = useCallback(
    (line: string) => {
      const t = searchTextToCopy(line);
      if (!t) return;
      void copyTextToClipboard(t).then(() => notify());
    },
    [notify]
  );

  if (sections.length === 0) return null;

  return (
    <div className="directions-transport" role="region" aria-label="대중교통 안내">
      <CopyFeedbackToast open={open} closing={closing} onClose={close} />
      {sections.map((s) => {
        const sectionOpen = openSectionId === s.id;
        const panelId = `directions-transport-${s.id}`;
        const buttonId = `directions-transport-${s.id}-button`;
        return (
        <div key={s.id} className={`directions-transport__item${sectionOpen ? " directions-transport__item--open" : ""}`}>
          <button
            type="button"
            id={buttonId}
            className="directions-transport__summary"
            aria-expanded={sectionOpen}
            aria-controls={panelId}
            onClick={() => setOpenSectionId((current) => (current === s.id ? null : s.id))}
          >
            <span className="directions-transport__summary-title">{s.title}</span>
          </button>
          <div
            id={panelId}
            className="directions-transport__panel"
            role="region"
            aria-labelledby={buttonId}
            aria-hidden={!sectionOpen}
          >
            <div className="directions-transport__panel-inner">
              <div className="directions-transport__body">
                {s.bullets && s.bullets.length > 0 ? (
                  <ul
                    className={
                      s.mapSearchBullets
                        ? "directions-transport__bullets directions-transport__bullets--mapsearch"
                        : "directions-transport__bullets"
                    }
                  >
                    {s.bullets.map((line, i) => (
                      <li key={i}>
                        {s.mapSearchBullets ? (
                          <button
                            type="button"
                            className="directions-transport__mapsearch"
                            onClick={() => copySearchLine(line)}
                            aria-label={`검색어 복사: ${searchTextToCopy(line)}`}
                            title="눌러서 검색어 복사"
                          >
                            {line}
                          </button>
                        ) : (
                          line
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.note?.trim() ? <p className="directions-transport__note">{s.note}</p> : null}
              </div>
            </div>
          </div>
        </div>
      );
      })}
    </div>
  );
}
