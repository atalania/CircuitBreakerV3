import { describe, it, expect, beforeEach } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { Level2 } from "./level2.js";
import { Level3 } from "./level3.js";
import { Level4 } from "./level4.js";
import { Level5 } from "./level5.js";

describe("Level2", () => {
  beforeEach(() => {
    Level2.resetProgress();
    Level2.setupLab();
  });

  it("expectedQ matches NAND(XOR(A,B), C)", () => {
    expect(Level2.expectedQ(0, 0, 0)).toBe(1);
    expect(Level2.expectedQ(1, 0, 1)).toBe(0);
  });

  it("checkLab returns pin error on empty lab", () => {
    const lab = new CircuitLab();
    const r = Level2.checkLab(lab);
    expect(r.ok).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it("checkLab requires LED Q", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    lab.placeAt("in:B", 0, 0);
    lab.placeAt("in:C", 0, 0);
    const r = Level2.checkLab(lab);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toMatch(/LED Q/i);
  });

  it("rejects a constant-high LED even after every winning row is logged", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("in:B", 10, 40);
    lab.placeAt("in:C", 10, 70);
    lab.placeAt("high", 100, 40);
    lab.placeAt("led:Q", 200, 40);
    const high = lab.blocks.find((b) => b.kind === "source" && !b.pin);
    const q = lab.findLedByLabel("Q");
    lab.connectPorts(`${high.id}:out`, `${q.id}:in`);
    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const pinC = lab.blocks.find((b) => b.kind === "source" && b.pin === "C");
    let res;
    for (const combo of ["000", "001", "010", "100", "110", "111"]) {
      pinA.value = parseInt(combo[0], 10);
      pinB.value = parseInt(combo[1], 10);
      pinC.value = parseInt(combo[2], 10);
      res = Level2.checkLab(lab);
    }
    expect(res.ok).toBe(false);
    expect(res.truthFail).toBe(true);
  });
});

describe("Level3", () => {
  beforeEach(() => {
    Level3.resetProgress();
    Level3.setupLab();
  });

  it("checkLab requires S and R pins", () => {
    const lab = new CircuitLab();
    const r = Level3.checkLab(lab);
    expect(r.ok).toBe(false);
  });

  it("checkLab requires exactly one SR latch", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:S", 0, 0);
    lab.placeAt("in:R", 0, 0);
    const r = Level3.checkLab(lab);
    expect(r.ok).toBe(false);
    expect(String(r.message)).toMatch(/SR/i);
  });
});

describe("Level4.afterJkPulse", () => {
  beforeEach(() => {
    Level4.resetProgress();
    Level4.setupLab();
  });

  it("returns pin error when J/K pins are missing", () => {
    const lab = new CircuitLab();
    const r = Level4.afterJkPulse(lab, "any");
    expect(r.ok).toBe(false);
    expect(r.pulseResult).toBeNull();
  });

  it("requires LED Q to exist and be wired to outQ before pulsing", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:J", 10, 10);
    lab.placeAt("in:K", 10, 50);
    lab.placeAt("jk", 120, 30);
    const jk = lab.getSoleJkBlock();
    const j = lab.blocks.find((b) => b.kind === "source" && b.pin === "J");
    const k = lab.blocks.find((b) => b.kind === "source" && b.pin === "K");
    lab.connectPorts(`${j.id}:out`, `${jk.id}:inJ`);
    lab.connectPorts(`${k.id}:out`, `${jk.id}:inK`);
    Level4.primeLab(lab);
    j.value = 1;
    k.value = 0;

    const noLed = Level4.afterJkPulse(lab, jk.id);
    expect(noLed.ok).toBe(false);
    expect(noLed.message).toMatch(/LED Q/);

    lab.placeAt("led:Q", 240, 30);
    const led = lab.findLedByLabel("Q");
    const unwired = Level4.afterJkPulse(lab, jk.id);
    expect(unwired.ok).toBe(false);
    expect(unwired.message).toMatch(/Wire JK outQ/);

    lab.connectPorts(`${jk.id}:outQ`, `${led.id}:in`);
    const wired = Level4.afterJkPulse(lab, jk.id);
    expect(wired.pulseResult).not.toBeNull();
  });

  it("marks sequence failed when second pulse does not match target", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:J", 10, 10);
    lab.placeAt("in:K", 10, 50);
    lab.placeAt("jk", 120, 30);
    lab.placeAt("led:Q", 240, 30);
    const jk = lab.getSoleJkBlock();
    const j = lab.blocks.find((b) => b.kind === "source" && b.pin === "J");
    const k = lab.blocks.find((b) => b.kind === "source" && b.pin === "K");
    const ledQ = lab.findLedByLabel("Q");
    lab.connectPorts(`${j.id}:out`, `${jk.id}:inJ`);
    lab.connectPorts(`${k.id}:out`, `${jk.id}:inK`);
    lab.connectPorts(`${jk.id}:outQ`, `${ledQ.id}:in`);
    Level4.primeLab(lab);
    j.value = 1;
    k.value = 0;

    const first = Level4.afterJkPulse(lab, jk.id);
    expect(first.pulseResult?.achieved).toEqual([1]);

    j.value = 0;
    k.value = 0;
    const second = Level4.afterJkPulse(lab, jk.id);
    expect(second.pulseResult?.isFailed).toBe(true);
    expect(second.ok).toBe(false);
  });
});

describe("Level5", () => {
  beforeEach(() => {
    Level5.resetProgress();
    Level5.setupLab();
  });

  it("expectedF matches (AB)+(A'C)+(BC)", () => {
    expect(Level5.expectedF(0, 0, 1)).toBe(1);
    expect(Level5.expectedF(1, 0, 0)).toBe(0);
  });

  it("checkLab returns pin error without ABC sources", () => {
    const lab = new CircuitLab();
    const r = Level5.checkLab(lab);
    expect(r.ok).toBe(false);
  });

  it("rejects a constant-high LED even after every minterm is logged", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("in:B", 10, 40);
    lab.placeAt("in:C", 10, 70);
    lab.placeAt("high", 100, 40);
    lab.placeAt("led:F", 200, 40);
    const high = lab.blocks.find((b) => b.kind === "source" && !b.pin);
    const f = lab.findLedByLabel("F");
    lab.connectPorts(`${high.id}:out`, `${f.id}:in`);
    const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
    const pinC = lab.blocks.find((b) => b.kind === "source" && b.pin === "C");
    let res;
    for (const combo of ["001", "011", "110", "111"]) {
      pinA.value = parseInt(combo[0], 10);
      pinB.value = parseInt(combo[1], 10);
      pinC.value = parseInt(combo[2], 10);
      res = Level5.checkLab(lab);
    }
    expect(res.ok).toBe(false);
    expect(res.truthFail).toBe(true);
  });
});
