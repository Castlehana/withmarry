export async function copyTextToClipboard(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    return;
  } catch {
    /* 비보안 컨텍스트·권한 거부 등 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, t.length);
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    /* 복사 실패 시 무시 */
  }
}
