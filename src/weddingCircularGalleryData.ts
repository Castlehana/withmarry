import { weddingBundleBaseUrl } from "./wedding-data";

/** `public/weddings/{id}/static/Gallery/01.png` … `10.png` */
export const WEDDING_CIRCULAR_GALLERY_COUNT = 10;

export function weddingGalleryStillUrl(weddingId: string, index1Based: number): string {
  const n = String(index1Based).padStart(2, "0");
  return `${weddingBundleBaseUrl(weddingId)}static/Gallery/${n}.png`;
}
