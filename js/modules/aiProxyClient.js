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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {}),
    },
    body: JSON.stringify(body),
    ...restFetch,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* ignore */
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
