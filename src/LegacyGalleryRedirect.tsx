import { Navigate, useParams } from "react-router-dom";
import { DEFAULT_WEDDING_ID, isValidWeddingId } from "./wedding-data";

/** 예전 `/:weddingId/gallery` 북마크 → 청첩장 본문(갤러리 페이지 제거됨) */
export function LegacyGalleryRedirect() {
  const { weddingId = "" } = useParams();
  if (!isValidWeddingId(weddingId)) {
    return <Navigate to={`/${DEFAULT_WEDDING_ID}`} replace />;
  }
  return <Navigate to={`/${encodeURIComponent(weddingId)}`} replace />;
}
