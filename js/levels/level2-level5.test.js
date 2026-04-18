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

  it("marks sequence failed when second pulse does not match target", () => {
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
});
