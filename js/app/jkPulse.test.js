import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "../modules/engine.js";
import { Level4 } from "../levels/level4.js";
import { handleJkPulse } from "./jkPulse.js";

describe("handleJkPulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns early when not playing or not on level 4", () => {
    const app = {
      engine: { state: GameState.MENU },
      currentLevel: { id: 4 },
      audio: { playClock: vi.fn() },
      _labRedraw: vi.fn(),
    };
    handleJkPulse(app, "jk");
    expect(app.audio.playClock).not.toHaveBeenCalled();
  });

  it("on sequence complete schedules level complete", () => {
    vi.spyOn(Level4, "afterJkPulse").mockReturnValue({
      ok: true,
      message: "done",
      pulseResult: {
        isComplete: true,
        achieved: [1, 0, 1, 1],
        target: [1, 0, 1, 1],
      },
    });

    const app = {
      engine: { state: GameState.PLAYING, freezeTimer: vi.fn() },
      currentLevel: { id: 4 },
      audio: { playClock: vi.fn(), playSuccess: vi.fn() },
      ui: { addChatMessage: vi.fn() },
      circuitLab: {},
      _updateSequenceTracker: vi.fn(),
      _labRedraw: vi.fn(),
      _portalAssistantEvent: vi.fn(),
      _levelComplete: vi.fn(),
    };

    handleJkPulse(app, "lab_jk_1");
    expect(app.audio.playSuccess).toHaveBeenCalled();
    expect(app.engine.freezeTimer).toHaveBeenCalled();
    vi.advanceTimersByTime(650);
    expect(app._levelComplete).toHaveBeenCalled();
  });
});
