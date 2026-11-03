"use client";

import { getPdfPageSlices, PdfKeepTogetherRange } from "./pdfPagination";

async function waitForFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  await document.fonts.ready;
}

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));

  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        return;
      }

      if ("decode" in image) {
        try {
          await image.decode();
          return;
        } catch {
          return;
        }
      }

      await new Promise<void>((resolve) => {
        const target: HTMLImageElement = image;
        const cleanup = () => {
          target.removeEventListener("load", cleanup);
          target.removeEventListener("error", cleanup);
          resolve();
        };

        target.addEventListener("load", cleanup, { once: true });
        target.addEventListener("error", cleanup, { once: true });
      });
    })
  );
}

export async function generatePDF(element: HTMLElement, filename: string) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");

  await waitForFonts();
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("The invoice could not be rendered for PDF export");
  }

  const pdf = new jsPDF("p", "mm", "a4");
  const margin = 8;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const height = pdf.internal.pageSize.getHeight() - margin * 2;
  const pixelsPerMm = canvas.width / width;
  const bounds = element.getBoundingClientRect();
  const scale = canvas.height / bounds.height;
  const keepTogether: PdfKeepTogetherRange[] = [];
  const addRange = (rect: DOMRect) => {
    if (rect.width > 0 && rect.height > 0) {
      keepTogether.push({
        start: (rect.top - bounds.top) * scale,
        end: (rect.bottom - bounds.top) * scale,
      });
    }
  };

  element.querySelectorAll("[data-pdf-keep-together]").forEach((block) => {
    addRange(block.getBoundingClientRect());
  });
  // Also avoid cutting through individual text lines in long notes or rows
  // that are themselves taller than a page.
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    Array.from(range.getClientRects()).forEach(addRange);
  }

  const pages = getPdfPageSlices(canvas.height, height * pixelsPerMm, keepTogether);
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = canvas.width;
  for (const [index, page] of pages.entries()) {
    pageCanvas.height = page.height;
    const context = pageCanvas.getContext("2d");
    if (!context) throw new Error("PDF canvas is unavailable");
    context.drawImage(
      canvas, 0, page.start, canvas.width, page.height,
      0, 0, canvas.width, page.height
    );
    if (index > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL("image/png"), "PNG", margin, margin,
      width, page.height / pixelsPerMm
    );
  }
  pdf.save(filename);
}
