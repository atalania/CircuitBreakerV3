// ============================================================
// Vite — portal base path + local /api/ai/openai (OpenAI key server-side)
// When PORTAL_DEV=1 in .env.local, /api proxies to the portal (localhost:3000).
// ============================================================

import { defineConfig, loadEnv } from "vite";
import gameData from "./data/game.json";

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

const GAME_BASE = `/staticGames/${gameData["game-id"]}/`;

/**
 * Same contract as the portal: POST /api/ai/openai with { model, messages, max_tokens?, temperature? }.
 * Returns the upstream OpenAI JSON body on success.
 *
 * @param {Record<string, string>} env from loadEnv
 */
function localOpenAiMiddleware(env) {
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/api/ai/openai" || req.method !== "POST") {
      next();
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
