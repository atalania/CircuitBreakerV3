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

export function updateHighScore(currentData, runScore) {
  const data = normalizePortalGameData(currentData);
  const prev = Number(data.highScore ?? 0);
  const score = Number(runScore);
  if (!Number.isFinite(score)) return data;
  if (score <= prev) return data;
  const next = { ...data, highScore: score };
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
