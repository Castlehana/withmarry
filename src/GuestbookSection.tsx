import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createGuestbookEntry,
  deleteGuestbookEntryAsAuthor,
  fetchGuestbookList,
  updateGuestbookEntry,
  verifyGuestbookEntryPin,
  type GuestbookEntry,
  type GuestbookSide,
} from "./guestbook-client";

type Props = { weddingId: string };

type PinGate = { mode: "edit" | "delete"; entry: GuestbookEntry };
type GuestbookFilterSide = "all" | GuestbookSide;
type GuestbookSearchMode = "all" | "author" | "body";

const GUESTBOOK_FULL_EXIT_MS = 220;
const GUESTBOOK_MODAL_EXIT_MS = 220;

function sideLabel(side: GuestbookSide): string {
  return side === "groom" ? "신랑" : "신부";
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
  const titleCompose = useId();
  const titleGate = useId();
  const titleEdit = useId();
  const titleDelConfirm = useId();
  const titleDelDone = useId();
  const titleList = useId();
  const fieldUid = useId().replace(/:/g, "");

  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [usedLocalStore, setUsedLocalStore] = useState(false);

  const [menuOpenEntryId, setMenuOpenEntryId] = useState<string | null>(null);
  const [menuDropdownPos, setMenuDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const [listOverlayOpen, setListOverlayOpen] = useState(false);
  const [listOverlayClosing, setListOverlayClosing] = useState(false);
  const listOverlayTimerRef = useRef<number | null>(null);
  const [filterSide, setFilterSide] = useState<GuestbookFilterSide>("all");
  const [searchMode, setSearchMode] = useState<GuestbookSearchMode>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
  const [modalClosing, setModalClosing] = useState(false);
  const modalCloseTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListErr(null);
    try {
      const r = await fetchGuestbookList(weddingId);
      setEntries(r.entries);
      setListErr(r.error);
      setUsedLocalStore(Boolean(r.usedLocalStore));
    } catch {
      setListErr("목록을 불러오지 못했습니다.");
      setEntries([]);
      setUsedLocalStore(false);
    } finally {
      setLoading(false);
    }
  }, [weddingId]);

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

  const beginModalClose = useCallback((reset: () => void) => {
    if (modalCloseTimerRef.current !== null) {
      window.clearTimeout(modalCloseTimerRef.current);
      modalCloseTimerRef.current = null;
    }
    setModalClosing(true);
    modalCloseTimerRef.current = window.setTimeout(() => {
      reset();
      setModalClosing(false);
      modalCloseTimerRef.current = null;
    }, GUESTBOOK_MODAL_EXIT_MS);
  }, []);

  const resetCompose = useCallback(() => {
    setComposeOpen(false);
    setSide("groom");
    setAuthorName("");
    setBody("");
    setPin("");
    setFormErr(null);
  }, []);

  const closeCompose = useCallback(() => {
    beginModalClose(resetCompose);
  }, [beginModalClose, resetCompose]);

  const resetGate = useCallback(() => {
    setPinGate(null);
    setGatePin("");
    setGateErr(null);
    setGateSubmitting(false);
  }, []);

  const closeGate = useCallback(() => {
    beginModalClose(resetGate);
  }, [beginModalClose, resetGate]);

  const resetEditFlow = useCallback(() => {
    setEditBundle(null);
    setEditName("");
    setEditBody("");
    setEditFormErr(null);
  }, []);

  const closeEditFlow = useCallback(() => {
    beginModalClose(resetEditFlow);
  }, [beginModalClose, resetEditFlow]);

  const resetDeleteFlow = useCallback(() => {
    setDeleteBundle(null);
  }, []);

  const closeDeleteFlow = useCallback(() => {
    beginModalClose(resetDeleteFlow);
  }, [beginModalClose, resetDeleteFlow]);

  const resetDeleteSuccess = useCallback(() => {
    setDeleteSuccessOpen(false);
  }, []);

  const closeDeleteSuccess = useCallback(() => {
    beginModalClose(resetDeleteSuccess);
  }, [beginModalClose, resetDeleteSuccess]);

  const openListOverlay = useCallback(() => {
    if (listOverlayTimerRef.current !== null) {
      window.clearTimeout(listOverlayTimerRef.current);
      listOverlayTimerRef.current = null;
    }
    setListOverlayClosing(false);
    setListOverlayOpen(true);
  }, []);

  const closeListOverlay = useCallback((immediate = false) => {
    if (listOverlayTimerRef.current !== null) {
      window.clearTimeout(listOverlayTimerRef.current);
      listOverlayTimerRef.current = null;
    }
    if (immediate) {
      setListOverlayClosing(false);
      setListOverlayOpen(false);
      return;
    }
    setListOverlayClosing(true);
    listOverlayTimerRef.current = window.setTimeout(() => {
      setListOverlayOpen(false);
      setListOverlayClosing(false);
      listOverlayTimerRef.current = null;
    }, GUESTBOOK_FULL_EXIT_MS);
    setMenuOpenEntryId(null);
  }, []);

  useEffect(
    () => () => {
      if (listOverlayTimerRef.current !== null) {
        window.clearTimeout(listOverlayTimerRef.current);
      }
      if (modalCloseTimerRef.current !== null) {
        window.clearTimeout(modalCloseTimerRef.current);
      }
    },
    []
  );

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
        resetGate();
      } else {
        setDeleteBundle({ entry: pinGate.entry, pin: gatePin });
        resetGate();
      }
    } catch {
      setGateErr("확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setGateSubmitting(false);
    }
  }, [gatePin, pinGate, resetGate, weddingId]);

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
  const anyOverlayOpen = modalOpen || modalClosing || listOverlayOpen;

  const closeTopOverlay = useCallback(() => {
    if (submitting || gateSubmitting || deleteSubmitting) return;
    if (listOverlayOpen) {
      closeListOverlay();
      return;
    }
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
    closeListOverlay,
    composeOpen,
    deleteBundle,
    deleteSubmitting,
    deleteSuccessOpen,
    editBundle,
    gateSubmitting,
    pinGate,
    submitting,
    listOverlayOpen,
  ]);

  useEffect(() => {
    if (!anyOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOverlayOpen]);

  useEffect(() => {
    if (!anyOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeTopOverlay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anyOverlayOpen, closeTopOverlay]);

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

  const marqueeEntriesBySide = useMemo(() => {
    const repeatEntries = (items: GuestbookEntry[]) => {
      if (items.length === 0) return [];
      if (items.length === 1) return Array.from({ length: 6 }, () => items[0]);
      return [...items, ...items];
    };
    const groom = entries.filter((entry) => entry.side === "groom");
    const bride = entries.filter((entry) => entry.side === "bride");
    return {
      groom: repeatEntries(groom),
      bride: repeatEntries(bride),
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ko-KR");
    return entries.filter((entry) => {
      if (filterSide !== "all" && entry.side !== filterSide) return false;
      if (!query) return true;
      const author = entry.authorName.toLocaleLowerCase("ko-KR");
      const message = entry.body.toLocaleLowerCase("ko-KR");
      if (searchMode === "author") return author.includes(query);
      if (searchMode === "body") return message.includes(query);
      return author.includes(query) || message.includes(query);
    });
  }, [entries, filterSide, searchMode, searchQuery]);

  const renderCard = useCallback(
    (e: GuestbookEntry, key: string, options?: { menu?: boolean }) => (
      <li key={key} className="guestbook__card">
        <div className="guestbook__card-row">
          <div className="guestbook__card-main">
            <div className="guestbook__card-meta">
              <span className={`guestbook__badge guestbook__badge--${e.side}`}>{sideLabel(e.side)}측</span>
            </div>
            <p className="guestbook__card-body">{e.body}</p>
            <p className="guestbook__card-from">From {e.authorName}</p>
          </div>
          {options?.menu ? (
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
          ) : null}
        </div>
      </li>
    ),
    [fieldUid, menuOpenEntryId]
  );

  return (
    <>
      {usedLocalStore ? (
        <p className="guestbook__local-hint" role="status">
          서버에 연결되지 않아 방명록은 이 브라우저에만 저장됩니다. 다른 기기나 배포 URL에서는 보이지 않습니다.
        </p>
      ) : null}
      <div className="guestbook__toolbar">
        <button type="button" className="guestbook__write-btn" onClick={() => setComposeOpen(true)}>
          작성
        </button>
        <button
          type="button"
          className="guestbook__fullscreen-btn"
          onClick={openListOverlay}
          disabled={entries.length === 0 && loading}
        >
          전체보기
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
          <p className="guestbook__list-empty">첫 방명록을 작성해 주세요.</p>
        ) : (
          <div className="guestbook__marquee-board">
            {marqueeEntriesBySide.groom.length > 0 ? (
              <div className="guestbook__marquee-lane">
                <ul className="guestbook__list guestbook__list--marquee guestbook__list--groom-marquee">
                  {marqueeEntriesBySide.groom.map((e, index) => renderCard(e, `${e.id}-groom-marquee-${index}`))}
                </ul>
              </div>
            ) : null}
            {marqueeEntriesBySide.bride.length > 0 ? (
              <div className="guestbook__marquee-lane">
                <ul className="guestbook__list guestbook__list--marquee guestbook__list--bride-marquee">
                  {marqueeEntriesBySide.bride.map((e, index) => renderCard(e, `${e.id}-bride-marquee-${index}`))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {listOverlayOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`guestbook-full-root${listOverlayClosing ? " guestbook-full-root--closing" : ""}`}
              role="presentation"
            >
              <div className="guestbook-full-backdrop" aria-hidden="true" onClick={() => closeListOverlay()} />
              <section className="guestbook-full" role="dialog" aria-modal="true" aria-labelledby={titleList}>
                <div className="guestbook-full__header">
                  <h3 id={titleList} className="guestbook-full__title">
                    방명록
                  </h3>
                  <button type="button" className="guestbook-full__close" onClick={() => closeListOverlay()} aria-label="닫기">
                    ×
                  </button>
                </div>
                <div className="guestbook-full__tools" aria-label="방명록 검색">
                  <div className="guestbook-full__tool-row">
                    <span className="guestbook-full__tool-label">필터</span>
                    <div className="guestbook-full__segmented" role="group" aria-label="하객측 필터">
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${filterSide === "all" ? " is-on" : ""}`}
                        onClick={() => setFilterSide("all")}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${filterSide === "groom" ? " is-on" : ""}`}
                        onClick={() => setFilterSide("groom")}
                      >
                        신랑측
                      </button>
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${filterSide === "bride" ? " is-on" : ""}`}
                        onClick={() => setFilterSide("bride")}
                      >
                        신부측
                      </button>
                    </div>
                  </div>
                  <div className="guestbook-full__tool-row">
                    <span className="guestbook-full__tool-label">검색</span>
                    <div className="guestbook-full__segmented" role="group" aria-label="검색 대상">
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${searchMode === "all" ? " is-on" : ""}`}
                        onClick={() => setSearchMode("all")}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${searchMode === "author" ? " is-on" : ""}`}
                        onClick={() => setSearchMode("author")}
                      >
                        이름
                      </button>
                      <button
                        type="button"
                        className={`guestbook-full__seg-btn${searchMode === "body" ? " is-on" : ""}`}
                        onClick={() => setSearchMode("body")}
                      >
                        내용
                      </button>
                    </div>
                  </div>
                  <div className="guestbook-full__search-row">
                    <input
                      className="guestbook-full__search-input"
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="검색어를 입력해 주세요"
                      aria-label="방명록 검색어"
                    />
                    {searchQuery ? (
                      <button type="button" className="guestbook-full__clear" onClick={() => setSearchQuery("")}>
                        지우기
                      </button>
                    ) : null}
                  </div>
                  <p className="guestbook-full__result-count" aria-live="polite">
                    {entries.length === 0 ? "0개" : `${filteredEntries.length} / ${entries.length}개`}
                  </p>
                </div>
                <div className="guestbook-full__body">
                  {entries.length === 0 ? (
                    <p className="guestbook__list-empty">첫 방명록을 작성해 주세요.</p>
                  ) : filteredEntries.length === 0 ? (
                    <p className="guestbook__list-empty">검색 결과가 없습니다.</p>
                  ) : (
                    <ul className="guestbook__list guestbook__list--full">
                      {filteredEntries.map((e) => renderCard(e, `${e.id}-full`, { menu: true }))}
                    </ul>
                  )}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

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
                    closeListOverlay(true);
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
                    closeListOverlay(true);
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
            <div className={`guestbook-modal-root${modalClosing ? " guestbook-modal-root--closing" : ""}`} role="presentation">
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
