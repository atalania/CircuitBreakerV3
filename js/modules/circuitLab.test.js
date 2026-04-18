import { describe, it, expect } from "vitest";
import { CircuitLab } from "./circuitLab.js";

/** @param {CircuitLab} lab */
function blockByKind(lab, kind) {
  return lab.blocks.filter((b) => b.kind === kind);
}

/**
 * @param {CircuitLab} lab
 * @param {{ id: string }} fromB
 * @param {string} fromPort
 * @param {{ id: string }} toB
 * @param {string} toPort
 */
function wire(lab, fromB, fromPort, toB, toPort) {
  lab.connectPorts(`${fromB.id}:${fromPort}`, `${toB.id}:${toPort}`);
}

describe("CircuitLab.evaluate", () => {
  it("returns empty outputs for an empty lab", () => {
    const lab = new CircuitLab();
    const r = lab.evaluate({});
    expect(r.outputs).toEqual({});
    expect(r.srInvalid).toBe(false);
    expect(Object.keys(r.wireStates).length).toBe(0);
  });

  it("propagates constant HIGH through NOT into an LED (1 -> 0)", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("not", 80, 10);
    lab.placeAt("led", 160, 10);
    const [hi] = blockByKind(lab, "source");
    const [gnot] = blockByKind(lab, "not");
    const [led] = blockByKind(lab, "led");
    wire(lab, hi, "out", gnot, "in");
    wire(lab, gnot, "out", led, "in");

    const r = lab.evaluate({});
    expect(r.outputs[led.id]).toBe(0);
  });

  it("evaluates AND from two constant sources into an LED", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("and", 100, 30);
    lab.placeAt("led", 200, 30);
    const sources = blockByKind(lab, "source");
    const hi = sources.find((s) => s.value === 1);
    const lo = sources.find((s) => s.value === 0);
    const [gate] = blockByKind(lab, "and");
    const [led] = blockByKind(lab, "led");
    expect(hi && lo).toBeTruthy();
    wire(lab, hi, "out", gate, "in0");
    wire(lab, lo, "out", gate, "in1");
    wire(lab, gate, "out", led, "in");

    expect(lab.evaluate({}).outputs[led.id]).toBe(0);

    lab.clear();
    lab.placeAt("high", 10, 10);
    lab.placeAt("high", 10, 50);
    lab.placeAt("and", 100, 30);
    lab.placeAt("led", 200, 30);
    const [s0, s1] = blockByKind(lab, "source");
    const [g2] = blockByKind(lab, "and");
    const [led2] = blockByKind(lab, "led");
    wire(lab, s0, "out", g2, "in0");
    wire(lab, s1, "out", g2, "in1");
    wire(lab, g2, "out", led2, "in");
    expect(lab.evaluate({}).outputs[led2.id]).toBe(1);
  });

  it("evaluates OR, XOR, NAND, and NOR for representative inputs", () => {
    const cases = [
      {
        kind: "or",
        a: 0,
        b: 0,
        want: 0,
      },
      {
        kind: "or",
        a: 0,
        b: 1,
        want: 1,
      },
      {
        kind: "xor",
        a: 1,
        b: 1,
        want: 0,
      },
      {
        kind: "xor",
        a: 0,
        b: 1,
        want: 1,
      },
      {
        kind: "nand",
        a: 1,
        b: 1,
        want: 0,
      },
      {
        kind: "nand",
        a: 0,
        b: 1,
        want: 1,
      },
      {
        kind: "nor",
        a: 0,
        b: 0,
        want: 1,
      },
      {
        kind: "nor",
        a: 1,
        b: 0,
        want: 0,
      },
    ];

    for (const c of cases) {
      const lab = new CircuitLab();
      lab.placeAt(c.a ? "high" : "low", 10, 10);
      lab.placeAt(c.b ? "high" : "low", 10, 50);
      lab.placeAt(c.kind, 100, 30);
      lab.placeAt("led", 200, 30);
      const [s0, s1] = blockByKind(lab, "source");
      const gate = lab.blocks.find((b) => b.kind === c.kind);
      const [led] = blockByKind(lab, "led");
      expect(gate).toBeTruthy();
      wire(lab, s0, "out", gate, "in0");
      wire(lab, s1, "out", gate, "in1");
      wire(lab, gate, "out", led, "in");
      expect(lab.evaluate({}).outputs[led.id]).toBe(c.want);
    }
  });

  it("returns stable LED outputs when evaluate is called repeatedly", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("and", 100, 30);
    lab.placeAt("led", 200, 30);
    const [s0, s1] = blockByKind(lab, "source");
    const [gate] = blockByKind(lab, "and");
    const [led] = blockByKind(lab, "led");
    wire(lab, s0, "out", gate, "in0");
    wire(lab, s1, "out", gate, "in1");
    wire(lab, gate, "out", led, "in");

    const a = lab.evaluate({}).outputs[led.id];
    const b = lab.evaluate({}).outputs[led.id];
    expect(a).toBe(b);
    expect(a).toBe(0);
  });
});
