# Mobile & iframe — Circuit Breaker notes (portal embed)

This game is built for **STEM Games** at `/games/circuit-breaker` inside an **iframe**. The portal sets iframe **CSS height** from `embedHeight` in `data/game.json` (ported into the portal’s `games.ts`). This document tracks what **this repo** does to behave in that embed.

**Portal source of truth** (other repository): `resolveEmbedHeights` in `src/lib/games/embed-height.ts`. **`circuit-breaker`** may have special-case heights there.

---

## Assumptions (from the portal)

| Context | Effect on the game |
|--------|---------------------|
| **Not full viewport** | `100vh` / `100dvh` in **this** CSS refers to the **browser tab**, not the iframe. Using them as the **only** height for the game can **overflow** the iframe or cause **double scroll** with the portal page. |
| **Mobile** | Iframe height is something like `calc(100dvh - ~200px)` for chrome/toolbars; exact rules depend on embed height + slug. |

**We avoid** sizing root screens with `100dvh` / `100vh` alone. Shell uses **`html, body, .screen { height: 100% }`** and flex with **`min-height: 0`** so the game fits the **iframe slot** height set by the portal.

---

## What this repo implements

| Item | Where |
|------|--------|
| Viewport meta | `index.html` — `width=device-width`, `initial-scale=1`, `viewport-fit=cover`, `maximum-scale=5` |
| `%` height shell | `css/base.css` — `html, body` fill parent; `.screen` uses `inset: 0` + `height: 100%` |
| No iframe-breaking `dvh` for main game shell | `css/responsive.css` — `#menu-screen` / `#game-screen` use `height: 100%`, not `100dvh` |
| `visualViewport` sync | `js/modules/embedViewport.js` — forwards iframe chrome show/hide to existing `window` `resize` listeners |
| Scroll vs drag | `.circuit-panel` uses `touch-action: pan-y` for vertical stack scroll; `.circuit-viewport` uses `touch-action: pan-x pan-y` for panning the large SVG |
| HTML5 drag from palette | Unreliable on touch — **tap-to-place** path when `(pointer: coarse)` or `(max-width: 900px)` in `js/app/lab/LabToolbar.js` |
| Pointer-based lab moves | `js/app/lab/LabCanvasController.js` — `setPointerCapture` for wires/blocks |

---

## Portal `data` hint (`data/game.json`)

- **`embedHeight`** — `"760px"` is the current desktop-oriented minimum; adjust after testing in the **live portal** iframe (not only standalone `npm run dev`).
- Do not rely on **`100vh`** strings for embed: the portal may rewrite them, but **this game** still must size with **percentage** + container flex.

---

## Verification checklist (maintainers)

- [ ] Open **`/games/circuit-breaker`** on a real phone (portrait + landscape).
- [ ] Confirm **one** clear scroll context (portal page **or** in-game panel, not both fighting).
- [ ] Confirm menu + level UI use the **visible** iframe area without clipping.
- [ ] Place parts: **tap chip → tap empty canvas** on touch; drag still works with mouse.
- [ ] After browser chrome shows/hides, game layout still fits (thanks to `embedViewport.js` + `%` heights).

---

## Related

- In-repo **README** → “Portal / Mobile Iframe Checklist”.
- Full **copy-paste template** for other games lives in the **portal** repository (team wiki / `MOBILE_EMBED_GAME_GUIDE.md` there if present).
