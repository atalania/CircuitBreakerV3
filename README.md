## CIRCUIT BREAKER💣 — Bomb Defusal Logic Trainer

Circuit Breaker is a browser-based **digital logic bomb-defusal trainer**.  
Each "live charge" is a self-contained circuit lab: drag gates and wires, reason about truth tables, and find the input pattern that disarms the bomb before the fuse burns down.

The game runs as a small Vite app and ships with:
- **5 campaign levels** that teach gate basics, truth tables, SR latches, JK flip-flops, and a final boolean logic gauntlet.
- An **Endless (AI)** lab mode that can pull fresh practice objectives from an OpenAI model (optional).
- An in-game **ordnance officer tutor** that can explain puzzles, give progressive hints, and generate new challenges when AI is configured.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (bundled with Node)

### Install dependencies

In the `CircuitGameVer2` directory:

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

Then open the URL printed in the terminal (usually `http://localhost:5173/`) in your browser.

### Build for production

```bash
npm run build
```

Preview the built bundle with:

```bash
npm run preview
```

---

## Portal / Mobile Iframe Checklist

- [x] Viewport meta: `width=device-width`, `initial-scale=1`, `viewport-fit=cover`
- [x] Root layout: `html, body, .screen { height: 100%; width: 100% }` so the game fills the iframe slot instead of sizing itself from top-level `100vh`
- [x] Touch: primary controls use mobile breakpoints with at least 44px tap targets where practical
- [x] Safe area: mobile controls include `env(safe-area-inset-bottom)` padding where they sit near the bottom edge
- [ ] Test: `/games/circuit-breaker` on a real phone in portrait and landscape
- [ ] Test: "Open in new tab" from the portal toolbar at small widths
- [x] `embedHeight` in `data/game.json` is set to the tested desktop minimum height

---

## Gameplay Overview

- **Menu**
  - Choose from campaign levels **01–05** or the **Endless (AI)** circuit lab.
  - Hit **"ARM DEFUSAL RUN"** to jump into the selected charge.

- **HUD**
  - **Level panel**: shows the current live charge and title.
  - **Detonation fuse**: timer display and fuse bar; solve before it hits zero.
  - **Diffusal score**: go for clean, fast clears.
  - **Sound / Menu** buttons: toggle audio or return to the main menu.

- **Circuit panel**
  - The **objective bar** explains the current disarm condition.
  - The **circuit viewport** hosts your gates, inputs, outputs, and wires.
  - **Actions**:
    - `DISARM`: submit your current configuration and check if the bomb is safe.
    - `↺ REWIND FUSE`: reset timing / sequence as designed per level.
    - `BOMB INTEL`: ask the tutor for a hint.

- **Tutor / Chat panel**
  - Type questions into the chat input (e.g. *"What does a JK flip-flop do here?"*).
  - The ordnance officer replies with short, progressive hints, tying concepts back to the current circuit.

---

## Optional AI Features

The AI-driven tutor and Endless mode use an OpenAI-compatible API via `aiProxyClient.js`.  
You can either:

- Configure a **local OpenAI key** in this repo, or
- Run the game **embedded inside a portal** that provides the `/api/ai/openai` proxy.

### Local OpenAI configuration

1. Copy `.env.example` to `.env.local` in the project root.
2. Set your key:

   ```bash
   OPENAI_API_KEY=sk-...
   ```

3. (Optional) Adjust models / proxy:
   - `OPENAI_MODEL` — server-side model, e.g. `gpt-4o-mini`, `gpt-4o`.
   - `VITE_OPENAI_MODEL` — model name sent from the browser to the proxy.
   - `VITE_AI_PROXY_URL` — override the AI proxy route (default is `/api/ai/openai`).

4. Restart `npm run dev` (or `npm run preview`) after editing `.env.local`.

If the key or proxy is not configured, the tutor will automatically fall back to:
- Pre-written intros and hints, and
- Built-in endless challenges (no network required).

---

## Project Structure (High Level)

- `index.html` — main HTML shell, menu, HUD, and layout containers.
- `js/app.js` and `js/app/**/*.js` — core game logic, level overlays, lab tools.
- `js/levels/` — scripted level definitions and objectives.
- `js/modules/`
  - `tutor.js` — AI tutor logic and endless challenge generation.
  - `aiProxyClient.js` — HTTP client for the AI proxy endpoint.
  - `audio.js`, `ui.js`, `circuits.js`, etc. — supporting modules.
- `css/` — main styling and base resets/variables.
- `.env.example` — environment variables template for AI features.

---

## Notes for Contributors

- This repo uses **Vite** (see `package.json`) with a minimal dev setup.
- Keep `.env.local` **out of version control**; never commit real API keys.
<div align="center">
