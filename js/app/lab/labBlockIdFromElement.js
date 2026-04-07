/**
 * @param {Element} el
 * @returns {string | null}
 */
export function labBlockIdFromElement(el) {
  const g = el.closest("[id^='gate-'], [id^='led-'], [id^='source-'], [id^='macro-'], .lab-jk-hit");
  if (!g) return null;
  if (g.classList.contains("lab-jk-hit")) {
    return g.dataset.jkId || null;
  }
  const id = g.getAttribute("id") || "";
  if (id.startsWith("gate-")) return id.slice(5);
  if (id.startsWith("led-")) return id.slice(4);
  if (id.startsWith("source-")) return id.slice(7);
  if (id.startsWith("macro-")) return id.slice(6);
  return null;
}
