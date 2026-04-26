import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createGuestbookEntry,
  deleteGuestbookEntryAsAuthor,
  fetchGuestbookList,
  guestbookUsesRemote,
  updateGuestbookEntry,
  verifyGuestbookEntryPin,
  type GuestbookEntry,
  type GuestbookSide,
} from "./guestbook-client";

type Props = { weddingId: string };

type PinGate = { mode: "edit" | "delete"; entry: GuestbookEntry };

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

/** 브라우저 비밀번호 저장 유도 완화: text + CSS 마스킹 */
function PinField({
  id,
  name,
  value,
  onChange,
  disabled,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      className="guestbook-modal__input guestbook-modal__input--pin"
      type="text"
      inputMode="numeric"
      pattern="\d*"
      maxLength={4}
      autoComplete="off"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      enterKeyHint="done"
      data-lpignore="true"
      placeholder="4자리"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
    />
  );
}

export function GuestbookSection({ weddingId }: Props) {
  const remote = guestbookUsesRemote();
  const titleCompose = useId();
  const titleGate = useId();
  const titleEdit = useId();
  const titleDelConfirm = useId();
  const titleDelDone = useId();
  const fieldUid = useId().replace(/:/g, "");

  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  const [menuOpenEntryId, setMenuOpenEntryId] = useState<string | null>(null);
  const [menuDropdownPos, setMenuDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [side, setSide] = useState<GuestbookSide>("groom");
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [pin, setPin] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pinGate, setPinGate] = useState<PinGate | null>(null);
  const [gatePin, setGatePin] = useState("");
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [gateSubmitting, setGateSubmitting] = useState(false);

  const [editBundle, setEditBundle] = useState<{ entry: GuestbookEntry; pin: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editFormErr, setEditFormErr] = useState<string | null>(null);

  const [deleteBundle, setDeleteBundle] = useState<{ entry: GuestbookEntry; pin: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!remote) return;
    setLoading(true);
    setListErr(null);
    try {
      const r = await fetchGuestbookList(weddingId);
      setEntries(r.entries);
      setListErr(r.error);
    } catch {
      setListErr("목록을 불러오지 못했습니다.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [remote, weddingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateMenuDropdownPos = useCallback(() => {
    const btn = menuButtonRef.current;
    if (!btn || !menuOpenEntryId) return;
    const r = btn.getBoundingClientRect();
    setMenuDropdownPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [menuOpenEntryId]);

  useLayoutEffect(() => {
    if (!menuOpenEntryId) {
      setMenuDropdownPos(null);
      return;
    }
    updateMenuDropdownPos();
    const listEl = listScrollRef.current;
    window.addEventListener("resize", updateMenuDropdownPos);
    document.addEventListener("scroll", updateMenuDropdownPos, true);
    listEl?.addEventListener("scroll", updateMenuDropdownPos);
    return () => {
      window.removeEventListener("resize", updateMenuDropdownPos);
      document.removeEventListener("scroll", updateMenuDropdownPos, true);
      listEl?.removeEventListener("scroll", updateMenuDropdownPos);
    };
  }, [menuOpenEntryId, updateMenuDropdownPos]);

  useEffect(() => {
    if (!menuOpenEntryId) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest(".guestbook__dropdown") || el.closest(".guestbook__card-more")) return;
      setMenuOpenEntryId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpenEntryId]);

  const closeCompose = useCallback(() => {
    setComposeOpen(false);
    setSide("groom");
    setAuthorName("");
    setBody("");
    setPin("");
    setFormErr(null);
  }, []);

  const closeGate = useCallback(() => {
    setPinGate(null);
    setGatePin("");
    setGateErr(null);
    setGateSubmitting(false);
  }, []);

  const closeEditFlow = useCallback(() => {
    setEditBundle(null);
    setEditName("");
    setEditBody("");
    setEditFormErr(null);
  }, []);

  const closeDeleteFlow = useCallback(() => {
    setDeleteBundle(null);
  }, []);

  const closeDeleteSuccess = useCallback(() => {
    setDeleteSuccessOpen(false);
  }, []);

  const onGateSubmit = useCallback(async () => {
    if (!pinGate || !/^\d{4}$/.test(gatePin)) return;
    setGateSubmitting(true);
    setGateErr(null);
    try {
      const ok = await verifyGuestbookEntryPin(weddingId, pinGate.entry.id, gatePin);
      if (!ok) {
        setGateErr("비밀번호가 올바르지 않습니다.");
        return;
      }
      if (pinGate.mode === "edit") {
        setEditBundle({ entry: pinGate.entry, pin: gatePin });
        setEditName(pinGate.entry.authorName);
        setEditBody(pinGate.entry.body);
        setEditFormErr(null);
        closeGate();
      } else {
        setDeleteBundle({ entry: pinGate.entry, pin: gatePin });
        closeGate();
      }
    } catch {
      setGateErr("확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setGateSubmitting(false);
    }
  }, [closeGate, gatePin, pinGate, weddingId]);

  const onSubmitCreate = useCallback(async () => {
    setFormErr(null);
    if (!authorName.trim()) {
      setFormErr("이름을 입력해 주세요.");
      return;
    }
    if (!body.trim()) {
      setFormErr("내용을 입력해 주세요.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setFormErr("비밀번호는 숫자 4자리로 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await createGuestbookEntry({
        weddingId,
        side,
        authorName: authorName.trim(),
        body: body.trim(),
        password: pin,
      });
      if (!r.ok) {
        setFormErr(r.error);
        return;
      }
      closeCompose();
      void refresh();
    } finally {
      setSubmitting(false);
    }
  }, [authorName, body, closeCompose, pin, refresh, side, weddingId]);

  const onSubmitEdit = useCallback(async () => {
    if (!editBundle) return;
    setEditFormErr(null);
    if (!editName.trim() || !editBody.trim()) {
      setEditFormErr("이름과 내용을 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await updateGuestbookEntry(editBundle.entry.id, {
        weddingId,
        password: editBundle.pin,
        authorName: editName.trim(),
        body: editBody.trim(),
      });
      if (!ok) {
        setEditFormErr("저장하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      closeEditFlow();
      void refresh();
    } finally {
      setSubmitting(false);
    }
  }, [closeEditFlow, editBody, editBundle, editName, refresh, weddingId]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteBundle) return;
    setDeleteSubmitting(true);
    try {
      const ok = await deleteGuestbookEntryAsAuthor(deleteBundle.entry.id, weddingId, deleteBundle.pin);
      if (!ok) {
        window.alert("삭제하지 못했습니다.");
        return;
      }
      closeDeleteFlow();
      setDeleteSuccessOpen(true);
      void refresh();
    } finally {
      setDeleteSubmitting(false);
    }
  }, [closeDeleteFlow, deleteBundle, refresh, weddingId]);

  const composeValid = useMemo(
    () => authorName.trim().length > 0 && body.trim().length > 0 && /^\d{4}$/.test(pin),
    [authorName, body, pin]
  );
  const editValid = useMemo(
    () => editBundle !== null && editName.trim().length > 0 && editBody.trim().length > 0,
    [editBundle, editName, editBody]
  );
  const gateValid = useMemo(() => /^\d{4}$/.test(gatePin), [gatePin]);

  const modalOpen =
    composeOpen ||
    pinGate !== null ||
    editBundle !== null ||
    deleteBundle !== null ||
    deleteSuccessOpen;

  const closeTopOverlay = useCallback(() => {
    if (submitting || gateSubmitting || deleteSubmitting) return;
    if (deleteSuccessOpen) {
      closeDeleteSuccess();
      return;
    }
    if (deleteBundle) {
      closeDeleteFlow();
      return;
    }
    if (editBundle) {
      closeEditFlow();
      return;
    }
    if (pinGate) {
      closeGate();
      return;
    }
    if (composeOpen) closeCompose();
  }, [
    closeCompose,
    closeDeleteFlow,
    closeDeleteSuccess,
    closeEditFlow,
    closeGate,
    composeOpen,
    deleteBundle,
    deleteSubmitting,
    deleteSuccessOpen,
    editBundle,
    gateSubmitting,
    pinGate,
    submitting,
  ]);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeTopOverlay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeTopOverlay, modalOpen]);

  if (!remote) {
    return (
      <div className="guestbook__offline">
        <p className="guestbook__offline-msg">
          이 환경에서는 방명록 서버에 연결되지 않습니다. 배포된 청첩장에서 방명록을 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  const menuEntry = useMemo(
    () => (menuOpenEntryId ? (entries.find((x) => x.id === menuOpenEntryId) ?? null) : null),
    [entries, menuOpenEntryId]
  );

  const activeTitleId = composeOpen
    ? titleCompose
    : pinGate
      ? titleGate
      : editBundle
        ? titleEdit
        : deleteBundle
          ? titleDelConfirm
          : deleteSuccessOpen
            ? titleDelDone
            : titleCompose;

  return (
    <>
      <div className="guestbook__toolbar">
        <button type="button" className="guestbook__write-btn" onClick={() => setComposeOpen(true)}>
          작성
        </button>
      </div>
      {listErr ? (
        <p className="guestbook__list-err" role="alert">
          {listErr}
        </p>
      ) : null}
      <div ref={listScrollRef} className="guestbook__list-scroll" aria-busy={loading}>
        {loading && entries.length === 0 ? (
          <p className="guestbook__list-empty">불러오는 중…</p>
        ) : entries.length === 0 ? (
          <p className="guestbook__list-empty">첫 방명록을 남겨 주세요.</p>
        ) : (
          <ul className="guestbook__list">
            {entries.map((e) => (
              <li key={e.id} className="guestbook__card">
                <div className="guestbook__card-row">
                  <div className="guestbook__card-main">
                    <div className="guestbook__card-meta">
                      <span className={`guestbook__badge guestbook__badge--${e.side}`}>{sideLabel(e.side)}</span>
                      <span className="guestbook__card-name">{e.authorName}</span>
                      <time className="guestbook__card-time" dateTime={e.createdAt}>
                        {formatAt(e.createdAt)}
                      </time>
                    </div>
                    <p className="guestbook__card-body">{e.body}</p>
                  </div>
                  <div className="guestbook__card-menu">
                    <button
                      ref={menuOpenEntryId === e.id ? menuButtonRef : undefined}
                      type="button"
                      className="guestbook__card-more"
                      aria-haspopup="menu"
                      aria-expanded={menuOpenEntryId === e.id}
                      aria-controls={menuOpenEntryId === e.id ? `guestbook-card-menu-${fieldUid}` : undefined}
                      aria-label="방명록 메뉴"
                      onClick={() => setMenuOpenEntryId((id) => (id === e.id ? null : e.id))}
                    >
                      ...
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menuEntry && menuDropdownPos && typeof document !== "undefined"
        ? createPortal(
            <ul
              id={`guestbook-card-menu-${fieldUid}`}
              className="guestbook__dropdown"
              role="menu"
              style={{ top: menuDropdownPos.top, right: menuDropdownPos.right }}
            >
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="guestbook__dropdown-item"
                  onClick={() => {
                    setMenuOpenEntryId(null);
                    setPinGate({ mode: "edit", entry: menuEntry });
                    setGatePin("");
                    setGateErr(null);
                  }}
                >
                  수정
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="guestbook__dropdown-item guestbook__dropdown-item--danger"
                  onClick={() => {
                    setMenuOpenEntryId(null);
                    setPinGate({ mode: "delete", entry: menuEntry });
                    setGatePin("");
                    setGateErr(null);
                  }}
                >
                  삭제
                </button>
              </li>
            </ul>,
            document.body
          )
        : null}

      {modalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="guestbook-modal-root" role="presentation">
              <div
                className="guestbook-modal-backdrop"
                aria-hidden="true"
                onClick={() => closeTopOverlay()}
              />
              <div
                className={`guestbook-modal${deleteSuccessOpen || pinGate || deleteBundle ? " guestbook-modal--compact" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={activeTitleId}
              >
                {composeOpen ? (
                  <>
                    <div className="guestbook-modal__header">
                      <h3 id={titleCompose} className="guestbook-modal__title">
                        방명록 작성
                      </h3>
                      <button
                        type="button"
                        className="guestbook-modal__close"
                        disabled={submitting}
                        onClick={closeCompose}
                        aria-label="닫기"
                      >
                        ×
                      </button>
                    </div>
                    <form
                      className="guestbook-modal__form"
                      autoComplete="off"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!composeValid || submitting) return;
                        void onSubmitCreate();
                      }}
                    >
                      <div className="guestbook-modal__body">
                        <p className="guestbook-modal__hint">
                          비밀번호는 숫자 4자리이며, 이후 수정·삭제할 때 필요합니다.
                        </p>
                        <div className="guestbook-modal__field">
                          <span className="guestbook-modal__label">하객측</span>
                          <div className="guestbook-modal__side-toggle" role="group" aria-label="신랑 또는 신부 측">
                            <button
                              type="button"
                              className={`guestbook-modal__side-btn${side === "groom" ? " is-on" : ""}`}
                              onClick={() => setSide("groom")}
                            >
                              신랑
                            </button>
                            <button
                              type="button"
                              className={`guestbook-modal__side-btn${side === "bride" ? " is-on" : ""}`}
                              onClick={() => setSide("bride")}
                            >
                              신부
                            </button>
                          </div>
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-name-${fieldUid}`}>
                            이름
                          </label>
                          <input
                            id={`gb-name-${fieldUid}`}
                            name={`gb-guest-msg-${fieldUid}`}
                            className="guestbook-modal__input"
                            value={authorName}
                            onChange={(ev) => setAuthorName(ev.target.value)}
                            maxLength={80}
                            autoComplete="off"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-body-${fieldUid}`}>
                            내용
                          </label>
                          <textarea
                            id={`gb-body-${fieldUid}`}
                            name={`gb-guest-body-${fieldUid}`}
                            className="guestbook-modal__textarea"
                            value={body}
                            onChange={(ev) => setBody(ev.target.value)}
                            maxLength={2000}
                            rows={5}
                            autoComplete="off"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-pin-${fieldUid}`}>
                            비밀번호 (숫자 4자리)
                          </label>
                          <PinField
                            id={`gb-pin-${fieldUid}`}
                            name={`gb-guest-code-${fieldUid}`}
                            value={pin}
                            onChange={setPin}
                            disabled={submitting}
                          />
                        </div>
                        {formErr ? (
                          <p className="guestbook-modal__err" role="alert">
                            {formErr}
                          </p>
                        ) : null}
                      </div>
                      <div className="guestbook-modal__footer">
                        <button type="button" className="guestbook-modal__btn ghost" disabled={submitting} onClick={closeCompose}>
                          취소
                        </button>
                        <button type="submit" className="guestbook-modal__btn primary" disabled={!composeValid || submitting}>
                          {submitting ? "저장 중…" : "등록"}
                        </button>
                      </div>
                    </form>
                  </>
                ) : pinGate ? (
                  <>
                    <div className="guestbook-modal__header">
                      <h3 id={titleGate} className="guestbook-modal__title">
                        비밀번호를 입력하세요.
                      </h3>
                      <button type="button" className="guestbook-modal__close" disabled={gateSubmitting} onClick={closeGate} aria-label="닫기">
                        ×
                      </button>
                    </div>
                    <form
                      className="guestbook-modal__form"
                      autoComplete="off"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!gateValid || gateSubmitting) return;
                        void onGateSubmit();
                      }}
                    >
                      <div className="guestbook-modal__body">
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-gate-pin-${fieldUid}`}>
                            비밀번호 (숫자 4자리)
                          </label>
                          <PinField
                            id={`gb-gate-pin-${fieldUid}`}
                            name={`gb-gate-code-${fieldUid}`}
                            value={gatePin}
                            onChange={setGatePin}
                            disabled={gateSubmitting}
                          />
                        </div>
                        {gateErr ? (
                          <p className="guestbook-modal__err" role="alert">
                            {gateErr}
                          </p>
                        ) : null}
                      </div>
                      <div className="guestbook-modal__footer">
                        <button type="button" className="guestbook-modal__btn ghost" disabled={gateSubmitting} onClick={closeGate}>
                          취소
                        </button>
                        <button type="submit" className="guestbook-modal__btn primary" disabled={!gateValid || gateSubmitting}>
                          {gateSubmitting ? "확인 중…" : "확인"}
                        </button>
                      </div>
                    </form>
                  </>
                ) : editBundle ? (
                  <>
                    <div className="guestbook-modal__header">
                      <h3 id={titleEdit} className="guestbook-modal__title">
                        방명록 수정
                      </h3>
                      <button type="button" className="guestbook-modal__close" disabled={submitting} onClick={closeEditFlow} aria-label="닫기">
                        ×
                      </button>
                    </div>
                    <form
                      className="guestbook-modal__form"
                      autoComplete="off"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!editValid || submitting) return;
                        void onSubmitEdit();
                      }}
                    >
                      <div className="guestbook-modal__body">
                        <div className="guestbook-modal__field">
                          <span className="guestbook-modal__label">하객측</span>
                          <div className="guestbook-modal__side-toggle guestbook-modal__side-toggle--readonly" aria-readonly="true">
                            <span className={`guestbook-modal__side-pill guestbook-modal__side-pill--${editBundle.entry.side}`}>
                              {sideLabel(editBundle.entry.side)}
                            </span>
                          </div>
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-edit-name-${fieldUid}`}>
                            이름
                          </label>
                          <input
                            id={`gb-edit-name-${fieldUid}`}
                            name={`gb-edit-msg-${fieldUid}`}
                            className="guestbook-modal__input"
                            value={editName}
                            onChange={(ev) => setEditName(ev.target.value)}
                            maxLength={80}
                            autoComplete="off"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-edit-body-${fieldUid}`}>
                            내용
                          </label>
                          <textarea
                            id={`gb-edit-body-${fieldUid}`}
                            name={`gb-edit-body-${fieldUid}`}
                            className="guestbook-modal__textarea"
                            value={editBody}
                            onChange={(ev) => setEditBody(ev.target.value)}
                            maxLength={2000}
                            rows={5}
                            autoComplete="off"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="guestbook-modal__field">
                          <label className="guestbook-modal__label" htmlFor={`gb-edit-pin-ro-${fieldUid}`}>
                            비밀번호
                          </label>
                          <input
                            id={`gb-edit-pin-ro-${fieldUid}`}
                            className="guestbook-modal__input guestbook-modal__input--pin-readonly"
                            type="text"
                            readOnly
                            disabled
                            tabIndex={-1}
                            value="****"
                            autoComplete="off"
                            aria-label="비밀번호"
                          />
                        </div>
                        {editFormErr ? (
                          <p className="guestbook-modal__err" role="alert">
                            {editFormErr}
                          </p>
                        ) : null}
                      </div>
                      <div className="guestbook-modal__footer">
                        <button type="button" className="guestbook-modal__btn ghost" disabled={submitting} onClick={closeEditFlow}>
                          취소
                        </button>
                        <button type="submit" className="guestbook-modal__btn primary" disabled={!editValid || submitting}>
                          {submitting ? "저장 중…" : "저장"}
                        </button>
                      </div>
                    </form>
                  </>
                ) : deleteBundle ? (
                  <>
                    <div className="guestbook-modal__header">
                      <h3 id={titleDelConfirm} className="guestbook-modal__title">
                        방명록 삭제
                      </h3>
                      <button
                        type="button"
                        className="guestbook-modal__close"
                        disabled={deleteSubmitting}
                        onClick={closeDeleteFlow}
                        aria-label="닫기"
                      >
                        ×
                      </button>
                    </div>
                    <div className="guestbook-modal__form">
                      <div className="guestbook-modal__body">
                        <p className="guestbook-modal__hint guestbook-modal__hint--emph">방명록을 삭제하시겠습니까?</p>
                        <blockquote className="guestbook-modal__preview">
                          <strong>{deleteBundle.entry.authorName}</strong>
                          <span className="guestbook-modal__preview-side"> · {sideLabel(deleteBundle.entry.side)}</span>
                          <p>{deleteBundle.entry.body}</p>
                        </blockquote>
                      </div>
                      <div className="guestbook-modal__footer">
                        <button type="button" className="guestbook-modal__btn ghost" disabled={deleteSubmitting} onClick={closeDeleteFlow}>
                          취소
                        </button>
                        <button type="button" className="guestbook-modal__btn danger" disabled={deleteSubmitting} onClick={() => void onConfirmDelete()}>
                          {deleteSubmitting ? "삭제 중…" : "확인"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : deleteSuccessOpen ? (
                  <>
                    <div className="guestbook-modal__header">
                      <h3 id={titleDelDone} className="guestbook-modal__title">
                        삭제 완료
                      </h3>
                      <button type="button" className="guestbook-modal__close" onClick={closeDeleteSuccess} aria-label="닫기">
                        ×
                      </button>
                    </div>
                    <div className="guestbook-modal__form">
                      <div className="guestbook-modal__body">
                        <p className="guestbook-modal__hint guestbook-modal__hint--emph">방명록이 삭제되었습니다.</p>
                      </div>
                      <div className="guestbook-modal__footer">
                        <button type="button" className="guestbook-modal__btn primary" onClick={closeDeleteSuccess}>
                          확인
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
