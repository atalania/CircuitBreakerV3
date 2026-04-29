import { describe, it, expect } from "vitest";
import { CircuitLab } from "../modules/circuitLab.js";
import { ensureInputPins, evaluateWithPins, ledIdForLabel } from "./labLevelUtils.js";

describe("ensureInputPins", () => {
  it("returns null when all required pins exist", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    lab.placeAt("in:B", 0, 0);
    expect(ensureInputPins(lab, ["A", "B"])).toBeNull();
  });

  it("returns an error when a pin is missing", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    const err = ensureInputPins(lab, ["A", "B"]);
    expect(err).toContain("B");
    expect(err).toMatch(/Add an input pin/i);
  });

  it("returns an error when a pin label is duplicated", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 0, 0);
    lab.placeAt("in:A", 0, 0);
    const err = ensureInputPins(lab, ["A"]);
    expect(err).toMatch(/only one/i);
  });
});

describe("ledIdForLabel", () => {
  it("returns the LED block id for a matching label", () => {
    const lab = new CircuitLab();
    lab.placeAt("led:F", 0, 0);
    const led = lab.findLedByLabel("F");
    expect(ledIdForLabel(lab, "F")).toBe(led?.id ?? null);
    expect(ledIdForLabel(lab, "f")).toBe(led?.id ?? null);
  });

  it("returns null when no LED has that label", () => {
    const lab = new CircuitLab();
    lab.placeAt("led:Q", 0, 0);
    expect(ledIdForLabel(lab, "F")).toBeNull();
  });
});

describe("evaluateWithPins", () => {
  it("drives a wired LED from named input pins", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("led:F", 100, 10);
    const src = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const led = lab.blocks.find((b) => b.kind === "led");
    expect(src && led).toBeTruthy();
    lab.connectPorts(`${src.id}:out`, `${led.id}:in`);

    const r0 = evaluateWithPins(lab, { A: 0 });
    expect(r0.outputs[led.id]).toBe(0);

    const r1 = evaluateWithPins(lab, { A: 1 });
    expect(r1.outputs[led.id]).toBe(1);
  });

  it("restores original source pin values after evaluation", () => {
    const lab = new CircuitLab();
    lab.placeAt("in:A", 10, 10);
    lab.placeAt("in:B", 10, 50);
    const a = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
    const b = lab.blocks.find((bl) => bl.kind === "source" && bl.pin === "B");
    a.value = 1;
    b.value = 0;
    evaluateWithPins(lab, { A: 0, B: 1 });
    expect(a.value).toBe(1);
    expect(b.value).toBe(0);
  });
});
