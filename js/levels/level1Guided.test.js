import { describe, it, expect } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { Level1Guided, getLevel1GuidedCoachState } from "./level1Guided.js";

function wire(lab, fromB, fromPort, toB, toPort) {
  lab.connectPorts(`${fromB.id}:${fromPort}`, `${toB.id}:${toPort}`);
}

function buildSolvedGuidedLab() {
  const lab = new CircuitLab();
  Level1Guided.setupLab(lab);
  const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
  const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
  const andG = lab.blocks.find((b) => b.kind === "and");
  const ledX = lab.findLedByLabel("X");
  expect(pinA && pinB && andG && ledX).toBeTruthy();
  wire(lab, pinA, "out", andG, "in0");
  wire(lab, pinB, "out", andG, "in1");
  wire(lab, andG, "out", ledX, "in");
  return lab;
}

describe("Level1Guided checkLab", () => {
  it("passes when X = A∧B on all four AB rows", () => {
    const lab = buildSolvedGuidedLab();
    const res = Level1Guided.checkLab(lab);
    expect(res.ok).toBe(true);
  });

  it("fails when X is wrong for at least one row", () => {
    const lab = buildSolvedGuidedLab();
    const ledX = lab.findLedByLabel("X");
    const w = lab.wires.find((x) => x.toKey === `${ledX.id}:in`);
    lab.removeWire(w.id);
    expect(Level1Guided.checkLab(lab).ok).toBe(false);

    const broken = buildSolvedGuidedLab();
    const pinB = broken.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const andG = broken.blocks.find((b) => b.kind === "and");
    const wB = broken.wires.find((x) => x.fromKey === `${pinB.id}:out`);
    broken.removeWire(wB.id);
    expect(Level1Guided.checkLab(broken).ok).toBe(false);
  });
});

describe("getLevel1GuidedCoachState", () => {
  it("tracks wiring steps", () => {
    const lab = new CircuitLab();
    Level1Guided.setupLab(lab);
    const s0 = getLevel1GuidedCoachState(lab);
    expect(s0.pinsOk && s0.andOk).toBe(true);
    expect(s0.bothAndInputs).toBe(false);
    expect(s0.xFed).toBe(false);

    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const andG = lab.blocks.find((b) => b.kind === "and");
    wire(lab, pinA, "out", andG, "in0");
    const s1 = getLevel1GuidedCoachState(lab);
    expect(s1.bothAndInputs).toBe(false);

    wire(lab, pinB, "out", andG, "in1");
    const s2 = getLevel1GuidedCoachState(lab);
    expect(s2.bothAndInputs).toBe(true);
    expect(s2.xFed).toBe(false);

    const ledX = lab.findLedByLabel("X");
    wire(lab, andG, "out", ledX, "in");
    const s3 = getLevel1GuidedCoachState(lab);
    expect(s3.xFed).toBe(true);
  });

  it("accepts swapped AND inputs", () => {
    const lab = buildSolvedGuidedLab();
    const coach = getLevel1GuidedCoachState(lab);
    expect(coach.bothAndInputs && coach.xFed).toBe(true);
  });
});
