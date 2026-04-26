import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAdminRsvpApiBearer } from "./admin-session";
import {
  RSVP_CHANGE_EVENT,
  deleteRsvpSubmission,
  downloadRsvpXlsx,
  loadAllRsvpSubmissions,
  type RsvpSubmission,
} from "./rsvp-storage";

type Props = { weddingId: string };

function sideLabel(side: RsvpSubmission["side"]): string {
  return side === "groom" ? "신랑" : "신부";
}

function attendLabel(attend: RsvpSubmission["attend"]): string {
  return attend === "yes" ? "참석" : "불참석";
}

function mealLabel(r: RsvpSubmission): string {
  if (r.attend === "no") return "해당 없음";
  if (r.meal === "yes") return "O (식사)";
  if (r.meal === "no") return "X (식사 없음)";
  if (r.meal === "undecided") return "미정";
  return "—";
}

function formatAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminRsvpDashboard({ weddingId }: Props) {
  const [rows, setRows] = useState<RsvpSubmission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const bearer = getAdminRsvpApiBearer();
    setRows(await loadAllRsvpSubmissions(weddingId, bearer));
  }, [weddingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent<{ weddingId?: string }>).detail;
      if (d?.weddingId === weddingId) void refresh();
    };
    window.addEventListener(RSVP_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener(RSVP_CHANGE_EVENT, onCustom);
    };
  }, [weddingId, refresh]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }, [rows]);

  const allIds = useMemo(() => sorted.map((r) => r.id), [sorted]);
  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const someSelected = selected.size > 0 && selected.size < sorted.length;
  const headerCbRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCbRef.current;
    if (el) el.indeterminate = someSelected;
  }, [someSelected, sorted.length]);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(allIds));
  }, [allIds, allSelected]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const deleteSelected = useCallback(async () => {
    const bearer = getAdminRsvpApiBearer();
    if (!bearer || selected.size === 0) return;
    if (!window.confirm(`선택한 ${selected.size}건의 참석 응답을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const ids = [...selected];
      let failed = 0;
      for (const id of ids) {
        const ok = await deleteRsvpSubmission(weddingId, id, bearer);
        if (!ok) failed += 1;
      }
      if (failed > 0) {
        window.alert(`${ids.length - failed}건만 삭제되었습니다. ${failed}건은 삭제하지 못했습니다.`);
      }
      clearSelection();
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [clearSelection, refresh, selected, weddingId]);

  const deleteAll = useCallback(async () => {
    const bearer = getAdminRsvpApiBearer();
    if (!bearer || sorted.length === 0) return;
    if (!window.confirm(`참석 응답 ${sorted.length}건을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      let failed = 0;
      for (const r of sorted) {
        const ok = await deleteRsvpSubmission(weddingId, r.id, bearer);
        if (!ok) failed += 1;
      }
      if (failed > 0) {
        window.alert(`일부만 삭제되었습니다. 삭제 실패: ${failed}건`);
      }
      clearSelection();
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [clearSelection, refresh, sorted, weddingId]);

  return (
    <section className="admin-rsvp" aria-labelledby="admin-rsvp-heading">
      <h2 id="admin-rsvp-heading" className="admin-rsvp__title">
        참석 여부 목록
      </h2>
      <div className="admin-rsvp__toolbar">
        <button
          type="button"
          className="admin-rsvp__btn admin-rsvp__btn--primary"
          disabled={busy}
          onClick={() => void downloadRsvpXlsx(weddingId, sorted)}
        >
          엑셀(.xlsx) 다운로드
        </button>
        <span className="admin-rsvp__toolbar-sep" aria-hidden="true" />
        <label className="admin-rsvp__check-all">
          <input
            ref={headerCbRef}
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={sorted.length === 0 || busy}
          />
          전체 선택
        </label>
        <button type="button" className="admin-rsvp__btn" disabled={busy || selected.size === 0} onClick={clearSelection}>
          선택 해제
        </button>
        <button type="button" className="admin-rsvp__btn" disabled={busy || selected.size === 0} onClick={() => void deleteSelected()}>
          선택 삭제
        </button>
        <button type="button" className="admin-rsvp__btn admin-rsvp__btn--danger" disabled={busy || sorted.length === 0} onClick={() => void deleteAll()}>
          모두 삭제
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="admin-rsvp__empty">저장된 참석 응답이 없습니다.</p>
      ) : (
        <div className="admin-rsvp__table-wrap">
          <table className="admin-rsvp__table">
            <thead>
              <tr>
                <th scope="col" className="admin-rsvp__th-check">
                  <span className="admin-rsvp__sr-only">선택</span>
                </th>
                <th scope="col">제출일시</th>
                <th scope="col">하객측</th>
                <th scope="col">성함</th>
                <th scope="col">참석</th>
                <th scope="col">식사</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="admin-rsvp__td-check">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={busy}
                      aria-label={`${r.name} 선택`}
                    />
                  </td>
                  <td>{formatAt(r.submittedAt)}</td>
                  <td>{sideLabel(r.side)}</td>
                  <td>{r.name}</td>
                  <td>{attendLabel(r.attend)}</td>
                  <td>{mealLabel(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
