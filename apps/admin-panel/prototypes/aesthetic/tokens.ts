// PROTOTYPE (#24): each direction's colour tokens, and the WCAG contrast checks run on them.
import { STATUSES, STATUS_LABELS, type Status } from "./data";

export type Mode = "light" | "dark";

export type Palette = {
  /** Page background. */
  bg: string;
  /** Cards, table, drawer. */
  surface: string;
  ink: string;
  muted: string;
  rule: string;
  /** The primary button's fill, and text on it. */
  primary: string;
  onPrimary: string;
  /** The direction's second colour, used as text: service numbers, links. */
  accent: string;
  focus: string;
};

export type StatusColour = { fg: string; bg: string };

export type Tokens = {
  palettes: Record<Mode, Palette>;
  statuses: Record<Mode, Record<Status, StatusColour>>;
};

export const WORKBENCH: Tokens = {
  palettes: {
    light: {
      bg: "#ECEEEC",
      surface: "#FFFFFF",
      ink: "#1C2124",
      muted: "#545D63",
      rule: "#C4CACC",
      primary: "#F5C400",
      onPrimary: "#1C2124",
      accent: "#1C2124",
      focus: "#1C2124",
    },
    dark: {
      bg: "#1A1E21",
      surface: "#23282C",
      ink: "#ECEEEC",
      muted: "#A3ACB2",
      rule: "#3C4449",
      primary: "#F5C400",
      onPrimary: "#1C2124",
      accent: "#F5C400",
      focus: "#F5C400",
    },
  },
  statuses: {
    light: {
      RECEIVED: { fg: "#FFFFFF", bg: "#2F5D8A" },
      IN_PROGRESS: { fg: "#1C2124", bg: "#F5C400" },
      COMPLETED: { fg: "#FFFFFF", bg: "#2B7549" },
      DELIVERED: { fg: "#FFFFFF", bg: "#5B646A" },
      CANCELLED: { fg: "#FFFFFF", bg: "#B3261E" },
    },
    dark: {
      RECEIVED: { fg: "#0F1B26", bg: "#6FA8DC" },
      IN_PROGRESS: { fg: "#1C2124", bg: "#F5C400" },
      COMPLETED: { fg: "#0D2216", bg: "#5CC487" },
      DELIVERED: { fg: "#1C2124", bg: "#B8C0C5" },
      CANCELLED: { fg: "#2A0B08", bg: "#F07B72" },
    },
  },
};

export const CARBON: Tokens = {
  palettes: {
    light: {
      bg: "#F4F6FB",
      surface: "#FFFFFF",
      ink: "#1E2340",
      muted: "#565D7A",
      rule: "#D3D8EA",
      primary: "#2D3FA0",
      onPrimary: "#FFFFFF",
      accent: "#B8222B",
      focus: "#2D3FA0",
    },
    dark: {
      bg: "#141833",
      surface: "#1C2142",
      ink: "#E8EAF6",
      muted: "#A6ACCB",
      rule: "#343B66",
      primary: "#A9B5FF",
      onPrimary: "#141833",
      accent: "#FF8A8F",
      focus: "#A9B5FF",
    },
  },
  statuses: {
    light: {
      RECEIVED: { fg: "#2D3FA0", bg: "#E9ECFA" },
      IN_PROGRESS: { fg: "#8A4F00", bg: "#FBF0DC" },
      COMPLETED: { fg: "#1D6B36", bg: "#E3F3E8" },
      DELIVERED: { fg: "#4B5070", bg: "#ECEDF3" },
      CANCELLED: { fg: "#A3172A", bg: "#FBE6E8" },
    },
    dark: {
      RECEIVED: { fg: "#B3BEFF", bg: "#26306A" },
      IN_PROGRESS: { fg: "#F2C46D", bg: "#3A3220" },
      COMPLETED: { fg: "#7FD9A0", bg: "#1D3A33" },
      DELIVERED: { fg: "#C3C7E0", bg: "#2A2F52" },
      CANCELLED: { fg: "#FF9AA6", bg: "#42213A" },
    },
  },
};

export const CIRCUIT: Tokens = {
  palettes: {
    light: {
      bg: "#EDF3EF",
      surface: "#FFFFFF",
      ink: "#10241B",
      muted: "#4A6156",
      rule: "#CCDBD2",
      primary: "#0E6B43",
      onPrimary: "#FFFFFF",
      accent: "#9A5824",
      focus: "#0E6B43",
    },
    dark: {
      bg: "#0C1F17",
      surface: "#132A20",
      ink: "#E6F2EC",
      muted: "#9DB8AB",
      rule: "#26473A",
      primary: "#E6A46D",
      onPrimary: "#0C1F17",
      accent: "#56D39B",
      focus: "#E6A46D",
    },
  },
  statuses: {
    light: {
      RECEIVED: { fg: "#1F5A8C", bg: "#E2EEF8" },
      IN_PROGRESS: { fg: "#8A5300", bg: "#FAEED8" },
      COMPLETED: { fg: "#0E6B43", bg: "#DDF1E6" },
      DELIVERED: { fg: "#4A6156", bg: "#E6ECE8" },
      CANCELLED: { fg: "#A42A2A", bg: "#F8E3E1" },
    },
    dark: {
      RECEIVED: { fg: "#8CC4F2", bg: "#16324A" },
      IN_PROGRESS: { fg: "#F2BE6B", bg: "#3A2E14" },
      COMPLETED: { fg: "#6EE0A8", bg: "#123D2A" },
      DELIVERED: { fg: "#B5C8BE", bg: "#22362D" },
      CANCELLED: { fg: "#FF9C92", bg: "#46201D" },
    },
  },
};

export const TOKENS = { A: WORKBENCH, B: CARBON, C: CIRCUIT };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Check = { label: string; fg: string; bg: string; ratio: number; min: number };

/** Every text pair (4.5:1) and non-text pair (3:1) a direction uses, in one mode. */
export function checks(tokens: Tokens, mode: Mode): Check[] {
  const p = tokens.palettes[mode];
  const pairs: [string, string, string, number][] = [
    ["Text on page", p.ink, p.bg, 4.5],
    ["Text on surface", p.ink, p.surface, 4.5],
    ["Muted text on page", p.muted, p.bg, 4.5],
    ["Muted text on surface", p.muted, p.surface, 4.5],
    ["Primary button text", p.onPrimary, p.primary, 4.5],
    ["Accent text on surface", p.accent, p.surface, 4.5],
    ["Accent text on page", p.accent, p.bg, 4.5],
    ["Focus ring on surface", p.focus, p.surface, 3],
    ...STATUSES.map((status): [string, string, string, number] => [
      STATUS_LABELS[status],
      tokens.statuses[mode][status].fg,
      tokens.statuses[mode][status].bg,
      4.5,
    ]),
  ];
  return pairs.map(([label, fg, bg, min]) => ({ label, fg, bg, min, ratio: contrast(fg, bg) }));
}
