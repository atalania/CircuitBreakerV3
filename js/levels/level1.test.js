import { describe, it, expect } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { Level1, getLevel1CoachState } from "./level1.js";

function wire(lab, fromB, fromPort, toB, toPort) {
  lab.connectPorts(`${fromB.id}:${fromPort}`, `${toB.id}:${toPort}`);
}

/** Builds X=A·B, Y=¬C, Z=B∨C on the Level1 canvas for exhaustive checkLab. */
function buildSolvedLevel1Lab() {
  const lab = new CircuitLab();
  Level1.setupLab(lab);
  const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
  const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
  const pinC = lab.blocks.find((b) => b.kind === "source" && b.pin === "C");
  const ledX = lab.findLedByLabel("X");
  const ledY = lab.findLedByLabel("Y");
  const ledZ = lab.findLedByLabel("Z");
  expect(pinA && pinB && pinC && ledX && ledY && ledZ).toBeTruthy();

  lab.placeAt("and", 420, 140);
  lab.placeAt("not", 420, 260);
  lab.placeAt("or", 420, 380);
  const ands = lab.blocks.filter((b) => b.kind === "and");
  const nots = lab.blocks.filter((b) => b.kind === "not");
  const ors = lab.blocks.filter((b) => b.kind === "or");
  const andX = ands[ands.length - 1];
  const notY = nots[nots.length - 1];
  const orZ = ors[ors.length - 1];

  wire(lab, pinA, "out", andX, "in0");
  wire(lab, pinB, "out", andX, "in1");
  wire(lab, andX, "out", ledX, "in");

  wire(lab, pinC, "out", notY, "in");
  wire(lab, notY, "out", ledY, "in");

  wire(lab, pinB, "out", orZ, "in0");
  wire(lab, pinC, "out", orZ, "in1");
  wire(lab, orZ, "out", ledZ, "in");

  return lab;
}

describe("Level1", () => {
  it("getLevel1CoachState reports missing gates until AND/OR/NOT are placed", () => {
    const lab = new CircuitLab();
    Level1.setupLab(lab);
    const s = getLevel1CoachState(lab);
    expect(s.pinOk).toBe(true);
    expect(s.ledsOk).toBe(true);
    expect(s.gatesOk).toBe(false);
  });

  it("checkLab rejects missing pins or LEDs", () => {
    const lab = new CircuitLab();
    Level1.setupLab(lab);
    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    lab.removeBlock(pinA.id);
    expect(Level1.checkLab(lab).ok).toBe(false);

    const lab2 = new CircuitLab();
    Level1.setupLab(lab2);
    const ledX = lab2.findLedByLabel("X");
    lab2.removeBlock(ledX.id);
    expect(Level1.checkLab(lab2).ok).toBe(false);
  });
});

describe("Level1 checkLab exhaustive", () => {
  it("passes when the truth table matches the spec on all eight rows", () => {
    const lab = buildSolvedLevel1Lab();
    const coach = getLevel1CoachState(lab);
    expect(coach.gatesOk).toBe(true);
    expect(coach.ledsFed).toBe(true);
    const res = Level1.checkLab(lab);
    expect(res.ok).toBe(true);
  });
});
