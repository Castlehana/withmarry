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

export const weddingData: WeddingData = loadWeddingData();
