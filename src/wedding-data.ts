import type { WeddingData } from "./wedding-data.types";
import raw from "./wedding-data.txt?raw";

function stripLeadingHashComments(source: string) {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
}

function loadWeddingData(): WeddingData {
  const json = stripLeadingHashComments(raw);
  try {
    return JSON.parse(json) as WeddingData;
  } catch (e) {
    console.error("wedding-data.txt JSON 파싱 실패:", e);
    throw new Error("wedding-data.txt 형식을 확인해 주세요. (# 주석 다음 유효한 JSON)");
  }
}

/** `wedding-data.txt` 안 문자열에 넣은 `{{groom.성이름}}` 등을 실제 이름으로 치환 */
function expandNamePlaceholders(data: WeddingData): WeddingData {
  const { groom, bride } = data.couple;
  const rep: Record<string, string> = {
    "{{groom.성이름}}": groom.성이름,
    "{{groom.이름}}": groom.이름,
    "{{bride.성이름}}": bride.성이름,
    "{{bride.이름}}": bride.이름,
  };

  const applyString = (s: string) => {
    let out = s;
    for (const [token, val] of Object.entries(rep)) {
      out = out.split(token).join(val);
    }
    return out;
  };

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return applyString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, walk(val)])
      );
    }
    return v;
  };

  const expanded = walk(data) as WeddingData;
  if (!expanded.couple.topBarTitle?.trim()) {
    expanded.couple.topBarTitle = `${expanded.couple.groom.이름} · ${expanded.couple.bride.이름}`;
  }
  return expanded;
}

export const weddingData: WeddingData = expandNamePlaceholders(loadWeddingData());
