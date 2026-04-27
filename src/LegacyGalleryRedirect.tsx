import { Navigate, useParams } from "react-router-dom";
import { DEFAULT_WEDDING_ID, isValidWeddingId } from "./wedding-data";

/** 예전 `/:weddingId/gallery` 북마크 → 동일 청첩장 + 쿼리로 통합 */
export function LegacyGalleryRedirect() {
  const { weddingId = "" } = useParams();
  if (!isValidWeddingId(weddingId)) {
    return <Navigate to={`/${DEFAULT_WEDDING_ID}?gallery=1`} replace />;
  }
  return <Navigate to={`/${encodeURIComponent(weddingId)}?gallery=1`} replace />;
}
