# PROTOTYPE — aesthetic directions (#24)

Throwaway. Three aesthetic directions for the admin panel, switchable with
`?variant=A|B|C` and `?mode=light|dark` on one page that is not part of the app's
build. Run `npm run prototype:aesthetic` from the repo root.

The brief: a back-office tool for one small repair shop (phones, laptops,
printers) in Serbia, used all day by one or two staff at a counter. Its main
jobs are finding a service fast, changing its status, and printing the intake
receipt and the service report. Data is Serbian and Hungarian, so the fonts
need č ć đ š ž ő ű.

It is its own page, not variants on the real `/services` route, because the
question is a restyle of every token, font and primitive, not one page's
layout, and the issue keeps the prototypes out of the app's routes and
bundle. That is also why the switcher bar needs no production gate: this page
is never part of `vite build`, which only builds `index.html`.

## Plan, first pass

|        | A                | B                    | C                 |
| ------ | ---------------- | -------------------- | ----------------- |
| Idea   | Workshop signage | Paper service book   | Electronics bench |
| Colour | grey + yellow    | cream + brown        | navy + cyan       |
| Type   | condensed sans   | serif display + sans | geometric sans    |
| Layout | top bar, table   | sidebar, cards       | top bar, cards    |

## Review against the brief

- **B, first pass** is the cream, serif and brown look that every generated
  "heritage" page has. What the shop really writes in is a **numbered
  duplicate receipt book**: cool white paper, blue carbon ink, and a serial
  number printed in red at the corner of every slip. B now takes that, which
  is specific to this trade and gives the service number one meaning: it is
  the slip's printed number.
- **C, first pass** (navy + cyan) is the generic tech dashboard. The thing
  every device on the bench has inside it is a **circuit board**: green
  solder mask, copper pads, white silkscreen. C now takes those colours, with
  copper as the accent, not acid green on black.
- **A** is kept, with the yellow taken from workshop floor markings and
  repair tags rather than used as decoration: it marks what needs action (the
  primary button, In progress). The cards become **repair tags** with a
  punched hole.
- All three were also checked against the template tells listed in the
  frontend-design skill: no all-caps eyebrow labels, no meta strings joined
  with middle dots, no monospace data labels, no "→" on buttons, and not one
  radius and one shadow on everything.

## Directions, after review

### A. Workbench

Repair tags and floor markings. Dense, flat, table-first; the counter view.

- Colour, light: paper `#ECEEEC`, surface `#FFFFFF`, ink `#1C2124`, muted
  `#545D63`, rule `#C4CACC`, signal yellow `#F5C400` (fills only, ink on it).
- Colour, dark: `#1A1E21`, `#23282C`, ink `#ECEEEC`, muted `#A3ACB2`, rule
  `#3C4449`, yellow `#F5C400`.
- Type: Big Shoulders Display (headings, service numbers), Archivo (text).
- Layout: a full-width ink top bar with a yellow edge; the toolbar sits on it.
  Table rows are 40px. The cards are tags, notched at the top left with a
  punched hole. The drawer is a flat, hard-edged sheet with an ink header.
- Shape: radius 2px; no shadows, only 1px rules; a 4px spacing grid.
- Statuses: solid tags with a colour block, text in ink or white.

```
████ SB  Services Customers Devices …           [Search……] [+ Add]
──────────────────────────────── yellow ─────────────────────────────
 Number   Date        Customer          Devices         Status   Total
 2026-0142 21 Oct     Dragana Ćirić     Galaxy S21     ▌In prog  4,500
```

### B. Carbon copy

The duplicate receipt book. Calm, paper-like, card-first.

- Colour, light: paper `#F4F6FB`, slip `#FFFFFF`, ink `#1E2340`, carbon
  `#2D3FA0`, numbering red `#B8222B`, muted `#565D7A`, rule `#D3D8EA`.
- Colour, dark: the carbon sheet itself: `#141833`, `#1C2142`, ink `#E8EAF6`,
  carbon `#A9B5FF`, red `#FF8A8F`, muted `#A6ACCB`, rule `#343B66`.
- Type: Zilla Slab (headings, numbers), Libre Franklin (text).
- Layout: a carbon-blue sidebar like the book's spine. Cards are slips with a
  perforated top edge and the number in red at the top right. The table is
  ruled like the book. The drawer is the slip pulled out, with a perforated
  left edge, and the log is written on ruled lines.
- Shape: radius 4px on slips, 0 on the spine; a soft paper shadow under a
  slip, and none on anything else; an 8px grid.
- Statuses: outlined stamps, coloured text and border on a light tint.

```
│▌Service  │  Services                              [▦][≡] [+ Add] │
│▌ book    │  ┌ - - - - - - - - ┐ ┌ - - - - - - - - ┐               │
│ Services │  │          № 0142 │ │          № 0141 │               │
│ Customers│  │ Dragana Ćirić   │ │ Szűcs Ödön      │               │
│ Devices  │  │ [In progress]   │ │ [Received]      │               │
```

### C. Circuit

The board inside every device. Soft, rounded, modern, friendly.

- Colour, light: board `#EDF3EF`, surface `#FFFFFF`, ink `#10241B`, muted
  `#4A6156`, mask green `#0E6B43` (primary), copper `#9A5824`, rule `#CCDBD2`.
- Colour, dark: the bare board: `#0C1F17`, `#132A20`, ink `#E6F2EC`, muted
  `#9DB8AB`, copper `#E6A46D` (primary), mask green `#56D39B`, rule
  `#26473A`.
- Type: Chakra Petch (headings, numbers; squared like silkscreen), Red Hat
  Text (text).
- Layout: a floating, rounded top bar with pill navigation. Cards are
  components: the status is an LED dot that glows in dark mode. The drawer
  floats inset from the screen edges with a large radius.
- Shape: radius 16px on panels, 10px on controls, pills on badges; a soft,
  green-tinted shadow in light mode and none in dark; generous 8px-grid
  spacing.
- Statuses: pills with an LED dot.

```
   ╭───────────────────────────────────────────────────────────╮
   │ ◧ Service Book  (Services) Customers Devices …   [+ Add]  │
   ╰───────────────────────────────────────────────────────────╯
   ╭──────────────╮ ╭──────────────╮ ╭──────────────╮
   │ 2026-0142  ● │ │ 2026-0141  ● │ │ 2026-0140  ● │
   │ Dragana Ćirić│ │ Szűcs Ödön   │ │ Kovács Réka  │
```

## Contrast

Every direction's palette is a typed token set in its own file. The notes
panel in the prototype computes the WCAG contrast of each text pair live and
marks anything under 4.5:1 (text) or 3:1 (non-text).
`npx tsx prototypes/aesthetic/checkContrast.ts` runs the same check and fails
on any miss.
