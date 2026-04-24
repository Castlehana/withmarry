/**
 * `public/static/Our Story/our-story-pages.txt`(JSON)가 있으면 그 안의 `pages[].folder` 순서로 `_chapters.json` 생성.
 * 없으면 직계 하위 폴더만 사전 순(ko) 정렬(이전 동작).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../public/static/Our Story");
const outFile = path.join(root, "_chapters.json");
const manifestFile = path.join(root, "our-story-pages.txt");

function readChaptersFromManifest() {
  if (!fs.existsSync(manifestFile)) return null;
  const raw = fs.readFileSync(manifestFile, "utf8").replace(/^\uFEFF/, "").trim();
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const folders = [];
    const seen = new Set();
    for (const p of pages) {
      if (p && typeof p === "object" && typeof p.folder === "string") {
        const name = p.folder.trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          folders.push(name);
        }
      }
    }
    return folders.length ? folders : null;
  } catch (e) {
    console.warn("[our-story-chapters] invalid our-story-pages.txt:", e?.message || e);
    return null;
  }
}

function readChaptersFromDirectories() {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ko"));
}

function main() {
  if (!fs.existsSync(root)) {
    console.warn(`[our-story-chapters] skip: missing ${root}`);
    return;
  }
  const fromManifest = readChaptersFromManifest();
  const chapters = fromManifest ?? readChaptersFromDirectories();
  const payload = { chapters: chapters.length ? chapters : ["main_page"] };
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const src =
    fromManifest != null ? `our-story-pages.txt (${fromManifest.length} folders)` : "folder scan";
  console.log(`[our-story-chapters] wrote ${payload.chapters.length} chapters (${src}) → ${path.relative(process.cwd(), outFile)}`);
}

main();
