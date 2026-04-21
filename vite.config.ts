import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 프로젝트 사이트는 `/저장소이름/` 이어야 자산이 로드됩니다. Actions에서 VITE_BASE_PATH 로 넘깁니다. */
const base = process.env.VITE_BASE_PATH?.replace(/\/?$/, "/") || "/";

export default defineConfig({
  base,
  plugins: [react()],
});
