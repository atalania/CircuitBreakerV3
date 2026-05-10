/**
 * STEM portal embed: the game runs in an iframe with a fixed CSS height. Browser
 * UI showing/hiding often fires `visualViewport` resize/scroll but not `window.resize`.
 * Bump dependent UI (media queries via JS, overlay layout) by forwarding to `resize`
 * listeners already used in the app.
 */
export function wireEmbedViewportLayout() {
  let raf = 0;
  const sync = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      window.dispatchEvent(new Event("resize"));
    });
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", sync);
  }
}
