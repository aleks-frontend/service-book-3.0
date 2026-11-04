import { describe, expect, it } from "vitest";
import { fitPhotoStrip } from "../src/lib/photoStrip";

// 72 px tiles 8 px apart: n tiles take 80n − 8 px.
const fit = (width: number, count: number) => fitPhotoStrip({ width, tile: 72, gap: 8, count });

describe("fitPhotoStrip", () => {
  it("shows every photo when they fit exactly", () => {
    expect(fit(392, 5)).toEqual({ shown: 5, hidden: 0 });
  });

  it("shows every photo when there is room to spare", () => {
    expect(fit(392, 3)).toEqual({ shown: 3, hidden: 0 });
  });

  it("gives the +N tile a slot when one photo too many: +2", () => {
    expect(fit(392, 6)).toEqual({ shown: 4, hidden: 2 });
  });

  it("shows the newest that fit beside the +N tile when far more than fit", () => {
    expect(fit(392, 26)).toEqual({ shown: 4, hidden: 22 });
    // Just short of room for a sixth tile.
    expect(fit(471, 26)).toEqual({ shown: 4, hidden: 22 });
  });

  it("shows a single photo", () => {
    expect(fit(392, 1)).toEqual({ shown: 1, hidden: 0 });
  });

  it("shows nothing with no photos", () => {
    expect(fit(392, 0)).toEqual({ shown: 0, hidden: 0 });
  });

  it("always shows at least one photo, even too narrow for two tiles", () => {
    expect(fit(100, 3)).toEqual({ shown: 1, hidden: 2 });
    expect(fit(0, 3)).toEqual({ shown: 1, hidden: 2 });
    expect(fit(0, 1)).toEqual({ shown: 1, hidden: 0 });
  });
});
