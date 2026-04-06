// ============================================================
// Vite — dev/preview API for AI tutor (OpenAI key stays server-side)
// ============================================================

import { defineConfig, loadEnv } from "vite";

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
 * @param {Record<string, string>} env from loadEnv
 */
function tutorApiMiddleware(env) {
  return async (req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/api/tutor" || req.method !== "POST") {
      next();
      return;
    }

    const apiKey = env.OPENAI_API_KEY || "";
    if (!apiKey.trim()) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            "OPENAI_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart the dev server.",
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
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const model = (env.OPENAI_MODEL || "gpt-4o-mini").trim();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20);

    if (safeMessages.length === 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "messages[] required" }));
      return;
    }

    /** @type {{ role: string, content: string }[]} */
    const openaiMessages = [];
    if (typeof body.system === "string" && body.system.length > 0) {
      openaiMessages.push({ role: "system", content: body.system.slice(0, 200_000) });
    }
    for (const m of safeMessages) {
      openaiMessages.push({ role: m.role, content: m.content });
    }

    const payload = {
      model,
      max_tokens: 1024,
      messages: openaiMessages,
    };

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

      if (!upstream.ok) {
        const msg =
          (typeof data?.error?.message === "string" && data.error.message) ||
          (typeof data?.error === "string" && data.error) ||
          `OpenAI API error (${upstream.status})`;
        res.statusCode = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: msg }));
        return;
      }

      const text = data.choices?.[0]?.message?.content?.trim() || "";

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ text }));
    } catch (e) {
      console.error("[tutor api]", e);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Upstream request failed" }));
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const mountTutor = (server) => {
    server.middlewares.use(tutorApiMiddleware(env));
  };

  return {
    plugins: [
      {
        name: "circuit-tutor-api",
        configureServer(server) {
          mountTutor(server);
        },
        configurePreviewServer(server) {
          mountTutor(server);
        },
      },
    ],
  };
});
