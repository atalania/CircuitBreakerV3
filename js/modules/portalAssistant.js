// ============================================================
//  PORTAL ASSISTANT — STEM wiki Laurie/Livvy bridge (iframe postMessage)
//  Contract: type "ASSISTANT_GAME_EVENT", payload matches GameEvent.
// ============================================================

import gameData from "../../data/game.json";

const MSG_TYPE = "ASSISTANT_GAME_EVENT";

/**
 * True when the game should notify the parent portal (embedded iframe), or when
 * VITE_PORTAL_ASSISTANT=1 forces the bridge for local testing against a parent frame.
 */
export function isPortalAssistantActive() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_PORTAL_ASSISTANT === "0") return false;
  if (import.meta.env.VITE_PORTAL_ASSISTANT === "1") return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Slug must match src/data/games.ts iframe entry on the wiki. */
export function getAssistantGameId() {
  const fromEnv = import.meta.env.VITE_ASSISTANT_GAME_ID;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const id = gameData["game-id"];
  return typeof id === "string" && id.trim() ? id.trim() : "circuit-breaker";
}

/**
 * @param {Record<string, unknown>} eventData GameEvent fields; gameId defaults from game.json / env.
 */
export function sendAssistantGameEvent(eventData) {
  if (!isPortalAssistantActive()) return;
  if (!eventData || typeof eventData !== "object") return;

  const gameId = getAssistantGameId();
  const payload = {
    gameId,
    levelId: "menu",
    eventType: "level_start",
    targetConcept: "digital_logic",
    hintCount: 0,
    timeSpentSeconds: 0,
    ...eventData,
    gameId: typeof eventData.gameId === "string" && eventData.gameId.trim() ? eventData.gameId.trim() : gameId,
  };

  try {
    window.parent.postMessage({ type: MSG_TYPE, payload }, "*");
  } catch (e) {
    console.warn("[portalAssistant] postMessage failed:", e);
  }
}
