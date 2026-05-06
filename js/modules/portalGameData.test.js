import { describe, expect, it, vi } from "vitest";
import {
  fetchPortalGameData,
  initPortalGameDataBridge,
  mergeAndSavePortalGameData,
  normalizePortalGameData,
  speedScoreFromElapsedMs,
  updateHighScore,
} from "./portalGameData.js";

function mockIframeWindow(postMessage = vi.fn()) {
  const listeners = new Map();
  vi.stubGlobal("window", {
    self: {},
    top: {},
    parent: { postMessage },
    addEventListener: vi.fn((name, fn) => listeners.set(name, fn)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    setTimeout,
    clearTimeout,
  });
  return {
    postMessage,
    emitMessage: (event) => {
      const fn = listeners.get("message");
      if (fn) fn(event);
    },
  };
}

describe("portalGameData", () => {
  it("normalizes non-object payloads to empty object", () => {
    expect(normalizePortalGameData(null)).toEqual({});
    expect(normalizePortalGameData([])).toEqual({});
    expect(normalizePortalGameData({ highScore: 10 })).toEqual({ highScore: 10 });
  });

  it("requests game data and resolves on loaded message", async () => {
    const { postMessage, emitMessage } = mockIframeWindow();
    const cleanup = initPortalGameDataBridge();
    const promise = fetchPortalGameData(2000);

    expect(postMessage).toHaveBeenCalledWith({ type: "PORTAL_GAME_DATA_LOAD_REQUEST", payload: {} }, "*");

    emitMessage({
      origin: "https://portal.example",
      data: { type: "PORTAL_GAME_DATA_LOADED", payload: { highScore: 321 } },
    });

    await expect(promise).resolves.toEqual({ highScore: 321 });
    cleanup();
  });

  it("merges and posts data when asked to save", () => {
    const { postMessage } = mockIframeWindow();
    const next = mergeAndSavePortalGameData({ highScore: 200, mode: "endless" }, { score: 150 });
    expect(next).toEqual({ highScore: 200, mode: "endless", score: 150 });
    expect(postMessage).toHaveBeenCalledWith(
      { type: "PORTAL_GAME_DATA_SAVE", payload: { highScore: 200, mode: "endless", score: 150 } },
      expect.any(String)
    );
  });

  it("only saves when score beats previous high score", () => {
    const { postMessage } = mockIframeWindow();
    const unchanged = updateHighScore({ highScore: 400 }, 390);
    expect(unchanged).toEqual({ highScore: 400 });

    const next = updateHighScore({ highScore: 400 }, 450, { mode: "campaign", elapsedMs: 12000 });
    expect(next).toEqual({
      highScore: 450,
      score: 450,
      scoreMeta: { mode: "campaign", elapsedMs: 12000 },
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        type: "PORTAL_GAME_DATA_SAVE",
        payload: { highScore: 450, score: 450, scoreMeta: { mode: "campaign", elapsedMs: 12000 } },
      },
      expect.any(String)
    );
  });

  it("uses score as fallback previous best when highScore missing", () => {
    const { postMessage } = mockIframeWindow();
    const unchanged = updateHighScore({ score: 500 }, 499);
    expect(unchanged).toEqual({ score: 500 });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("maps elapsed milliseconds to leaderboard speed score", () => {
    expect(speedScoreFromElapsedMs(0)).toBe(3600000);
    expect(speedScoreFromElapsedMs(2500)).toBe(3597500);
    expect(speedScoreFromElapsedMs(3_700_000)).toBe(0);
    expect(speedScoreFromElapsedMs(Number.NaN)).toBe(0);
  });
});
