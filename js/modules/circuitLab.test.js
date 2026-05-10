import { describe, it, expect } from "vitest";
import { CircuitLab, getBlockPins, wirePath } from "./circuitLab.js";

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

describe("CircuitLab.snapshotForAssistant", () => {
  it("summarizes blocks, wires, and input pins", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    const a = lab.blocks[lab.blocks.length - 1];
    a.pin = "A";
    lab.placeAt("and", 100, 10);
    lab.placeAt("led:X", 200, 10);
    const snap = lab.snapshotForAssistant();
    expect(snap.wireCount).toBe(0);
    expect(snap.ledLabels).toContain("X");
    expect(snap.inputPinsOnCanvas).toEqual([{ letter: "A", value: 1 }]);
    expect(snap.blockCounts.source).toBe(1);
    expect(snap.blockCounts.and).toBe(1);
  });
});

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

describe("getBlockPins / wirePath", () => {
  it("returns expected ports for an AND gate", () => {
    const b = { kind: "and", xl: 100, yc: 50 };
    const pins = getBlockPins(b);
    expect(pins.in0 && pins.in1 && pins.out).toBeTruthy();
    expect(pins.out[0]).toBeGreaterThan(pins.in0[0]);
  });

  it("builds an orthogonal polyline between two points", () => {
    const path = wirePath([0, 0], [100, 40]);
    expect(path).toHaveLength(4);
    expect(path[0]).toEqual([0, 0]);
    expect(path[3]).toEqual([100, 40]);
  });
});

describe("CircuitLab lifecycle", () => {
  it("clear removes all blocks and wires", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 0, 0);
    lab.placeAt("led", 50, 0);
    const [hi] = blockByKind(lab, "source");
    const [led] = blockByKind(lab, "led");
    wire(lab, hi, "out", led, "in");
    lab.clear();
    expect(lab.blocks.length).toBe(0);
    expect(lab.wires.length).toBe(0);
  });

  it("removeBlock drops incident wires", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 0, 0);
    lab.placeAt("led", 50, 0);
    const [hi] = blockByKind(lab, "source");
    const [led] = blockByKind(lab, "led");
    wire(lab, hi, "out", led, "in");
    lab.removeBlock(hi.id);
    expect(lab.wires.length).toBe(0);
    expect(lab.blocks.some((b) => b.id === hi.id)).toBe(false);
  });

  it("removeWire removes one connection only", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 0, 0);
    lab.placeAt("led", 50, 0);
    const [hi] = blockByKind(lab, "source");
    const [led] = blockByKind(lab, "led");
    wire(lab, hi, "out", led, "in");
    const wid = lab.wires[0].id;
    expect(lab.removeWire(wid)).toBe(true);
    expect(lab.wires.length).toBe(0);
    expect(lab.removeWire("nope")).toBe(false);
  });
});

describe("CircuitLab SR latch", () => {
  it("sets Q high when S=1 and R=0, and flags srInvalid when S=R=1", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("sr", 120, 30);
    lab.placeAt("led", 220, 30);
    const [hi, lo] = blockByKind(lab, "source");
    const [sr] = blockByKind(lab, "sr");
    const [led] = blockByKind(lab, "led");
    wire(lab, hi, "out", sr, "inS");
    wire(lab, lo, "out", sr, "inR");
    wire(lab, sr, "outQ", led, "in");

    expect(lab.evaluate({}).outputs[led.id]).toBe(1);
    expect(lab.evaluate({}).srInvalid).toBe(false);

    lab.clear();
    lab.placeAt("high", 10, 10);
    lab.placeAt("high", 10, 50);
    lab.placeAt("sr", 120, 30);
    lab.placeAt("led", 220, 30);
    const [s0, s1] = blockByKind(lab, "source");
    const [sr2] = blockByKind(lab, "sr");
    const [led2] = blockByKind(lab, "led");
    wire(lab, s0, "out", sr2, "inS");
    wire(lab, s1, "out", sr2, "inR");
    wire(lab, sr2, "outQ", led2, "in");
    const r = lab.evaluate({});
    expect(r.srInvalid).toBe(true);
    expect(r.outputs[led2.id]).toBe(0);
  });

  it("does not wipe SR memory on illegal S=R=1 — returns to HOLD with prior Q", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("sr", 140, 30);
    const sources = lab.blocks.filter((b) => b.kind === "source");
    const hiB = sources.find((b) => b.label === "1");
    const loB = sources.find((b) => b.label === "0");
    const sr = lab.blocks.find((b) => b.kind === "sr");
    expect(hiB && loB && sr).toBeTruthy();
    lab.connectPorts(`${hiB.id}:out`, `${sr.id}:inS`);
    lab.connectPorts(`${loB.id}:out`, `${sr.id}:inR`);
    lab.evaluate({});
    expect(sr._q).toBe(1);

    lab.connectPorts(`${hiB.id}:out`, `${sr.id}:inR`);
    const illegal = lab.evaluate({});
    expect(illegal.srInvalid).toBe(true);
    expect(sr._q).toBe(1);
    expect(sr._qbar).toBe(0);

    lab.connectPorts(`${loB.id}:out`, `${sr.id}:inS`);
    lab.connectPorts(`${loB.id}:out`, `${sr.id}:inR`);
    lab.evaluate({});
    expect(sr._q).toBe(1);
    expect(sr._qbar).toBe(0);
  });
});

describe("CircuitLab JK pulseJk", () => {
  it("sets Q=1 when J=1 and K=0 after a clock pulse", () => {
    const lab = new CircuitLab();
    lab.placeAt("high", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("jk", 120, 30);
    const [hi, lo] = blockByKind(lab, "source");
    const [jk] = blockByKind(lab, "jk");
    wire(lab, hi, "out", jk, "inJ");
    wire(lab, lo, "out", jk, "inK");
    expect(lab.pulseJk(jk.id)).toBe(true);
    expect(jk._q).toBe(1);
    expect(jk._qbar).toBe(0);
  });

  it("returns false for unknown JK id", () => {
    const lab = new CircuitLab();
    expect(lab.pulseJk("missing")).toBe(false);
  });

  it("samples J via an upstream NOT gate (combinational logic settles before clock)", () => {
    const lab = new CircuitLab();
    lab.placeAt("low", 10, 10);
    lab.placeAt("low", 10, 50);
    lab.placeAt("not", 80, 10);
    lab.placeAt("jk", 200, 30);
    const sources = blockByKind(lab, "source");
    const lowJ = sources[0];
    const lowK = sources[1];
    const [gnot] = blockByKind(lab, "not");
    const [jk] = blockByKind(lab, "jk");
    wire(lab, lowJ, "out", gnot, "in");
    wire(lab, gnot, "out", jk, "inJ");
    wire(lab, lowK, "out", jk, "inK");

    expect(lab.pulseJk(jk.id)).toBe(true);
    expect(jk._q).toBe(1);
  });
});

describe("CircuitLab.toggleSource", () => {
  it("toggles a labeled input pin value", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    const [src] = blockByKind(lab, "source");
    expect(src.value).toBe(0);
    expect(lab.toggleSource(src.id)).toBe(true);
    expect(src.value).toBe(1);
    expect(lab.toggleSource("nope")).toBe(false);
  });
});
