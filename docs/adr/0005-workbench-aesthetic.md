# Workbench: the admin panel's aesthetic

## Context

The admin panel used stock shadcn styling: a default blue primary, slate greys, the system font stack, light mode only, and lucide's `Wrench` as its logo. #24 prototyped three directions on the branch `prototype/24-aesthetic-directions`, kept there as the primary source: Workbench (repair tags and workshop floor markings), Carbon copy (the duplicate receipt book) and Circuit (a circuit board). Triage had already decided on light and dark palettes with a theme toggle, PDFs that stay light and ink-light, and a brand that a shop's uploaded logo does not change.

## Decision

The owner picked **Workbench**. It is dense, flat and table-first, and its yellow is borrowed from workshop floor markings and repair tags. The panel is used all day at a counter to find a service, change its status and print its documents, and Workbench fits the most services on screen with the fewest distractions. Its yellow has one job: it marks what needs action.

- **Type:** Big Shoulders Display (600–800) for headings and service numbers, and Archivo (400–700) for everything else. Both have latin-ext glyphs for č ć đ š ž ő ű.
- **Palettes:**

  | Token                       | Light                 | Dark                  |
  | --------------------------- | --------------------- | --------------------- |
  | Page                        | `#ECEEEC`             | `#1A1E21`             |
  | Surface                     | `#FFFFFF`             | `#23282C`             |
  | Ink                         | `#1C2124`             | `#ECEEEC`             |
  | Muted text                  | `#545D63`             | `#A3ACB2`             |
  | Rule                        | `#C4CACC`             | `#3C4449`             |
  | Primary (fill) / text on it | `#F5C400` / `#1C2124` | `#F5C400` / `#1C2124` |
  | Accent text, focus          | `#1C2124`             | `#F5C400`             |
  | Header bar                  | `#1C2124`             | `#23282C`             |

  Yellow is only a fill in light mode, never text: on white it reaches only 1.6:1.

- **Status colours:** solid tags (fill / text). Every pair passes WCAG AA (4.5:1).

  | Status      | Light                 | Dark                  |
  | ----------- | --------------------- | --------------------- |
  | Received    | `#2F5D8A` / `#FFFFFF` | `#6FA8DC` / `#0F1B26` |
  | In progress | `#F5C400` / `#1C2124` | `#F5C400` / `#1C2124` |
  | Completed   | `#2B7549` / `#FFFFFF` | `#5CC487` / `#0D2216` |
  | Delivered   | `#5B646A` / `#FFFFFF` | `#B8C0C5` / `#1C2124` |
  | Cancelled   | `#B3261E` / `#FFFFFF` | `#F07B72` / `#2A0B08` |

- **Shape:** a 2px radius everywhere, and no shadows: depth comes from 1px rules, the ink header bar with its 4px yellow edge, and a dark scrim behind the drawer. A 4px spacing grid; 40px table rows. Cards are repair tags, with a notched end and a punched hole.
- **Motion:** fast and mechanical. The drawer slides in from the right in 160ms with a sharp ease-out, dialogs fade in over 80ms with no scale, and a row whose status changes flashes its yellow edge once (300ms). Reduced motion turns all of it off.
- **Logo:** a repair tag with a notched end, a punched hole and three lines, in yellow with an ink outline. It replaces lucide's `Wrench` and reads on both light and dark backgrounds. The final SVGs and favicon are #31's.
- **PDFs:** they stay white and ink-light, with no bands or tinted boxes. They use Archivo text, the service number in Big Shoulders, a 2pt ink rule under the header with the yellow tag logo beside it, and status as plain bold text.

## Consequences

- #31 replaces the shadcn tokens in `src/index.css` with these values, adds the dark token set and the theme toggle, and loads the two fonts.
- The PDFs need Archivo and Big Shoulders TTFs registered with `@react-pdf/renderer` in place of Noto Sans, and `documents/theme.ts` drops its accent band and tinted card.
- The rejected directions, their palettes and the contrast checker stay on the prototype branch and are never merged.
