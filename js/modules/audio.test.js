import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "./audio.js";

function stubWorkingAudioContext() {
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      type: "",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
  };
  vi.stubGlobal("window", {
    AudioContext: vi.fn(() => ctx),
    webkitAudioContext: vi.fn(() => ctx),
  });
  return ctx;
}

describe("AudioManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("init creates a context once and playSwitch schedules audio nodes", () => {
    stubWorkingAudioContext();
    const audio = new AudioManager();
    audio.init();
    audio.init();
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
    audio.playSwitch();
    expect(audio.ctx?.createOscillator).toHaveBeenCalled();
  });

  it("play methods no-op when init fails (no context)", () => {
    vi.stubGlobal("window", {
      AudioContext: vi.fn(() => {
        throw new Error("no audio");
      }),
    });
    const audio = new AudioManager();
    audio.init();
    expect(audio.enabled).toBe(false);
    expect(() => audio.playSuccess()).not.toThrow();
  });

  it("covers clock, success, fail, tick, and hint one-shots", () => {
    stubWorkingAudioContext();
    const audio = new AudioManager();
    audio.init();
    audio.playClock();
    audio.playSuccess();
    audio.playFail();
    audio.playTick();
    audio.playHint();
    expect(audio.ctx?.createOscillator).toHaveBeenCalled();
  });

  it("toggle flips enabled flag", () => {
    const audio = new AudioManager();
    expect(audio.toggle()).toBe(false);
    expect(audio.toggle()).toBe(true);
  });
});
