// ============================================================
//  AI PROXY CLIENT — single place for game → portal AI HTTP calls
//  Adjust URL/headers/credentials here when the proxy contract changes.
// ============================================================

/**
 * Full URL or same-origin path to the OpenAI-compatible chat proxy.
 * Override with VITE_AI_PROXY_URL when the portal serves AI on a different route or origin.
 */
export function resolveAiProxyUrl() {
  const fromEnv = import.meta.env.VITE_AI_PROXY_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return "/api/ai/openai";
}

/**
 * @param {object} data Parsed JSON from the proxy
 * @returns {string}
 */
export function getOpenAiAssistantText(data) {
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let _nextAllowedAt = 0;

/**
 * POST OpenAI-shaped chat payload to the configured proxy.
 *
 * @param {Record<string, unknown>} body e.g. { model, messages, max_tokens, temperature? }
 * @param {RequestInit} [fetchOverrides] Optional headers, credentials, signal, etc. (merged into fetch)
 * @returns {Promise<object>} Parsed JSON body
 */
export async function postAiProxyChatCompletion(body, fetchOverrides = {}) {
  const { headers: extraHeaders, ...restFetch } = fetchOverrides;
  const url = resolveAiProxyUrl();

  const minIntervalMs =
    Number(import.meta.env.VITE_AI_MIN_REQUEST_INTERVAL_MS) > 0
      ? Number(import.meta.env.VITE_AI_MIN_REQUEST_INTERVAL_MS)
      : 750;

  const maxRetries =
    Number(import.meta.env.VITE_AI_RATE_LIMIT_RETRIES) >= 0
      ? Number(import.meta.env.VITE_AI_RATE_LIMIT_RETRIES)
      : 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const now = Date.now();
    if (_nextAllowedAt > now) {
      await sleep(_nextAllowedAt - now);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
      },
      body: JSON.stringify(body),
      ...restFetch,
    });

    _nextAllowedAt = Date.now() + minIntervalMs;

    let data = {};
    try {
      data = await response.json();
    } catch {
      /* ignore */
    }

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(250, retryAfterSeconds * 1000)
        : 1000;
      await sleep(retryAfterMs);
      continue;
    }

    if (!response.ok) {
      const err =
        (typeof data?.error?.message === "string" && data.error.message) ||
        (typeof data?.error === "string" && data.error) ||
        response.statusText ||
        "Request failed";
      throw new Error(err);
    }

    return data;
  }

  throw new Error("Request failed");
}
