import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameEngine, GameState } from "./engine.js";

describe("GameEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("startLevel enters PLAYING and decrements time on tick", () => {
    const engine = new GameEngine();
    engine.startLevel(5);
    expect(engine.state).toBe(GameState.PLAYING);
    expect(engine.isPaused).toBe(false);
    vi.advanceTimersByTime(100);
    expect(engine.timeRemaining).toBeLessThan(5);
  });

  it("invokes onTimeUp and fails when time hits zero", () => {
    const engine = new GameEngine();
    const onTimeUp = vi.fn();
    engine.onTimeUp = onTimeUp;
    engine.startLevel(0.15);
    vi.advanceTimersByTime(250);
    expect(onTimeUp).toHaveBeenCalled();
    expect(engine.state).toBe(GameState.FAILED);
    expect(engine.timeRemaining).toBe(0);
  });

  it("pause freezes countdown; resume continues", () => {
    const engine = new GameEngine();
    engine.startLevel(20);
    vi.advanceTimersByTime(100);
    const mid = engine.timeRemaining;
    engine.pause();
    expect(engine.state).toBe(GameState.PAUSED);
    vi.advanceTimersByTime(500);
    expect(engine.timeRemaining).toBe(mid);
    engine.resume();
    expect(engine.state).toBe(GameState.PLAYING);
    vi.advanceTimersByTime(100);
    expect(engine.timeRemaining).toBeLessThan(mid);
  });

  it("completeLevel scores time bonus, bonus points, and hint penalty; clamps score at zero", () => {
    const engine = new GameEngine();
    engine.startLevel(10);
    engine.hintsUsed = 0;
    engine.completeLevel(5);
    expect(engine.state).toBe(GameState.SUCCESS);
    expect(engine.score).toBe(100 + Math.floor(10 * 10) + 5);

    const engine2 = new GameEngine();
    engine2.startLevel(1);
    engine2.hintsUsed = 10;
    engine2.completeLevel(0);
    expect(engine2.score).toBe(0);
  });

  it("failLevel stops the timer and sets FAILED", () => {
    const engine = new GameEngine();
    engine.startLevel(99);
    vi.advanceTimersByTime(100);
    engine.failLevel();
    expect(engine.state).toBe(GameState.FAILED);
    const t = engine.timeRemaining;
    vi.advanceTimersByTime(500);
    expect(engine.timeRemaining).toBe(t);
  });

  it("freezeTimer halts countdown without leaving PLAYING state", () => {
    const engine = new GameEngine();
    engine.startLevel(10);
    vi.advanceTimersByTime(100);
    const mid = engine.timeRemaining;
    engine.freezeTimer();
    expect(engine.state).toBe(GameState.PLAYING);
    vi.advanceTimersByTime(500);
    expect(engine.timeRemaining).toBe(mid);
  });

  it("nextLevel increments index and resets hints", () => {
    const engine = new GameEngine();
    engine.currentLevelIndex = 2;
    engine.hintsUsed = 4;
    engine.nextLevel();
    expect(engine.currentLevelIndex).toBe(3);
    expect(engine.hintsUsed).toBe(0);
  });

  it("resetGame clears timer, score, and returns to MENU", () => {
    const engine = new GameEngine();
    engine.startLevel(30);
    engine.score = 50;
    engine.resetGame();
    expect(engine.state).toBe(GameState.MENU);
    expect(engine.score).toBe(0);
    expect(engine.timeRemaining).toBe(0);
  });

  it("getTimeFormatted pads minutes, seconds, and tenths", () => {
    const engine = new GameEngine();
    engine.timeRemaining = 125;
    expect(engine.getTimeFormatted()).toBe("02:05.0");
    engine.timeRemaining = 0.5;
    expect(engine.getTimeFormatted()).toBe("00:00.5");
    engine.timeRemaining = -1;
    expect(engine.getTimeFormatted()).toBe("00:00.0");
  });

  it("destroy clears the interval", () => {
    const engine = new GameEngine();
    engine.startLevel(10);
    engine.destroy();
    const t = engine.timeRemaining;
    vi.advanceTimersByTime(500);
    expect(engine.timeRemaining).toBe(t);
  });
});
