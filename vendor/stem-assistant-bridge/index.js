/**
 * Embedded shim for stem-assistant-bridge when the portal monorepo package is not linked.
 * Matches the Web Assistant Bridge guide: ASSISTANT_GAME_EVENT payloads, helpers, and an
 * automatic first level_start when embedded (same idea as the shared package).
 */
import gameData from "../../data/game.json";

function gameIdFallback() {
  const id = gameData["game-id"];
  return typeof id === "string" && id.trim() ? id.trim() : "circuit-breaker";
}

/** @type {{ gameId: string; defaultTargetConcept: string }} */
let bridgeConfig = {
  gameId: "",
  defaultTargetConcept: "digital_logic",
};

function resolvedGameId(override) {
  if (typeof override === "string" && override.trim()) return override.trim();
  if (bridgeConfig.gameId.trim()) return bridgeConfig.gameId;
  return gameIdFallback();
}

function isEmbedded() {
  try {
    return typeof window !== "undefined" && window.parent !== window.self;
  } catch {
    return true;
  }
}

function post(payload) {
  if (typeof window === "undefined" || !window.parent || typeof window.parent.postMessage !== "function") {
    return;
  }
  window.parent.postMessage(payload, "*");
}

function emit(eventType, extra) {
  const gid =
    typeof extra.gameId === "string" && extra.gameId.trim() ? extra.gameId.trim() : resolvedGameId();
  const rest = { ...extra };
  delete rest.gameId;
  post({
    type: "ASSISTANT_GAME_EVENT",
    payload: { eventType, gameId: gid, ...rest },
  });
}

/**
 * @param {{
 *   gameId?: string,
 *   defaultTargetConcept?: string,
 *   defaultLevelId?: string,
 *   targetOrigin?: string
 * }} opts
 */
export function initStemAssistantBridge(opts = {}) {
  bridgeConfig.gameId =
    typeof opts.gameId === "string" && opts.gameId.trim() ? opts.gameId.trim() : gameIdFallback();
  bridgeConfig.defaultTargetConcept =
    typeof opts.defaultTargetConcept === "string" && opts.defaultTargetConcept.trim()
      ? opts.defaultTargetConcept.trim()
      : "digital_logic";

  post({
    type: "STEM_ASSISTANT_BRIDGE_INIT",
    payload: {
      gameId: bridgeConfig.gameId,
      defaultTargetConcept: bridgeConfig.defaultTargetConcept,
      defaultLevelId: opts.defaultLevelId,
      targetOrigin: opts.targetOrigin,
    },
  });

  if (!isEmbedded()) return;

  const levelId =
    typeof opts.defaultLevelId === "string" && opts.defaultLevelId.trim()
      ? opts.defaultLevelId.trim()
      : "level_1";

  emit("level_start", {
    levelId,
    targetConcept: bridgeConfig.defaultTargetConcept,
  });
}

export function setStemAssistantHintCount(/* _n */) {}

export function setStemAssistantLevel(/* _levelId, _concept */) {}

/**
 * Low-level emitter (portal guide §3 — unified GameEvent envelope).
 * @param {Record<string, unknown>} event
 */
export function sendStemAssistantEvent(event) {
  if (!event || typeof event !== "object") return;
  const eventType = event.eventType;
  if (typeof eventType !== "string") return;

  const copy = { ...event };
  delete copy.eventType;
  const gid = resolvedGameId(
    typeof copy.gameId === "string" ? /** @type {string} */ (copy.gameId) : undefined
  );
  delete copy.gameId;
  post({
    type: "ASSISTANT_GAME_EVENT",
    payload: { eventType, gameId: gid, ...copy },
  });
}

/** @type {Record<string, (e: Record<string, unknown>) => void>} */
export const stemAssistant = {
  levelStart: (e) => emit("level_start", e),
  incorrect: (e) => emit("incorrect_submission", e),
  correct: (e) => emit("correct_submission", e),
  hintRequest: (e) => emit("hint_request", e),
  levelComplete: (e) => emit("level_complete", e),
  timeout: (e) => emit("timeout", e),
  recapRequest: (e) => emit("recap_request", e),
};
