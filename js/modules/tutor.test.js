import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
  postAiProxyChatCompletion: vi.fn(),
  getOpenAiAssistantText: vi.fn(),
}));

vi.mock("./aiProxyClient.js", () => aiMocks);

import { AITutor } from "./tutor.js";

describe("AITutor", () => {
  beforeEach(() => {
    aiMocks.postAiProxyChatCompletion.mockReset();
    aiMocks.getOpenAiAssistantText.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("setLevelContext resets conversation", () => {
    const t = new AITutor();
    t.conversationHistory.push({ role: "user", content: "x" });
    t.setLevelContext("lvl");
    expect(t.currentLevelContext).toBe("lvl");
    expect(t.conversationHistory.length).toBe(0);
  });

  it("getHint calls onMessage with assistant text on success", async () => {
    aiMocks.postAiProxyChatCompletion.mockResolvedValue({});
    aiMocks.getOpenAiAssistantText.mockReturnValue("  hint text  ");
    const t = new AITutor();
    t.setLevelContext("puzzle");
    const onMessage = vi.fn();
    t.onMessage = onMessage;
    const out = await t.getHint({ level: 1 }, "placed an AND gate");
    expect(out.trim()).toBe("hint text");
    expect(onMessage).toHaveBeenCalledWith("  hint text  ", "tutor");
    expect(t.isThinking).toBe(false);
  });

  it("getHint uses fallback when API throws", async () => {
    aiMocks.postAiProxyChatCompletion.mockRejectedValue(new Error("network down"));
    const t = new AITutor();
    t.setLevelContext("puzzle");
    const onMessage = vi.fn();
    t.onMessage = onMessage;
    vi.spyOn(Math, "random").mockReturnValue(0);
    const out = await t.getHint({ x: 1 });
    expect(out).toMatch(/built-in hint|AI right now/i);
    expect(onMessage).toHaveBeenCalled();
  });

  it("getIntroMessage falls back when assistant returns empty text", async () => {
    aiMocks.postAiProxyChatCompletion.mockResolvedValue({});
    aiMocks.getOpenAiAssistantText.mockReturnValue("");
    const t = new AITutor();
    t.setLevelContext("intro ctx");
    const onMessage = vi.fn();
    t.onMessage = onMessage;
    const intro = await t.getIntroMessage();
    expect(intro.length).toBeGreaterThan(10);
    expect(onMessage).toHaveBeenCalled();
  });

  it("getIntroMessage uses default intro when API errors with key message", async () => {
    aiMocks.postAiProxyChatCompletion.mockRejectedValue(new Error("OPENAI_API_KEY is not set"));
    const t = new AITutor();
    const onMessage = vi.fn();
    t.onMessage = onMessage;
    const intro = await t.getIntroMessage();
    expect(intro).toContain("offline");
    expect(onMessage).toHaveBeenCalled();
  });

  it("fetchEndlessChallenge parses JSON object from model text", async () => {
    const table = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          table[`${a}${b}${c}`] = { F: (a ^ b ^ c) & 1 };
        }
      }
    }
    const json = JSON.stringify({
      title: "T",
      objective: "O",
      table,
    });
    aiMocks.postAiProxyChatCompletion.mockResolvedValue({});
    aiMocks.getOpenAiAssistantText.mockReturnValue(`prefix ${json} suffix`);
    const t = new AITutor();
    const res = await t.fetchEndlessChallenge();
    expect(res.title).toBe("T");
    expect(res.objective).toBe("O");
    expect(Object.keys(res.table).length).toBe(8);
  });

  it("fetchEndlessChallenge falls back when JSON invalid", async () => {
    aiMocks.postAiProxyChatCompletion.mockResolvedValue({});
    aiMocks.getOpenAiAssistantText.mockReturnValue("not json");
    const t = new AITutor();
    const onMessage = vi.fn();
    t.onMessage = onMessage;
    const res = await t.fetchEndlessChallenge();
    expect(res.title).toBeTruthy();
    expect(onMessage).toHaveBeenCalled();
  });

  it("reset clears history and context", () => {
    const t = new AITutor();
    t.conversationHistory.push({ role: "user", content: "x" });
    t.currentLevelContext = "c";
    t.isThinking = true;
    t.reset();
    expect(t.conversationHistory.length).toBe(0);
    expect(t.currentLevelContext).toBe("");
    expect(t.isThinking).toBe(false);
  });
});
