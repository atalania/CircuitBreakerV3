import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameState } from "../modules/engine.js";
import { Level2 } from "../levels/level2.js";
import { processCampaignLabSubmit } from "./campaignSubmit.js";

function baseApp(overrides = {}) {
  return {
    currentLevel: { id: 1 },
    engine: { state: GameState.PLAYING },
    circuitLab: { getPinValues: () => ({ A: 0, B: 0, C: 0 }) },
    audio: {
      playSuccess: vi.fn(),
      playFail: vi.fn(),
      playSwitch: vi.fn(),
    },
    ui: {
      addChatMessage: vi.fn(),
      flashCircuit: vi.fn(),
    },
    _portalAssistantEvent: vi.fn(),
    _levelComplete: vi.fn(),
    _updateTruthTableTracker: vi.fn(),
    _updateSrLatchTracker: vi.fn(),
    _requestTutorFeedback: vi.fn(),
    _srInvalidActive: false,
    ...overrides,
  };
}

describe("processCampaignLabSubmit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately for level 4", () => {
    const app = baseApp({ currentLevel: { id: 4 } });
    processCampaignLabSubmit(app, { ok: true });
    expect(app.audio.playSuccess).not.toHaveBeenCalled();
  });

  it("level 1: success schedules level complete", () => {
    const app = baseApp();
    processCampaignLabSubmit(app, { ok: true, message: "cleared" });
    expect(app.audio.playSuccess).toHaveBeenCalled();
    expect(app._portalAssistantEvent).toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(app._levelComplete).toHaveBeenCalled();
  });

  it("level 1: failure plays fail and requests tutor context", () => {
    const app = baseApp();
    processCampaignLabSubmit(app, { ok: false, message: "bad row" });
    expect(app.audio.playFail).toHaveBeenCalled();
    expect(app._requestTutorFeedback).toHaveBeenCalled();
  });

  it("level 3: srInvalid debounces portal events until cleared", () => {
    const app = baseApp({ currentLevel: { id: 3 } });
    processCampaignLabSubmit(app, { ok: false, srInvalid: true, message: "bad sr" });
    expect(app._srInvalidActive).toBe(true);
    expect(app._portalAssistantEvent).toHaveBeenCalledTimes(1);

    processCampaignLabSubmit(app, { ok: false, srInvalid: true, message: "bad sr" });
    expect(app._portalAssistantEvent).toHaveBeenCalledTimes(1);
  });

  it("level 2: truthFail plays fail and emits mismatch context", () => {
    const app = baseApp({ currentLevel: Level2 });
    processCampaignLabSubmit(app, {
      ok: false,
      truthFail: true,
      combo: "000",
      q: 0,
      message: "nope",
    });
    expect(app.audio.playFail).toHaveBeenCalled();
    expect(app._portalAssistantEvent).toHaveBeenCalledWith(
      "incorrect_submission",
      expect.objectContaining({ mistakeCategory: "circuit_output_mismatch" })
    );
  });

  it("level 2: partial success flashes and emits partial submission", () => {
    const app = baseApp({ currentLevel: Level2 });
    processCampaignLabSubmit(app, {
      ok: false,
      partial: true,
      combo: "111",
      q: 1,
      message: "row logged",
      progress: { found: 1, total: 6 },
    });
    expect(app.audio.playSwitch).toHaveBeenCalled();
    expect(app.ui.flashCircuit).toHaveBeenCalled();
    expect(app._portalAssistantEvent).toHaveBeenCalledWith(
      "correct_submission",
      expect.objectContaining({ additionalContext: expect.objectContaining({ partialTruthTableRow: true }) })
    );
  });
});
