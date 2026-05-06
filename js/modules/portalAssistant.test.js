import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

async function loadPortalAssistant() {
  vi.resetModules();
  return import("./portalAssistant.js");
}

describe("portalAssistant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getAssistantGameId falls back to game.json slug when env unset", async () => {
    vi.stubEnv("VITE_ASSISTANT_GAME_ID", "");
    const { getAssistantGameId } = await loadPortalAssistant();
    expect(getAssistantGameId()).toBe("circuit-breaker");
  });

  it("getAssistantGameId prefers trimmed VITE_ASSISTANT_GAME_ID", async () => {
    vi.stubEnv("VITE_ASSISTANT_GAME_ID", "  my-game  ");
    const { getAssistantGameId } = await loadPortalAssistant();
    expect(getAssistantGameId()).toBe("my-game");
  });

  it("isPortalAssistantActive is false when window is undefined", async () => {
    vi.stubGlobal("window", undefined);
    const { isPortalAssistantActive } = await loadPortalAssistant();
    expect(typeof globalThis.window).toBe("undefined");
    expect(isPortalAssistantActive()).toBe(false);
  });

  it("isPortalAssistantActive respects VITE_PORTAL_ASSISTANT=0 and =1", async () => {
    vi.stubGlobal("window", { self: {}, top: {}, parent: { postMessage: vi.fn() } });
    vi.stubEnv("VITE_PORTAL_ASSISTANT", "0");
    let m = await loadPortalAssistant();
    expect(m.isPortalAssistantActive()).toBe(false);

    vi.unstubAllEnvs();
    vi.stubGlobal("window", { self: {}, top: {}, parent: { postMessage: vi.fn() } });
    vi.stubEnv("VITE_PORTAL_ASSISTANT", "1");
    m = await loadPortalAssistant();
    expect(m.isPortalAssistantActive()).toBe(true);
  });

  it("sendAssistantGameEvent posts ASSISTANT_GAME_EVENT when active", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", { self: {}, top: {}, parent: { postMessage } });
    vi.stubEnv("VITE_PORTAL_ASSISTANT", "1");
    const { sendAssistantGameEvent } = await loadPortalAssistant();

    sendAssistantGameEvent({
      eventType: "level_start",
      levelId: "stage-2",
      hintCount: 1,
    });

    // initStemAssistantBridge posts STEM_ASSISTANT_BRIDGE_INIT; then our event sends ASSISTANT_GAME_EVENT
    expect(postMessage).toHaveBeenCalledTimes(2);
    const [msg, target] = postMessage.mock.calls[1];
    expect(msg.type).toBe("ASSISTANT_GAME_EVENT");
    expect(target).toBe("*");
    expect(msg.payload.eventType).toBe("level_start");
    expect(msg.payload.levelId).toBe("stage-2");
    expect(msg.payload.hintCount).toBe(1);
    expect(typeof msg.payload.gameId).toBe("string");
  });

  it("sendAssistantGameEvent no-ops when inactive or payload invalid", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", { self: {}, top: {}, parent: { postMessage } });
    vi.stubEnv("VITE_PORTAL_ASSISTANT", "0");
    const { sendAssistantGameEvent } = await loadPortalAssistant();

    sendAssistantGameEvent({ eventType: "level_start" });
    sendAssistantGameEvent(null);
    sendAssistantGameEvent("bad");

    expect(postMessage).not.toHaveBeenCalled();
  });
});
