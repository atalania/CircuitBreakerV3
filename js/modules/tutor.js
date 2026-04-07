// ============================================================
//  TUTOR.JS — AI via portal proxy (see aiProxyClient.js for HTTP/route changes)
// ============================================================

import { getOpenAiAssistantText, postAiProxyChatCompletion } from "./aiProxyClient.js";
import { randomFallbackChallenge, validateTruthTable } from "./endlessChallenges.js";

const DEFAULT_MODEL = "gpt-4o-mini";

const ENDLESS_SYSTEM = `You are generating a digital-logic BUILD challenge for a circuit-lab sandbox.
Output ONLY valid JSON (no markdown fences, no commentary). Schema:
{"title":"SHORT TITLE","objective":"1-2 sentences: player uses draggable pins A,B,C and LED F, wires AND/OR/NOT (and optionally XOR/NAND/NOR) gates.","table":{"000":{"F":0},"001":{"F":1},"010":{"F":0},"011":{"F":1},"100":{"F":0},"101":{"F":1},"110":{"F":0},"111":{"F":1}}}
Rules: table must include all eight 3-bit keys. Each F is 0 or 1. Do not make F constant on every row. Prefer interesting but buildable functions (majority, mux, parity, etc.).`;

async function callTutorApi(payload) {
  /** @type {{ role: string, content: string }[]} */
  const messages = [];
  if (typeof payload.system === "string" && payload.system.length > 0) {
    messages.push({ role: "system", content: payload.system.slice(0, 200_000) });
  }
  const hist = Array.isArray(payload.messages) ? payload.messages : [];
  for (const m of hist) {
    if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content });
    }
  }

  const model = (import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL).trim();

  const data = await postAiProxyChatCompletion({
    model,
    messages,
    max_tokens: 1024,
  });

  const text = getOpenAiAssistantText(data);
  if (!text) {
    throw new Error("Empty response from AI");
  }

  return text;
}

export class AITutor {
  constructor() {
    this.conversationHistory = [];
    this.isThinking = false;
    this.onMessage = null;
    this.onThinkingChange = null;
    this.currentLevelContext = "";
  }

  setLevelContext(context) {
    this.currentLevelContext = context;
    this.conversationHistory = [];
  }

  async getHint(gameState, playerAction = "") {
    if (this.isThinking) return;
    this._setThinking(true);

    const systemPrompt = `You are the player's ordnance briefing officer in a bomb-defusal digital logic trainer. You're encouraging, tactical, and educational. Guide them through circuit "charges" (puzzles). Be concise (2-3 sentences max), use progressive hints — never give the answer directly. Lean into light bomb/EOD flavor (fuse, detonator, disarm) without being graphic. Reference specific inputs/outputs by their labels (A, B, Q, etc.).

Current puzzle context:
${this.currentLevelContext}

Current game state:
${JSON.stringify(gameState, null, 2)}
${playerAction ? `\nStudent's last action: ${playerAction}` : ""}`;

    const userMessage = playerAction
      ? `I just ${playerAction}. What should I do next?`
      : "Can you give me a hint for this puzzle?";

    this.conversationHistory.push({ role: "user", content: userMessage });

    try {
      const text = await callTutorApi({
        system: systemPrompt,
        messages: this.conversationHistory.slice(-6),
      });

      this.conversationHistory.push({ role: "assistant", content: text });
      this._setThinking(false);

      if (this.onMessage) this.onMessage(text, "tutor");
      return text;
    } catch (err) {
      console.error("Tutor API error:", err);
      this._setThinking(false);
      const fallback = this._getFallbackHint(gameState, err);
      if (this.onMessage) this.onMessage(fallback, "tutor");
      return fallback;
    }
  }

  async getIntroMessage() {
    this._setThinking(true);
    try {
      const text = await callTutorApi({
        messages: [
          {
            role: "user",
            content: `You are the ordnance briefing officer in a bomb-defusal logic game. Give a brief (2-3 sentence) intro to this live "charge" / puzzle. Be dramatic but educational; mention disarming or the ticking fuse if it fits. Context: ${this.currentLevelContext}`,
          },
        ],
      });

      this._setThinking(false);
      if (this.onMessage) this.onMessage(text, "tutor");
      return text;
    } catch (err) {
      console.error("Tutor intro error:", err);
      this._setThinking(false);
      const intro = this._getDefaultIntro(err);
      if (this.onMessage) this.onMessage(intro, "tutor");
      return intro;
    }
  }

  _getDefaultIntro(err) {
    if (err instanceof Error && (err.message.includes("OPENAI_API_KEY") || err.message.includes("not set"))) {
      return "I'm offline until OpenAI is configured (this game repo: .env.local + OPENAI_API_KEY, or the web portal's AI proxy). Until then, study the objective and truth tables — you've got this.";
    }
    return "Sapper, this charge is live — study the detonation chain, toggle the inputs, and find the combo that disarms it before the fuse burns through. Shout if you need intel.";
  }

  _getFallbackHint(gameState, err) {
    if (err instanceof Error) {
      const m = err.message;
      if (m.includes("OPENAI_API_KEY") || m.includes("not set")) {
        return "Tutor needs an API key: add OPENAI_API_KEY to .env.local here, or use the portal embed so /api/ai/openai is provided.";
      }
      if (m.length < 200) {
        return `I can't reach the AI right now (${m}). Try a built-in hint: work backwards from the output you need, or toggle one input at a time.`;
      }
    }
    const hints = [
      "Look carefully at the gate type — what output would it produce for your current inputs?",
      "Try working backwards from the desired output. What inputs would produce that result?",
      "Remember: AND gates need ALL inputs high. OR gates need ANY input high.",
      "Think about the truth table for this gate. Which rows give you a 1 output?",
      "Try flipping one input at a time and observe how the output changes.",
    ];
    return hints[Math.floor(Math.random() * hints.length)];
  }

  _setThinking(val) {
    this.isThinking = val;
    if (this.onThinkingChange) this.onThinkingChange(val);
  }

  reset() {
    this.conversationHistory = [];
    this.currentLevelContext = "";
    this.isThinking = false;
  }

  /**
   * Ask the model for a new endless-mode truth table + copy.
   * @returns {Promise<{ title: string, objective: string, table: Record<string, { F: number }> }>}
   */
  async fetchEndlessChallenge() {
    this._setThinking(true);
    try {
      const text = await callTutorApi({
        system: ENDLESS_SYSTEM,
        messages: [
          {
            role: "user",
            content: "Issue the next endless practice challenge as JSON now.",
          },
        ],
      });

      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("No JSON object in response");

      const raw = JSON.parse(text.slice(start, end + 1));
      const title = typeof raw.title === "string" ? raw.title.trim() : "AI CHARGE";
      const objective = typeof raw.objective === "string" ? raw.objective.trim() : "Match the hidden truth table with pins A,B,C and LED F.";
      const table = raw.table && typeof raw.table === "object" ? raw.table : null;

      if (!validateTruthTable(table)) throw new Error("Invalid or incomplete truth table");

      this._setThinking(false);
      return { title, objective, table };
    } catch (err) {
      console.error("Endless objective error:", err);
      this._setThinking(false);
      const fb = randomFallbackChallenge();
      if (this.onMessage) {
        const reason = err instanceof Error ? err.message : "fallback";
        this.onMessage(`Using a built-in challenge (${reason}). You can still play normally.`, "tutor");
      }
      return { title: fb.title, objective: fb.objective, table: fb.table };
    }
  }
}
