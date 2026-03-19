// ============================================================
//  TUTOR.JS — AI tutor powered by Claude API
// ============================================================

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

    const systemPrompt = `You are Professor Circuit, an encouraging AI tutor inside a bomb-defusal game that teaches digital logic to undergraduate students. You're guiding a student through circuit puzzles. Be concise (2-3 sentences max), use encouraging language, and give progressive hints — never give the answer directly. Use analogies when helpful. If the student is stuck, ask a guiding question. Reference specific inputs/outputs by their labels (A, B, Q, etc.).

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
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: this.conversationHistory.slice(-6), // Keep context window small
        }),
      });

      const data = await response.json();
      const text = data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n") || "Hmm, I'm having trouble thinking right now. Try toggling some switches!";

      this.conversationHistory.push({ role: "assistant", content: text });
      this._setThinking(false);

      if (this.onMessage) this.onMessage(text, "tutor");
      return text;
    } catch (err) {
      console.error("Tutor API error:", err);
      this._setThinking(false);
      const fallback = this._getFallbackHint(gameState);
      if (this.onMessage) this.onMessage(fallback, "tutor");
      return fallback;
    }
  }

  async getIntroMessage() {
    this._setThinking(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are Professor Circuit, a fun encouraging AI tutor in a bomb-defusal digital logic game. Give a brief (2-3 sentence) intro to this puzzle. Be dramatic but educational. Context: ${this.currentLevelContext}`,
            },
          ],
        }),
      });
      const data = await response.json();
      const text = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n") || this._getDefaultIntro();
      this._setThinking(false);
      if (this.onMessage) this.onMessage(text, "tutor");
      return text;
    } catch {
      this._setThinking(false);
      const intro = this._getDefaultIntro();
      if (this.onMessage) this.onMessage(intro, "tutor");
      return intro;
    }
  }

  _getDefaultIntro() {
    return "Alright, recruit — this module is live. Study the circuit, toggle the inputs, and find the right combination before time runs out. I'll be here if you need a nudge!";
  }

  _getFallbackHint(gameState) {
    const hints = [
      "Look carefully at the gate type — what output would it produce for your current inputs?",
      "Try working backwards from the desired output. What inputs would produce that result?",
      "Remember: AND gates need ALL inputs high. OR gates need ANY input high.",
      "Think about the truth table for this gate. Which rows give you a 1 output?",
      "Try flipping one switch at a time and observe how the output changes.",
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
}
