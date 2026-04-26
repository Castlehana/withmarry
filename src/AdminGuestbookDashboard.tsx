import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAdminRsvpApiBearer } from "./admin-session";
import {
  adminDeleteGuestbookEntries,
  fetchGuestbookList,
  guestbookUsesRemote,
  type GuestbookEntry,
  type GuestbookSide,
} from "./guestbook-client";

type Props = { weddingId: string };

function sideLabel(side: GuestbookSide): string {
  return side === "groom" ? "신랑" : "신부";
}

function formatAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminGuestbookDashboard({ weddingId }: Props) {
  const remote = guestbookUsesRemote();
  const [rows, setRows] = useState<GuestbookEntry[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!remote) {
      setRows([]);
      return;
    }
    setLoading(true);
    setListErr(null);
    try {
      const r = await fetchGuestbookList(weddingId);
      setRows(r.entries);
      setListErr(r.error);
    } finally {
      setLoading(false);
    }
  }, [remote, weddingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = useMemo(() => [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [rows]);

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

  const bearer = getAdminRsvpApiBearer();

  const deleteSelected = useCallback(async () => {
    if (!bearer || selected.size === 0) return;
    if (!window.confirm(`선택한 ${selected.size}개 방명록을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const r = await adminDeleteGuestbookEntries(weddingId, bearer, { ids: [...selected] });
      if (!r.ok) {
        window.alert(r.error ?? "삭제하지 못했습니다.");
        return;
      }
      clearSelection();
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [bearer, clearSelection, refresh, selected, weddingId]);

  const deleteAll = useCallback(async () => {
    if (!bearer) return;
    if (!window.confirm("이 웨딩의 방명록을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      const r = await adminDeleteGuestbookEntries(weddingId, bearer, { deleteAll: true });
      if (!r.ok) {
        window.alert(r.error ?? "삭제하지 못했습니다.");
        return;
      }
      clearSelection();
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [bearer, clearSelection, refresh, weddingId]);

  if (!remote) {
    return (
      <section className="admin-gb" aria-labelledby="admin-gb-heading">
        <h2 id="admin-gb-heading" className="admin-gb__title">
          방명록
        </h2>
        <p className="admin-gb__empty">API가 꺼진 빌드에서는 방명록을 불러올 수 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="admin-gb" aria-labelledby="admin-gb-heading">
      <h2 id="admin-gb-heading" className="admin-gb__title">
        방명록
      </h2>
      <div className="admin-gb__toolbar">
        <label className="admin-gb__check-all">
          <input
            ref={headerCbRef}
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={sorted.length === 0 || busy}
          />
          전체 선택
        </label>
        <button type="button" className="admin-gb__btn" disabled={busy || selected.size === 0} onClick={clearSelection}>
          선택 해제
        </button>
        <button type="button" className="admin-gb__btn" disabled={busy || selected.size === 0} onClick={() => void deleteSelected()}>
          선택 삭제
        </button>
        <button type="button" className="admin-gb__btn admin-gb__btn--danger" disabled={busy || sorted.length === 0} onClick={() => void deleteAll()}>
          모두 삭제
        </button>
      </div>
      {loading && sorted.length === 0 && !listErr ? (
        <p className="admin-gb__empty">불러오는 중…</p>
      ) : listErr ? (
        <p className="admin-gb__empty admin-gb__warn" role="alert">
          {listErr}
        </p>
      ) : sorted.length === 0 ? (
        <p className="admin-gb__empty">저장된 방명록이 없습니다.</p>
      ) : (
        <div className="admin-gb__table-wrap">
          <table className="admin-gb__table">
            <thead>
              <tr>
                <th scope="col" className="admin-gb__th-check">
                  <span className="admin-gb__sr-only">선택</span>
                </th>
                <th scope="col">일시</th>
                <th scope="col">측</th>
                <th scope="col">이름</th>
                <th scope="col">내용</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="admin-gb__td-check">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={busy}
                      aria-label={`${r.authorName} 선택`}
                    />
                  </td>
                  <td>{formatAt(r.createdAt)}</td>
                  <td>{sideLabel(r.side)}</td>
                  <td>{r.authorName}</td>
                  <td className="admin-gb__td-body">{r.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
