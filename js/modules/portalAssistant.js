// ============================================================
//  PORTAL ASSISTANT — thin adapter over stem-assistant-bridge
// ============================================================

import gameData from "../../data/game.json";
import {
  initStemAssistantBridge,
  setStemAssistantHintCount,
  setStemAssistantLevel,
  stemAssistant,
} from "stem-assistant-bridge";

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
}

/**
 * @param {Record<string, unknown>} eventData GameEvent fields; gameId defaults from game.json / env.
 */
export function sendAssistantGameEvent(eventData) {
  if (!eventData || typeof eventData !== "object") return;

  const payload = { ...eventData };
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
