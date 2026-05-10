// ============================================================
// Vite — portal base path + local /api/ai/openai (OpenAI key server-side)
// When PORTAL_DEV=1 in .env.local, /api proxies to the portal (localhost:3000).
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import gameData from "./data/game.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {import("http").IncomingMessage} req
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/**
 * Simple in-memory sliding-window rate limiter (dev server / preview only).
 * Key it by client IP to avoid accidental rapid-fire API calls.
 *
 * @param {{ windowMs: number, max: number, maxInFlight: number }} opts
 */
function createRateLimiter(opts) {
  const windowMs = Math.max(250, opts.windowMs | 0);
  const max = Math.max(1, opts.max | 0);
  const maxInFlight = Math.max(1, opts.maxInFlight | 0);

  /** @type {Map<string, number[]>} */
  const hits = new Map();
  /** @type {Map<string, number>} */
  const inFlight = new Map();

  function prune(now, arr) {
    const cutoff = now - windowMs;
    let i = 0;
    while (i < arr.length && arr[i] <= cutoff) i++;
    if (i > 0) arr.splice(0, i);
  }

  return {
    /**
     * @param {string} key
     * @returns {{ ok: true, release: () => void } | { ok: false, retryAfterMs: number }}
     */
    acquire(key) {
      const now = Date.now();
      const arr = hits.get(key) || [];
      prune(now, arr);

      const inflightCount = inFlight.get(key) || 0;
      if (inflightCount >= maxInFlight) {
        return { ok: false, retryAfterMs: 1000 };
      }

      if (arr.length >= max) {
        const earliest = arr[0] || now;
        const retryAfterMs = Math.max(250, windowMs - (now - earliest));
        hits.set(key, arr);
        return { ok: false, retryAfterMs };
      }

      arr.push(now);
      hits.set(key, arr);
      inFlight.set(key, inflightCount + 1);

      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          const cur = inFlight.get(key) || 0;
          if (cur <= 1) inFlight.delete(key);
          else inFlight.set(key, cur - 1);
        },
      };
    },
  };
}

const GAME_BASE = `/staticGames/${gameData["game-id"]}/`;

/**
 * Same contract as the portal: POST /api/ai/openai with { model, messages, max_tokens?, temperature? }.
 * Returns the upstream OpenAI JSON body on success.
 *
 * @param {Record<string, string>} env from loadEnv
 */
function localOpenAiMiddleware(env) {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: Number(env.AI_RATE_LIMIT_PER_MINUTE) > 0 ? Number(env.AI_RATE_LIMIT_PER_MINUTE) : 12,
    maxInFlight: Number(env.AI_RATE_LIMIT_IN_FLIGHT) > 0 ? Number(env.AI_RATE_LIMIT_IN_FLIGHT) : 2,
  });

  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/api/ai/openai" || req.method !== "POST") {
      next();
      return;
    }

    const ip =
      (req.headers["x-forwarded-for"] &&
        String(req.headers["x-forwarded-for"]).split(",")[0].trim()) ||
      req.socket?.remoteAddress ||
      "unknown";

    const lease = limiter.acquire(ip);
    if (!lease.ok) {
      const seconds = Math.max(1, Math.ceil(lease.retryAfterMs / 1000));
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Retry-After", String(seconds));
      res.end(
        JSON.stringify({
          error: {
            message: `Rate limit exceeded. Try again in ${seconds}s.`,
          },
        })
      );
      return;
    }

    const apiKey = env.OPENAI_API_KEY || "";
    if (!apiKey.trim()) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: {
            message:
              "OPENAI_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart the dev server — or run the portal with PORTAL_DEV=1.",
          },
        })
      );
      lease.release();
      return;
    }

    let body;
    try {
      const raw = await readRequestBody(req);
      body = JSON.parse(raw || "{}");
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Invalid JSON body" } }));
      lease.release();
      return;
    }

    const model = String(body.model || env.OPENAI_MODEL || "gpt-4o-mini").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const allowed = new Set(["system", "user", "assistant"]);
    const safeMessages = messages
      .filter((m) => m && allowed.has(m.role) && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 200_000) }))
      .slice(-30);

    if (safeMessages.length === 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "messages[] required" } }));
      lease.release();
      return;
    }

    const maxTok = Number(body.max_tokens);
    const payload = {
      model,
      messages: safeMessages,
      max_tokens: Number.isFinite(maxTok) ? Math.min(Math.max(maxTok, 1), 4096) : 1024,
    };
    if (body.temperature !== undefined && body.temperature !== null) {
      payload.temperature = Number(body.temperature);
    }

    try {
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await upstream.json();
      res.statusCode = upstream.status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    } catch (e) {
      console.error("[api/ai/openai]", e);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: { message: e instanceof Error ? e.message : "Upstream request failed" },
        })
      );
    } finally {
      lease.release();
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const usePortalProxy = env.PORTAL_DEV === "1";

  const apiProxy = {
    "/api": {
      target: "http://localhost:3000",
      changeOrigin: true,
    },
  };

  const mountLocalOpenAi = (server) => {
    server.middlewares.use(localOpenAiMiddleware(env));
  };

  return {
    base: GAME_BASE,
    plugins: usePortalProxy
      ? []
      : [
          {
            name: "circuit-local-openai",
            configureServer(server) {
              mountLocalOpenAi(server);
            },
            configurePreviewServer(server) {
              mountLocalOpenAi(server);
            },
          },
        ],
    server: {
      ...(usePortalProxy ? { proxy: apiProxy } : {}),
    },
    preview: {
      ...(usePortalProxy ? { proxy: apiProxy } : {}),
    },
  };
});
