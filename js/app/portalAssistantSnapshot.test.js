import { describe, it, expect } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import {
  assistantWinConditionSummary,
  buildAssistantLevelSnapshot,
  formatTruthTableCompact,
} from "./portalAssistantSnapshot.js";

describe("formatTruthTableCompact", () => {
  it("formats eight-row table", () => {
    const t = {
      "000": { F: 0 },
      "001": { F: 1 },
      "010": { F: 0 },
      "011": { F: 1 },
      "100": { F: 0 },
      "101": { F: 1 },
      "110": { F: 0 },
      "111": { F: 1 },
    };
    expect(formatTruthTableCompact(t)).toBe(
      "000→0 001→1 010→0 011→1 100→0 101→1 110→0 111→1"
    );
  });

  it("returns null for empty input", () => {
    expect(formatTruthTableCompact(null)).toBe(null);
  });
});

describe("assistantWinConditionSummary", () => {
  it("describes endless mode", () => {
    expect(assistantWinConditionSummary(true, null, {}).toLowerCase()).toContain("endless");
  });

  it("describes level 4 JK", () => {
    const s = assistantWinConditionSummary(false, { id: 4 }, null);
    expect(s).toContain("JK");
  });
});

describe("buildAssistantLevelSnapshot", () => {
  it("includes lab snapshot and LED outputs", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 100, 100);
    lab.blocks[lab.blocks.length - 1].pin = "A";
    lab.placeAt("low", 100, 160);
    lab.blocks[lab.blocks.length - 1].pin = "B";
    lab.placeAt("led:X", 400, 130);

    const snap = buildAssistantLevelSnapshot({
      endlessMode: false,
      endlessSpec: null,
      currentLevel: { id: 1, objective: "Test obj", timeLimit: 99, tutorContext: "ctx" },
      circuitLab: lab,
      engine: { state: "playing", timeRemaining: 12.3, hintsUsed: 1 },
    });

    expect(snap.assistantSchemaVersion).toBe(1);
    expect(snap.levelObjective).toBe("Test obj");
    expect(snap.labSnapshot).toMatchObject({
      wireCount: 0,
      hasJk: false,
      hasSr: false,
    });
    expect(snap.ledOutputsAtCurrentPins).toHaveProperty("X");
    expect(snap.winConditionSummary).toContain("Level 1");
  });
});
