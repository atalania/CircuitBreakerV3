import { describe, it, expect, vi } from "vitest";
import { randomFallbackChallenge, validateTruthTable } from "./endlessChallenges.js";

describe("validateTruthTable", () => {
  it("returns false for non-objects or missing rows", () => {
    expect(validateTruthTable(null)).toBe(false);
    expect(validateTruthTable(undefined)).toBe(false);
    expect(validateTruthTable("x")).toBe(false);
    expect(validateTruthTable({ "000": { F: 0 } })).toBe(false);
  });

  it("returns false when any F is not 0 or 1", () => {
    expect(
      validateTruthTable({
        "000": { F: 0 },
        "001": { F: 1 },
        "010": { F: 1 },
        "011": { F: 2 },
        "100": { F: 0 },
        "101": { F: 0 },
        "110": { F: 0 },
        "111": { F: 0 },
      })
    ).toBe(false);
  });

  it("returns true for a complete 3-bit truth table", () => {
    const table = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          table[`${a}${b}${c}`] = { F: (a ^ b ^ c) & 1 };
        }
      }
    }
    expect(validateTruthTable(table)).toBe(true);
  });
});

describe("randomFallbackChallenge", () => {
  it("returns a challenge from the pool with a valid table", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const ch = randomFallbackChallenge();
    expect(ch.title).toBeTruthy();
    expect(ch.objective).toBeTruthy();
    expect(validateTruthTable(ch.table)).toBe(true);
    vi.restoreAllMocks();
  });
});
