import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let aiProxy;

async function loadAiProxy() {
  vi.resetModules();
  aiProxy = await import("./aiProxyClient.js");
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_AI_MIN_REQUEST_INTERVAL_MS", "1");
  vi.stubEnv("VITE_AI_RATE_LIMIT_RETRIES", "0");
  await loadAiProxy();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getOpenAiAssistantText", () => {
  it("returns trimmed assistant content when present", () => {
    const data = {
      choices: [{ message: { content: "  hello  " } }],
    };
    expect(aiProxy.getOpenAiAssistantText(data)).toBe("hello");
  });

  it("returns empty string when content is missing or not a string", () => {
    expect(aiProxy.getOpenAiAssistantText({})).toBe("");
    expect(aiProxy.getOpenAiAssistantText({ choices: [] })).toBe("");
    expect(aiProxy.getOpenAiAssistantText({ choices: [{ message: {} }] })).toBe("");
    expect(aiProxy.getOpenAiAssistantText({ choices: [{ message: { content: 42 } }] })).toBe("");
  });
});

describe("resolveAiProxyUrl", () => {
  it("defaults to /api/ai/openai when VITE_AI_PROXY_URL is unset", () => {
    expect(aiProxy.resolveAiProxyUrl()).toBe("/api/ai/openai");
  });

  it("uses VITE_AI_PROXY_URL trimmed with trailing slashes removed", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_AI_MIN_REQUEST_INTERVAL_MS", "1");
    vi.stubEnv("VITE_AI_RATE_LIMIT_RETRIES", "0");
    vi.stubEnv("VITE_AI_PROXY_URL", "  https://portal.test/chat///  ");
    await loadAiProxy();
    expect(aiProxy.resolveAiProxyUrl()).toBe("https://portal.test/chat");
  });
});

describe("postAiProxyChatCompletion", () => {
  it("POSTs JSON to the resolved URL and returns the parsed body on 200", async () => {
    const body = { model: "m", messages: [{ role: "user", content: "hi" }] };
    const upstream = { choices: [{ message: { content: "ok" } }] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => upstream,
    });

    const data = await aiProxy.postAiProxyChatCompletion(body);

    expect(data).toEqual(upstream);
    expect(fetch).toHaveBeenCalledWith(
      "/api/ai/openai",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      })
    );
  });

  it("throws with error.message from JSON on non-OK responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: { get: () => null },
      json: async () => ({ error: { message: "Invalid payload" } }),
    });

    await expect(
      aiProxy.postAiProxyChatCompletion({ model: "m", messages: [{ role: "user", content: "x" }] })
    ).rejects.toThrow("Invalid payload");
  });

  it("retries on 429 when under max retries then returns success", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_AI_MIN_REQUEST_INTERVAL_MS", "1");
    vi.stubEnv("VITE_AI_RATE_LIMIT_RETRIES", "1");
    await loadAiProxy();

    const success = { id: "done" };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: { get: () => "0" },
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => success,
      });

    const p = aiProxy.postAiProxyChatCompletion({ model: "m", messages: [{ role: "user", content: "x" }] });
    const data = await p;

    expect(data).toEqual(success);
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 10_000);
});
