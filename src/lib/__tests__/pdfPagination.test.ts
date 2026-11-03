import { describe, expect, it } from "vitest";
import { getPdfPageSlices } from "../pdfPagination";

describe("PDF pagination", () => {
  it("keeps a short invoice on one page", () => {
    expect(getPdfPageSlices(800, 1000)).toEqual([{ start: 0, height: 800 }]);
  });

  it("does not add a blank page for exact page multiples", () => {
    expect(getPdfPageSlices(2000, 1000)).toEqual([
      { start: 0, height: 1000 }, { start: 1000, height: 1000 },
    ]);
  });

  it("keeps line items and totals together where they fit", () => {
    expect(getPdfPageSlices(2300, 1000, [
      { start: 900, end: 1100 }, { start: 1800, end: 2100 },
    ])).toEqual([
      { start: 0, height: 900 },
      { start: 900, height: 900 },
      { start: 1800, height: 500 },
    ]);
  });

  it("handles overlapping blocks regardless of their order", () => {
    expect(getPdfPageSlices(1800, 1000, [
      { start: 700, end: 850 }, { start: 800, end: 1100 },
    ])[0]).toEqual({ start: 0, height: 700 });
  });

  it("splits an oversized block without dropping or repeating pixels", () => {
    const pages = getPdfPageSlices(5201, 1000, [{ start: 100, end: 5100 }]);
    expect(pages.reduce((sum, page) => sum + page.height, 0)).toBe(5201);
    pages.forEach((page, index) => {
      expect(page.height).toBeGreaterThan(0);
      expect(page.height).toBeLessThanOrEqual(1000);
      if (index) expect(page.start).toBe(pages[index - 1].start + pages[index - 1].height);
    });
  });

  it("rounds source pixels consistently and rejects invalid dimensions", () => {
    expect(getPdfPageSlices(1001, 1000.9, [{ start: 999.9, end: 1001 }]))
      .toEqual([{ start: 0, height: 999 }, { start: 999, height: 2 }]);
    for (const [height, capacity] of [[0, 1000], [1000, 0], [NaN, 1000], [1, Infinity]]) {
      expect(() => getPdfPageSlices(height, capacity)).toThrow("Invalid PDF page dimensions");
    }
  });
});
