/**
 * `public/weddings/{id}/static/Our Story/our-story-pages.txt` — JSON 한 덩어리.
 * 페이지 순서 = 스토리 스와이프 순서.
 */
export type OurStoryScriptLine = {
  text: string;
  /** `Audio/{folder}` 안의 파일명 e.g. `01.mp3` */
  audio: string;
  /** 구분용: `groom` | `bride` | `신랑` | `신부` — 인터루드에서 `wedding-data` 이름(이름 필드)과 매칭 */
  speaker?: string;
};

export type OurStoryPage = {
  /** 스토리 챕터 id. 배경은 `Back/{folder}`, 대사 오디오는 `Audio/{folder}`, 애니메이션은 `public/static/story/animation/{folder}` 사용 */
  folder: string;
  /** 구분용 페이지 번호/라벨(표시 안 함) */
  page?: string;
  lines: OurStoryScriptLine[];
};

export type OurStoryPagesManifest = {
  pages: OurStoryPage[];
};

function normalizeLine(row: unknown): OurStoryScriptLine | null {
  if (row == null || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text : "";
  const audio = typeof o.audio === "string" ? o.audio.trim() : "";
  const speaker = typeof o.speaker === "string" ? o.speaker.trim() : undefined;
  if (!text.trim()) return null;
  return { text, audio, speaker: speaker || undefined };
}

function normalizePage(row: unknown): OurStoryPage | null {
  if (row == null || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const folder = typeof o.folder === "string" ? o.folder.trim() : "";
  if (!folder) return null;
  const page = typeof o.page === "string" ? o.page.trim() : undefined;
  const rawLines = Array.isArray(o.lines) ? o.lines : [];
  const lines: OurStoryScriptLine[] = [];
  for (const r of rawLines) {
    const line = normalizeLine(r);
    if (line) lines.push(line);
  }
  return { folder, page: page || undefined, lines };
}

/** 원문이 비었거나 JSON 오류면 빈 배열 */
export function parseOurStoryPagesManifest(raw: string | null | undefined): OurStoryPage[] {
  if (raw == null) return [];
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  try {
    const data: unknown = JSON.parse(trimmed);
    let arr: unknown[] = [];
    if (Array.isArray(data)) {
      arr = data;
    } else if (data && typeof data === "object" && "pages" in data) {
      const p = (data as OurStoryPagesManifest).pages;
      arr = Array.isArray(p) ? p : [];
    }
    const out: OurStoryPage[] = [];
    for (const row of arr) {
      const page = normalizePage(row);
      if (page) out.push(page);
    }
    return out;
  } catch {
    return [];
  }
}
