import { Link, useLocation } from "react-router-dom";
import { DEFAULT_WEDDING_ID } from "./wedding-data";

export type WeddingLoadErrorState = {
  weddingId?: string;
  message?: string;
};

export function WeddingLoadErrorPage() {
  const { state } = useLocation();
  const s = (state ?? {}) as WeddingLoadErrorState;
  const idPart = s.weddingId ? `「${s.weddingId}」` : "";

  return (
    <div className="wedding-load-screen wedding-load-screen--error" role="alert">
      <div>
        <p className="wedding-load-screen__title">청첩장을 찾을 수 없습니다</p>
        <p className="wedding-load-screen__msg">
          {idPart ? `${idPart}에 해당하는 데이터가 없거나 불러오지 못했습니다.` : "요청한 청첩장 데이터를 불러오지 못했습니다."}
          {s.message ? (
            <>
              <br />
              <span className="wedding-load-screen__detail">{s.message}</span>
            </>
          ) : null}
        </p>
        <p>
          <Link className="wedding-load-screen__link" to={`/${DEFAULT_WEDDING_ID}`}>
            기본 청첩장({DEFAULT_WEDDING_ID})으로 이동
          </Link>
        </p>
      </div>
    </div>
  );
}
