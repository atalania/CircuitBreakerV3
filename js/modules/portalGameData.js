let portalOrigin = null;
const listeners = new Set();

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isPortalGameDataActive() {
  if (typeof window === "undefined") return false;
  return inIframe();
}

function post(type, payload = {}) {
  if (!inIframe()) return;
  window.parent.postMessage({ type, payload }, portalOrigin || "*");
}

export function normalizePortalGameData(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function onMessage(event) {
  const data = event?.data;
  if (!data || typeof data !== "object") return;

  if (!portalOrigin) {
    portalOrigin = event.origin;
  } else if (event.origin !== portalOrigin) {
    return;
  }

  if (data.type === "PORTAL_GAME_DATA_LOADED") {
    const payload = normalizePortalGameData(data.payload);
    listeners.forEach((fn) => fn(payload));
  }
}

export function initPortalGameDataBridge() {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export function fetchPortalGameData(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      listeners.delete(onLoaded);
      reject(new Error("Timed out waiting for PORTAL_GAME_DATA_LOADED"));
    }, timeoutMs);

    const onLoaded = (payload) => {
      window.clearTimeout(timer);
      listeners.delete(onLoaded);
      resolve(payload);
    };

    listeners.add(onLoaded);
    post("PORTAL_GAME_DATA_LOAD_REQUEST");
  });
}

export function savePortalGameData(data) {
  post("PORTAL_GAME_DATA_SAVE", normalizePortalGameData(data));
}

export function mergeAndSavePortalGameData(currentData, patch) {
  const next = { ...normalizePortalGameData(currentData), ...normalizePortalGameData(patch) };
  savePortalGameData(next);
  return next;
}

export function updateHighScore(currentData, runScore, scoreMeta = {}) {
  const data = normalizePortalGameData(currentData);
  const prev = Math.max(Number(data.highScore ?? 0), Number(data.score ?? 0));
  const score = Number(runScore);
  if (!Number.isFinite(score)) return data;
  if (score <= prev) return data;
  const next = {
    ...data,
    highScore: score,
    score,
    scoreMeta: normalizePortalGameData(scoreMeta),
  };
  savePortalGameData(next);
  return next;
}

/** Hub + game agree on this shape for per-level campaign and endless separation. */
export const SCORES_VERSION = 2;

/**
 * Merge root `campaignBests` with `circuitBreaker.campaignBests` (root wins on key clash).
 * @param {Record<string, unknown>} data
 */
function mergeCampaignBestsMaps(data) {
  const nested = normalizePortalGameData(data.circuitBreaker?.campaignBests);
  const root = normalizePortalGameData(data.campaignBests);
  return { ...nested, ...root };
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} key
 */
function _prevCampaignSpeedBest(data, key) {
  const merged = normalizePortalGameData(mergeCampaignBestsMaps(data)[key]);
  return Math.max(
    Number(merged.speedScore ?? merged.highScore ?? merged.score ?? 0),
    0
  );
}

/**
 * Per-level campaign best (higher speedScore = better). Mirrors under `circuitBreaker` for hub path lists.
 * @param {unknown} currentData
 * @param {number | string} levelId
 * @param {{ speedScore: number, elapsedMs: number, diffusalScore?: number, hintsUsed?: number, scoreMeta?: Record<string, unknown> }} payload
 */
export function updateCampaignLevelBest(currentData, levelId, payload) {
  const data = normalizePortalGameData(currentData);
  const key = String(levelId);
  const speedScore = Number(payload.speedScore);
  if (!Number.isFinite(speedScore)) return data;

  const prevSpeed = _prevCampaignSpeedBest(data, key);
  if (speedScore <= prevSpeed) return data;

  const entry = {
    speedScore,
    elapsedMs: Math.max(0, Math.floor(Number(payload.elapsedMs) || 0)),
    diffusalScore: Math.max(0, Math.floor(Number(payload.diffusalScore) || 0)),
    ...(payload.hintsUsed != null ? { hintsUsed: Math.max(0, Math.floor(Number(payload.hintsUsed))) } : {}),
    at: typeof payload.at === "string" ? payload.at : new Date().toISOString(),
  };

  const mergedBests = mergeCampaignBestsMaps(data);
  const campaignBests = { ...mergedBests, [key]: entry };

  const cbRoot = normalizePortalGameData(data.circuitBreaker);
  const circuitBreaker = {
    ...cbRoot,
    campaignBests: { ...mergedBests, [key]: entry },
  };

  const next = {
    ...data,
    scoresVersion: SCORES_VERSION,
    campaignBests,
    circuitBreaker,
    scoreMeta: normalizePortalGameData(payload.scoreMeta ?? {}),
  };
  savePortalGameData(next);
  return next;
}

/**
 * Endless cumulative best. Mirrors under `circuitBreaker.endlessBest` for hub path lists.
 * Also bumps top-level `highScore` / `score` when this run beats prior endless (backward compat for single-number readers).
 * @param {unknown} currentData
 * @param {number} engineScore
 * @param {Record<string, unknown>} [scoreMeta]
 */
export function updateEndlessBest(currentData, engineScore, scoreMeta = {}) {
  const data = normalizePortalGameData(currentData);
  const score = Number(engineScore);
  if (!Number.isFinite(score)) return data;

  const prevEndless = Math.max(
    Number(data.endlessBest?.score ?? 0),
    Number(data.circuitBreaker?.endlessBest?.score ?? 0)
  );
  if (score <= prevEndless) return data;

  const endlessEntry = {
    ...normalizePortalGameData(scoreMeta),
    score,
    at: new Date().toISOString(),
  };

  const cbRoot = normalizePortalGameData(data.circuitBreaker);
  const next = {
    ...data,
    scoresVersion: SCORES_VERSION,
    endlessBest: endlessEntry,
    circuitBreaker: {
      ...cbRoot,
      endlessBest: endlessEntry,
    },
    highScore: Math.max(Number(data.highScore ?? 0), score),
    score: Math.max(Number(data.score ?? 0), score),
    scoreMeta: normalizePortalGameData(scoreMeta),
  };
  savePortalGameData(next);
  return next;
}

/**
 * Convert solve time (lower is better) into leaderboard score (higher is better).
 * Keeps values positive and comparable across submissions.
 * @param {number} elapsedMs
 */
export function speedScoreFromElapsedMs(elapsedMs) {
  const ms = Number(elapsedMs);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.max(0, 3_600_000 - Math.floor(ms));
}
