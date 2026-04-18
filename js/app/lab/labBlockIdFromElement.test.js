import { describe, it, expect } from "vitest";
import { labBlockIdFromElement } from "./labBlockIdFromElement.js";

/**
 * @param {any} g
 * @returns {{ closest: (sel: string) => any }}
 */
function withClosest(g) {
  return { closest: () => g };
}

describe("labBlockIdFromElement", () => {
  it("returns null when no matching ancestor", () => {
    expect(labBlockIdFromElement(withClosest(null))).toBeNull();
  });

  it("reads JK hit target from dataset", () => {
    const g = {
      classList: { contains: (c) => c === "lab-jk-hit" },
      dataset: { jkId: "lab_jk_3" },
    };
    expect(labBlockIdFromElement(withClosest(g))).toBe("lab_jk_3");
  });

  it("parses gate-, led-, source-, and macro- ids", () => {
    const mk = (id) => ({
      classList: { contains: () => false },
      getAttribute: () => id,
    });
    expect(labBlockIdFromElement(withClosest(mk("gate-lab_and_1")))).toBe("lab_and_1");
    expect(labBlockIdFromElement(withClosest(mk("led-lab_out_2")))).toBe("lab_out_2");
    expect(labBlockIdFromElement(withClosest(mk("source-lab_src_4")))).toBe("lab_src_4");
    expect(labBlockIdFromElement(withClosest(mk("macro-lab_sr_5")))).toBe("lab_sr_5");
  });

  it("returns null for unrecognized id prefixes", () => {
    const g = { classList: { contains: () => false }, getAttribute: () => "other-xyz" };
    expect(labBlockIdFromElement(withClosest(g))).toBeNull();
  });
});
