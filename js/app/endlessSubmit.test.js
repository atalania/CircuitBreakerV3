import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { GameState } from "../modules/engine.js";
import { submitEndlessRound, showEndlessRoundComplete } from "./endlessSubmit.js";

function wire(lab, fromB, fromPort, toB, toPort) {
  lab.connectPorts(`${fromB.id}:${fromPort}`, `${toB.id}:${toPort}`);
}

function appWithLab(lab, overrides = {}) {
  return {
    endlessSpec: {
      title: "TEST",
      table: {
        "000": { F: 0 },
        "001": { F: 1 },
        "010": { F: 0 },
        "011": { F: 1 },
        "100": { F: 0 },
        "101": { F: 1 },
        "110": { F: 0 },
        "111": { F: 1 },
      },
    },
    circuitLab: lab,
    audio: { playSuccess: vi.fn(), playFail: vi.fn() },
    ui: {
      addChatMessage: vi.fn(),
      flashCircuit: vi.fn(),
      updateScore: vi.fn(),
      showModal: vi.fn(),
      hideModal: vi.fn(),
      showMenu: vi.fn(),
    },
    engine: { state: GameState.PLAYING, score: 0 },
    _portalAssistantEvent: vi.fn(),
    _startEndless: vi.fn(),
    ...overrides,
  };
}

describe("submitEndlessRound", () => {
  it("returns when endlessSpec is missing", () => {
    const lab = new CircuitLab();
    const app = appWithLab(lab, { endlessSpec: null });
    submitEndlessRound(app);
    expect(app.audio.playFail).not.toHaveBeenCalled();
  });

  it("fails when the normalized truth table is incomplete", () => {
    const app = appWithLab(new CircuitLab(), {
      endlessSpec: { title: "BAD", objective: "x", table: { "000": { F: 0 } } },
    });
    submitEndlessRound(app);
    expect(app.audio.playFail).toHaveBeenCalled();
    expect(app.ui.addChatMessage).toHaveBeenCalledWith(
      expect.stringMatching(/table is incomplete/i),
      "system"
    );
  });

  it("fails when required pins are missing", () => {
    const lab = new CircuitLab();
    const app = appWithLab(lab);
    submitEndlessRound(app);
    expect(app.audio.playFail).toHaveBeenCalled();
  });

  it("fails when LED F is missing", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    lab.placeAt("in:B", 0, 0);
    lab.placeAt("in:C", 0, 0);
    const app = appWithLab(lab);
    submitEndlessRound(app);
    expect(app.audio.playFail).toHaveBeenCalled();
  });
});

describe("submitEndlessRound with wired F", () => {
  it("passes when circuit output matches the brief table", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("in:B", 10, 40);
    lab.placeAt("in:C", 10, 70);
    lab.placeAt("led:F", 200, 40);
    const pinC = lab.blocks.find((b) => b.kind === "source" && b.pin === "C");
    const ledF = lab.findLedByLabel("F");
    wire(lab, pinC, "out", ledF, "in");

    const app = appWithLab(lab);
    submitEndlessRound(app);
    expect(app.audio.playSuccess).toHaveBeenCalled();
    expect(app._portalAssistantEvent).toHaveBeenCalledWith(
      "correct_submission",
      expect.objectContaining({ playerAnswer: "endless_truth_table_match" })
    );
    expect(app._portalAssistantEvent).toHaveBeenCalledWith("level_complete");
  });

  it("passes a majority circuit when AI copy says at least two inputs are high", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("in:B", 10, 40);
    lab.placeAt("in:C", 10, 70);
    lab.placeAt("and", 100, 20);
    lab.placeAt("and", 100, 60);
    lab.placeAt("and", 100, 100);
    lab.placeAt("or", 220, 40);
    lab.placeAt("or", 340, 70);
    lab.placeAt("led:F", 460, 70);

    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const pinC = lab.blocks.find((b) => b.kind === "source" && b.pin === "C");
    const [andAB, andAC, andBC] = lab.blocks.filter((b) => b.kind === "and");
    const [orLeft, orRight] = lab.blocks.filter((b) => b.kind === "or");
    const ledF = lab.findLedByLabel("F");

    wire(lab, pinA, "out", andAB, "in0");
    wire(lab, pinB, "out", andAB, "in1");
    wire(lab, pinA, "out", andAC, "in0");
    wire(lab, pinC, "out", andAC, "in1");
    wire(lab, pinB, "out", andBC, "in0");
    wire(lab, pinC, "out", andBC, "in1");
    wire(lab, andAB, "out", orLeft, "in0");
    wire(lab, andAC, "out", orLeft, "in1");
    wire(lab, orLeft, "out", orRight, "in0");
    wire(lab, andBC, "out", orRight, "in1");
    wire(lab, orRight, "out", ledF, "in");

    const app = appWithLab(lab, {
      endlessSpec: {
        title: "MAJORITY",
        objective: "Player uses draggable pins A, B, C and LED F to output 1 when at least two inputs are high.",
        table: {
          "000": { F: 0 },
          "001": { F: 1 },
          "010": { F: 0 },
          "011": { F: 1 },
          "100": { F: 0 },
          "101": { F: 1 },
          "110": { F: 0 },
          "111": { F: 1 },
        },
      },
    });
    submitEndlessRound(app);
    expect(app.audio.playSuccess).toHaveBeenCalled();
    expect(app.audio.playFail).not.toHaveBeenCalled();
  });
});

describe("showEndlessRoundComplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no-ops when not in PLAYING state", () => {
    const app = appWithLab(new CircuitLab(), { engine: { state: GameState.MENU, score: 0 } });
    showEndlessRoundComplete(app);
    expect(app.ui.showModal).not.toHaveBeenCalled();
  });

  it("opens modal and bumps score when playing", () => {
    const app = appWithLab(new CircuitLab());
    showEndlessRoundComplete(app);
    expect(app.engine.score).toBe(150);
    expect(app.ui.showModal).toHaveBeenCalled();
  });
});
