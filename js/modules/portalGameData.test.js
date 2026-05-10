import { describe, expect, it, vi } from "vitest";
import {
  fetchPortalGameData,
  initPortalGameDataBridge,
  mergeAndSavePortalGameData,
  normalizePortalGameData,
  SCORES_VERSION,
  speedScoreFromElapsedMs,
  updateCampaignLevelBest,
  updateEndlessBest,
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

  it("updateCampaignLevelBest saves per-level speed and mirrors circuitBreaker", () => {
    const { postMessage } = mockIframeWindow();
    const next = updateCampaignLevelBest({}, 2, {
      speedScore: 3_500_000,
      elapsedMs: 100_000,
      diffusalScore: 220,
      hintsUsed: 1,
      scoreMeta: { mode: "campaign", levelId: 2 },
    });
    expect(next.scoresVersion).toBe(SCORES_VERSION);
    expect(next.campaignBests["2"].speedScore).toBe(3_500_000);
    expect(next.campaignBests["2"].diffusalScore).toBe(220);
    expect(next.circuitBreaker.campaignBests["2"].speedScore).toBe(3_500_000);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("updateCampaignLevelBest ignores worse speed for same level", () => {
    const { postMessage } = mockIframeWindow();
    const base = {
      scoresVersion: SCORES_VERSION,
      campaignBests: { "1": { speedScore: 3_000_000, elapsedMs: 500, diffusalScore: 100, at: "t0" } },
    };
    const same = updateCampaignLevelBest(base, 1, { speedScore: 2_000_000, elapsedMs: 999, diffusalScore: 500 });
    expect(same).toEqual(base);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("updateCampaignLevelBest reads prior best from circuitBreaker mirror", () => {
    const { postMessage } = mockIframeWindow();
    const base = {
      circuitBreaker: {
        campaignBests: { "3": { speedScore: 3_100_000, elapsedMs: 100, diffusalScore: 50, at: "t" } },
      },
    };
    const same = updateCampaignLevelBest(base, 3, { speedScore: 3_000_000, elapsedMs: 200, diffusalScore: 60 });
    expect(same).toEqual(base);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("updateCampaignLevelBest keeps other levels when they only lived under circuitBreaker", () => {
    const { postMessage } = mockIframeWindow();
    const base = {
      circuitBreaker: {
        campaignBests: {
          "1": { speedScore: 3_000_000, elapsedMs: 500, diffusalScore: 100, at: "t0" },
        },
      },
    };
    const next = updateCampaignLevelBest(base, 2, {
      speedScore: 3_400_000,
      elapsedMs: 200_000,
      diffusalScore: 180,
      scoreMeta: { mode: "campaign", levelId: 2 },
    });
    expect(next.campaignBests["1"]).toEqual(base.circuitBreaker.campaignBests["1"]);
    expect(next.campaignBests["2"].speedScore).toBe(3_400_000);
    expect(next.circuitBreaker.campaignBests["1"]).toEqual(base.circuitBreaker.campaignBests["1"]);
    expect(next.circuitBreaker.campaignBests["2"].speedScore).toBe(3_400_000);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("updateEndlessBest writes endlessBest and bumps top-level score", () => {
    const { postMessage } = mockIframeWindow();
    const next = updateEndlessBest({ highScore: 100, score: 100 }, 450, { mode: "endless" });
    expect(next.endlessBest.score).toBe(450);
    expect(next.circuitBreaker.endlessBest.score).toBe(450);
    expect(next.highScore).toBe(450);
    expect(next.score).toBe(450);
    expect(next.scoresVersion).toBe(SCORES_VERSION);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("updateEndlessBest ignores lower endless score", () => {
    const { postMessage } = mockIframeWindow();
    const base = { endlessBest: { score: 600, at: "x" } };
    const same = updateEndlessBest(base, 400, { mode: "endless" });
    expect(same).toEqual(base);
    expect(postMessage).not.toHaveBeenCalled();
  });
});
