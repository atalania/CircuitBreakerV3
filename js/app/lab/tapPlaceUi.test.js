import { describe, expect, it } from "vitest";
import { TAP_MOVE_THRESH2, shouldUseTapPlace } from "./tapPlaceUi.js";

describe("tapPlaceUi", () => {
  it("exports a positive tap threshold", () => {
    expect(TAP_MOVE_THRESH2).toBeGreaterThan(0);
  });

  it("shouldUseTapPlace is boolean in jsdom", () => {
    expect(typeof shouldUseTapPlace()).toBe("boolean");
  });
});
