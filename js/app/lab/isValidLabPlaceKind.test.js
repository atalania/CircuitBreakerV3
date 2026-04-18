import { describe, it, expect } from "vitest";
import { isValidLabPlaceKind } from "./isValidLabPlaceKind.js";

describe("isValidLabPlaceKind", () => {
  it("rejects empty or unknown kinds", () => {
    expect(isValidLabPlaceKind("")).toBe(false);
    expect(isValidLabPlaceKind(null)).toBe(false);
    expect(isValidLabPlaceKind(undefined)).toBe(false);
    expect(isValidLabPlaceKind("andx")).toBe(false);
    expect(isValidLabPlaceKind("in")).toBe(false);
    expect(isValidLabPlaceKind("in:")).toBe(false);
    expect(isValidLabPlaceKind("led:")).toBe(false);
  });

  it("accepts palette primitives", () => {
    for (const k of ["and", "or", "not", "xor", "nand", "nor", "sr", "jk", "led", "low", "high"]) {
      expect(isValidLabPlaceKind(k), k).toBe(true);
    }
  });

  it("accepts input and labeled LED kinds with non-empty suffix", () => {
    expect(isValidLabPlaceKind("in:A")).toBe(true);
    expect(isValidLabPlaceKind("led:F")).toBe(true);
  });
});
