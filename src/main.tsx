import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import { AdminPage } from "./AdminPage";
import { NotFoundPage } from "./NotFoundPage";
import { WeddingLoadErrorPage } from "./WeddingLoadErrorPage";
import { DEFAULT_WEDDING_ID } from "./wedding-data";
import "./App.css";

function routerBasename(): string | undefined {
  const b = import.meta.env.BASE_URL;
  if (!b || b === "/") return undefined;
  return b.replace(/\/$/, "");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <Routes>
        <Route path="/wedding-load-error" element={<WeddingLoadErrorPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<Navigate to={`/${DEFAULT_WEDDING_ID}`} replace />} />
        <Route path="/:weddingId" element={<App />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
