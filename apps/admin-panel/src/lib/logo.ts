/**
 * The repair tag (ADR-0005): a notched end, a punched hole and three lines, on
 * a 32×32 grid. The hole is cut out (even-odd), so the tag reads on any
 * background. `public/favicon.svg` draws the same shape; keep the two in sync.
 */
export const TAG_PATH =
  "M3 16 L11 6 H29 V26 H11 Z M14.5 16 a2.75 2.75 0 1 0 -5.5 0 a2.75 2.75 0 1 0 5.5 0 Z";
export const TAG_LINES_PATH = "M17.5 12 H25 M17.5 16 H25 M17.5 20 H22";
