export interface PdfKeepTogetherRange {
  start: number;
  end: number;
}

export interface PdfPageSlice {
  start: number;
  height: number;
}

/** Partition every source pixel exactly once, moving breaks before rows where possible. */
export function getPdfPageSlices(
  totalHeight: number,
  pageHeight: number,
  keepTogether: PdfKeepTogetherRange[] = []
): PdfPageSlice[] {
  if (!Number.isFinite(totalHeight) || !Number.isFinite(pageHeight) ||
      totalHeight <= 0 || pageHeight < 1) {
    throw new Error("Invalid PDF page dimensions");
  }

  const height = Math.ceil(totalHeight);
  const capacity = Math.floor(pageHeight);
  const ranges = keepTogether
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end))
    .map(({ start, end }) => ({ start: Math.floor(start), end: Math.ceil(end) }))
    // An oversized row must split, otherwise pagination cannot make progress.
    .filter(({ start, end }) => end > start && end - start <= capacity);
  const pages: PdfPageSlice[] = [];
  let start = 0;

  while (start < height) {
    let end = Math.min(start + capacity, height);
    if (end < height) {
      // Overlapping blocks (for example a line inside a totals panel) may require
      // moving the break backwards more than once.
      let previous: number;
      do {
        previous = end;
        for (const range of ranges) {
          if (range.start > start && range.start < end && range.end > end) {
            end = range.start;
          }
        }
      } while (end < previous);
    }
    pages.push({ start, height: end - start });
    start = end;
  }
  return pages;
}
