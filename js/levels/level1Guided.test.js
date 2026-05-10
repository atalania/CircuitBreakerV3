import { describe, it, expect } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { Level1Guided, getLevel1GuidedCoachState, getGuidedCoachMilestone } from "./level1Guided.js";

function wire(lab, fromB, fromPort, toB, toPort) {
  lab.connectPorts(`${fromB.id}:${fromPort}`, `${toB.id}:${toPort}`);
}

function buildSolvedGuidedLab() {
  const lab = new CircuitLab();
  lab.placeAt("in:A", 120, 200);
  lab.placeAt("in:B", 120, 340);
  lab.placeAt("and", 430, 270);
  lab.placeAt("led:X", 780, 270);
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

  it("fails when wiring is incomplete", () => {
    const lab = buildSolvedGuidedLab();
    const ledX = lab.findLedByLabel("X");
    const w = lab.wires.find((x) => x.toKey === `${ledX.id}:in`);
    lab.removeWire(w.id);
    expect(Level1Guided.checkLab(lab).ok).toBe(false);

    const broken = buildSolvedGuidedLab();
    const pinB = broken.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const wB = broken.wires.find((x) => x.fromKey === `${pinB.id}:out`);
    broken.removeWire(wB.id);
    expect(Level1Guided.checkLab(broken).ok).toBe(false);
  });
});

describe("getGuidedCoachMilestone", () => {
  it("advances 0→7 as parts and wires are added", () => {
    const lab = new CircuitLab();
    expect(getGuidedCoachMilestone(lab)).toBe(0);
    lab.placeAt("in:A", 50, 50);
    expect(getGuidedCoachMilestone(lab)).toBe(1);
    lab.placeAt("in:B", 80, 50);
    expect(getGuidedCoachMilestone(lab)).toBe(2);
    lab.placeAt("and", 200, 50);
    expect(getGuidedCoachMilestone(lab)).toBe(3);
    lab.placeAt("led:X", 350, 50);
    expect(getGuidedCoachMilestone(lab)).toBe(4);
    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const andG = lab.blocks.find((b) => b.kind === "and");
    const ledX = lab.findLedByLabel("X");
    lab.connectPorts(`${pinA.id}:out`, `${andG.id}:in0`);
    expect(getGuidedCoachMilestone(lab)).toBe(5);
    lab.connectPorts(`${pinB.id}:out`, `${andG.id}:in1`);
    expect(getGuidedCoachMilestone(lab)).toBe(6);
    lab.connectPorts(`${andG.id}:out`, `${ledX.id}:in`);
    expect(getGuidedCoachMilestone(lab)).toBe(7);
  });
});

describe("getLevel1GuidedCoachState", () => {
  it("tracks wiring steps", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 120, 200);
    lab.placeAt("in:B", 120, 340);
    lab.placeAt("and", 430, 270);
    lab.placeAt("led:X", 780, 270);
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
});
