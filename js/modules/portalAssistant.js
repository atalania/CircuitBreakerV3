// ============================================================
//  PORTAL ASSISTANT — thin adapter over stem-assistant-bridge
//  Mirrors the wiki “Web Assistant Bridge – Game Integration Guide”:
//  initStemAssistantBridge at startup + stemAssistant.* from gameplay hooks.
//  Standalone dev uses vite/vitest resolve.alias → js/vendor/stem-assistant-bridge.js;
//  portal build uses npm "stem-assistant-bridge": "file:../../packages/stem-assistant-bridge".
// ============================================================

import gameData from "../../data/game.json";
import {
  initStemAssistantBridge,
  setStemAssistantHintCount,
  setStemAssistantLevel,
  stemAssistant,
} from "stem-assistant-bridge";

let bridgeInitialized = false;

/**
 * When to forward gameplay to the wiki shell via postMessage:
 * - Default: iframe embed (portal parent differs from game window) matches the wiki bridge guide.
 * - VITE_PORTAL_ASSISTANT=1 forces on (tests, forcing events outside an iframe).
 * - VITE_PORTAL_ASSISTANT=0 forces off (quiet local standalone dev).
 */
export function isPortalAssistantActive() {
  if (typeof window === "undefined") return false;
  const flag = import.meta.env.VITE_PORTAL_ASSISTANT;
  if (flag === "0") return false;
  if (flag === "1") return true;
  try {
    return window.parent !== window.self;
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
 * Initialize shared bridge once at startup.
 */
export function initPortalAssistantBridge() {
  initStemAssistantBridge({
    gameId: getAssistantGameId(),
    defaultLevelId: "menu",
    defaultTargetConcept: "digital_logic",
    targetOrigin: "*",
  });
  bridgeInitialized = true;
}

function ensureBridgeInitialized() {
  if (bridgeInitialized) return;
  initPortalAssistantBridge();
}

/**
 * @param {Record<string, unknown>} eventData GameEvent fields; gameId defaults from game.json / env.
 */
export function sendAssistantGameEvent(eventData) {
  if (!isPortalAssistantActive()) return;
  if (!eventData || typeof eventData !== "object") return;

  ensureBridgeInitialized();

  const payload = { ...eventData };
  const resolvedGameId =
    typeof payload.gameId === "string" && payload.gameId.trim()
      ? payload.gameId.trim()
      : getAssistantGameId();

  const levelId =
    typeof payload.levelId === "string" && payload.levelId.trim()
      ? payload.levelId.trim()
      : "menu";
  const targetConcept =
    typeof payload.targetConcept === "string" && payload.targetConcept.trim()
      ? payload.targetConcept.trim()
      : "digital_logic";

  setStemAssistantLevel(levelId, targetConcept);

  if (typeof payload.hintCount === "number" && Number.isFinite(payload.hintCount)) {
    setStemAssistantHintCount(payload.hintCount);
  }

  const extra = {
    gameId: resolvedGameId,
    levelId,
    targetConcept,
    hintCount: typeof payload.hintCount === "number" ? payload.hintCount : undefined,
    timeSpentSeconds:
      typeof payload.timeSpentSeconds === "number" ? payload.timeSpentSeconds : undefined,
    playerAnswer: typeof payload.playerAnswer === "string" ? payload.playerAnswer : undefined,
    correctAnswer: typeof payload.correctAnswer === "string" ? payload.correctAnswer : undefined,
    mistakeCategory:
      typeof payload.mistakeCategory === "string" ? payload.mistakeCategory : undefined,
    additionalContext:
      payload.additionalContext && typeof payload.additionalContext === "object"
        ? payload.additionalContext
        : undefined,
  };

  switch (payload.eventType) {
    case "level_start":
      stemAssistant.levelStart(extra);
      return;
    case "incorrect_submission":
      stemAssistant.incorrect(extra);
      return;
    case "correct_submission":
      stemAssistant.correct(extra);
      return;
    case "hint_request":
      stemAssistant.hintRequest(extra);
      return;
    case "level_complete":
      stemAssistant.levelComplete(extra);
      return;
    case "timeout":
      stemAssistant.timeout(extra);
      return;
    case "recap_request":
      stemAssistant.recapRequest(extra);
      return;
    default:
      console.warn("[portalAssistant] Unsupported eventType:", payload.eventType);
  }
}
