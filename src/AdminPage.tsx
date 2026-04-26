import { useCallback, useEffect, useState } from "react";
import {
  clearAdminSession,
  getAdminSessionWeddingId,
  setAdminRsvpApiBearer,
  setAdminSessionWeddingId,
} from "./admin-session";
import {
  fetchAdminExpectedPassword,
  isValidWeddingId,
  weddingDataBundleExists,
} from "./wedding-data";
import { AdminRsvpDashboard } from "./AdminRsvpDashboard";
import { AdminGuestbookDashboard } from "./AdminGuestbookDashboard";
import "./AdminPage.css";

export function AdminPage() {
  const [sessionId, setSessionId] = useState<string | null>(() => getAdminSessionWeddingId());
  const [weddingIdInput, setWeddingIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = sessionId ? "참석 여부" : "로그인";
  }, [sessionId]);

  const onLogout = useCallback(() => {
    clearAdminSession();
    setSessionId(null);
    setPasswordInput("");
    setError(null);
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const id = weddingIdInput.trim();
      const password = passwordInput.trim();
      if (!id) {
        setError("웨딩 ID를 입력해 주세요.");
        return;
      }
      if (!isValidWeddingId(id)) {
        setError("웨딩 ID 형식이 올바르지 않습니다.");
        return;
      }
      setPending(true);
      try {
        const exists = await weddingDataBundleExists(id);
        if (!exists) {
          setError("해당 웨딩 데이터를 찾을 수 없습니다.");
          return;
        }
        const expected = await fetchAdminExpectedPassword(id);
        if (password !== expected) {
          setError("비밀번호가 일치하지 않습니다.");
          return;
        }
        setAdminSessionWeddingId(id);
        setAdminRsvpApiBearer(password);
        setSessionId(id);
        setPasswordInput("");
      } catch {
        setError("확인 중 오류가 났습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setPending(false);
      }
    },
    [weddingIdInput, passwordInput]
  );

  if (sessionId) {
    return (
      <div className="admin-page admin-page--dashboard">
        <div className="admin-page__dash">
          <p className="admin-page__dash-id">
            웨딩 ID: <strong>{sessionId}</strong>
          </p>
          <div className="admin-page__links">
            <button type="button" className="admin-page__btn-ghost" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
        <AdminRsvpDashboard weddingId={sessionId} />
        <AdminGuestbookDashboard weddingId={sessionId} />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page__title">로그인</h1>
      <form className="admin-page__card" onSubmit={onSubmit} noValidate>
        {error ? (
          <p className="admin-page__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-page__field">
          <label className="admin-page__label" htmlFor="admin-wedding-id">
            웨딩 ID
          </label>
          <input
            id="admin-wedding-id"
            className="admin-page__input"
            type="text"
            name="weddingId"
            autoComplete="username"
            value={weddingIdInput}
            onChange={(ev) => setWeddingIdInput(ev.target.value)}
            placeholder="예: sample01"
            spellCheck={false}
          />
        </div>
        <div className="admin-page__field">
          <label className="admin-page__label" htmlFor="admin-password">
            비밀번호
          </label>
          <input
            id="admin-password"
            className="admin-page__input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={passwordInput}
            onChange={(ev) => setPasswordInput(ev.target.value)}
          />
        </div>
        <button className="admin-page__submit" type="submit" disabled={pending}>
          {pending ? "확인 중…" : "로그인"}
        </button>
      </form>
      <p className="admin-page__hint">
        비밀번호는 각 웨딩 폴더의 <code>admin-password.txt</code>에 저장합니다. 파일이 없거나 비어 있으면 기본값{" "}
        <code>0000</code>입니다.
      </p>
    </div>
  );
}
