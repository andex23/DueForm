"use client";

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

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
