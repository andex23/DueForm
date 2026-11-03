import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  render: vi.fn(), addPage: vi.fn(), addImage: vi.fn(), save: vi.fn(), drawImage: vi.fn(),
}));
vi.mock("html2canvas-pro", () => ({ default: mocks.render }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addPage = mocks.addPage;
    addImage = mocks.addImage;
    save = mocks.save;
  },
}));
import { generatePDF } from "../generatePDF";

function fixture(height: number) {
  const canvas = { width: 1000, height };
  mocks.render.mockResolvedValue(canvas);
  const element = {
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 500, height: height / 2, top: 0 }),
  } as unknown as HTMLElement;
  return { canvas, element };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal("document", {
    createTreeWalker: () => ({ nextNode: () => null }),
    createRange: () => ({}),
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ drawImage: mocks.drawImage }),
      toDataURL: () => "data:image/png;base64,test",
    }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("PDF export", () => {
  it("writes all slices of a long invoice to separate A4 pages", async () => {
    const { canvas, element } = fixture(3000);
    await generatePDF(element, "long-invoice.pdf");
    expect(mocks.addPage).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenCalledTimes(3);
    const slices = mocks.drawImage.mock.calls;
    expect(slices.map((call) => call[2])).toEqual([0, 1448, 2896]);
    expect(slices.map((call) => call[4])).toEqual([1448, 1448, 104]);
    expect(slices.every((call) => call[0] === canvas)).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith("long-invoice.pdf");
  });

  it("keeps short invoices to one page and rejects failed renders", async () => {
    const { element } = fixture(500);
    await generatePDF(element, "short-invoice.pdf");
    expect(mocks.addPage).not.toHaveBeenCalled();
    expect(mocks.addImage).toHaveBeenCalledTimes(1);
    mocks.render.mockResolvedValue({ width: 0, height: 0 });
    await expect(generatePDF(element, "empty.pdf")).rejects.toThrow("could not be rendered");
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
