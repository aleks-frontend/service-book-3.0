# Implementation plan

The full phase 1 spec is [issue #1](https://github.com/aleks-frontend/service-book-3.0/issues/1). Work is split into tracer-bullet tickets (#2–#18). Each one cuts through schema, API, UI and tests, and is demoable on its own. Blocking edges are tracked as GitHub issue dependencies.

Vocabulary is in [`GLOSSARY.md`](./GLOSSARY.md), the stack is in [`techstack.md`](./techstack.md), and decisions are in [`docs/adr/`](./docs/adr).

## Phase 1: parity with the old app, plus login

**Status: done.** Every ticket below is closed. The cutover (#18) finished on 2026-10-20, and the spec (#1) was closed on 2026-10-23.

### Goals

- Every feature of the old Firebase app works in the new app, with all historical data imported.
- Staff members must log in. There is no public sign-up.
- Fix these known bugs from the old app:
  - Totals = Σ quantity × unit price over all service lines (sale lines included); earnings sum the totals.
  - RSD everywhere.
  - Remove the non-working title sort.
  - Handle the Delivered status.
  - Fix the device in-use check.
- A modernised UI built from bakery-mono components:
  - **Services list:** infinite scroll, a table/cards toggle, an "Add" modal, and a `?service=` drawer with Details, Log and Customer report tabs.
  - **Customers and Devices:** paged tables with history drawers. Devices also support bulk delete.

### Tickets

| # | Ticket | Blocked by | Who |
|---|---|---|---|
| #2 | Project docs: techstack, implementation plan, glossary, ADRs | — | agent |
| #3 | Walking skeleton: login into an empty authenticated admin shell | — | agent |
| #4 | Deploy to Railway on servis.lisztrapszodia.in.rs | #3 | human |
| #5 | Customers: paged table, create/edit, drawer | #3 | agent |
| #6 | Actions: price list management | #3 | agent |
| #7 | Devices: owned and generic devices | #5 | agent |
| #8 | Services core: create modal, infinite list, `?service=` drawer | #5, #7 | agent |
| #9 | Service lines (WORK/SALE) and totals | #6, #8 | agent |
| #10 | Statuses and internal Log | #8 | agent |
| #11 | Services search, status filter and sort | #10 | agent |
| #12 | History drawers and in-use protection | #9 | agent |
| #13 | Settings: company identity | #3 | agent |
| #14 | Intake receipt PDF with public QR | #9, #13 | agent |
| #15 | Customer report tab and service report PDF | #14 | agent |
| #16 | Statistics: earnings and status counts | #9, #10 | agent |
| #17 | Legacy Firebase import (dry-run + idempotent write) | #9, #10 | agent |
| #18 | Cutover to servis.lisztrapszodia.in.rs | #4, #11, #12, #15, #16, #17 | human |

### Suggested order

1. #2 and #3 (in parallel).
2. #4, #5, #6 and #13 (in parallel, once #3 is done).
3. #7 → #8 → #9 and #10.
4. #11, #12, #14, #16 and #17.
5. #15.
6. #18.

### Follow-ups after parity

These came up during and after phase 1 and are all closed:

- **Search and lists:** phone search ignores formatting (#19), customer search matches each word separately (#26), and the actions table is paged (#25).
- **Bulk delete** for customers and actions (#20).
- **Drawers:** one shared drawer shell (#21), and stacked drawers with a back button, close-all and visible edges (#34, #35).
- **Document prompts:** the intake receipt is offered when a service is created (#23, #27, #28). A setting to turn the prompts off was declined (#29).
- **Visual identity:** a direction was prototyped and picked (#24), then applied: tokens, light and dark themes, logo, favicon (#31).
- **Service cards and drawer:** cards lead with the customer and device (#32), and the drawer shows the public link (#33).
- **Log first, then the customer report (#42):** the drawer tabs follow the work, Details · Work log · Customer report, and the log says it is internal (#43). Completing a service opens a completion dialog, replacing the service report prompt: it asks for the customer report, prefilled with the saved one, then saves it and generates the service report (#44). It warns before generating with an empty report (#45) and shows the log's staff notes for reference (#46).

### Legacy import mapping (summary)

This is a summary; the authoritative rules are in #17.

| Firebase | New model |
|---|---|
| `customers/*` | Customer, keeping the legacy ID. Placeholder phones are imported as they are. |
| `devices/*` | Device. `manufacturer` and `model` are copied (runs of spaces made single), `serial` becomes the serial number and `title` the description; the stored `name` is dropped (the label is derived), and names other than manufacturer + model, optionally followed by the serial in any form, are reported. Placeholder manufacturers (e.g. "N/A", "NA", "-") are reported. It is owned when attached to exactly one customer's services, and generic when attached under several customers, only ever sold, or never used. `isNewDevice` is not stored: references are routed by array (`devices` → attached, `newDevices` → sale lines), and references that disagree with the flag are reported. |
| `actions/*` | Action. Numeric names are stringified. |
| `services/*.customers[0]` / `devices[]` | The service's customer / its attached devices |
| `services/*.status` | `shipped` → Delivered, `completed` → Completed, `received` → Received; anything else is reported and imported as Received |
| `services/*.actions[]` | Work lines (string prices and quantities are coerced to integers; fractions are rounded and reported) |
| `services/*.newDevices[]` | Sale lines |
| `services/*.remark` | Legacy-remark log entry, dated with the legacy timestamp. The `title` field of some 2019 services becomes one too, and is reported. |
| `services/*.date` (ms) | Service date, the day in Serbia. The Firebase key (the creation timestamp) is kept as the legacy ID. Services are numbered in date order per year from the counters, so the counters end past them; on a re-run, imported services keep their numbers and new ones follow the year's last number. |
| top-level `"false"` key | Skipped and reported |

Empty-string arrays are treated as empty. Public tokens are generated freshly. The import supports `--dry-run`, and re-running it upserts by legacy ID.

### Cutover checklist (#18)

`scripts/cutover.sh` walks through these steps.

1. Announce a cutover window and freeze writes in the old app.
2. Take the final Firebase export, then run the import in dry-run against production and review the report.
3. Run the real import, then spot-check counts, sample services and totals against the old app.
4. Delete the test service "Test za novi app".
5. Staff members start using `https://servis.lisztrapszodia.in.rs`.
6. Lock the Firebase rules so they deny all reads and writes.
7. Watch Sentry for the first days.
8. The owner deactivates `sb.lisztrapszodia.in.rs` when ready. Nothing in this project touches that subdomain or its DNS.

## Phase 2+: after parity (roadmap)

These are roughly in order. Each will get its own spec and tickets. Items 2 and 3 are done; item 4 is being specced next.

1. **Customer page:** a dedicated customer detail page with full service history.
2. ~~**Public status page**~~ **(done, #22):** a read-only `/s/<publicToken>` page showing status, service lines and the customer report. The QR codes on intake receipts and service reports printed in phase 1 point here.
3. ~~**Service photos**~~ **(done, #36; slices #37–#40):** photos on log notes, stored in a private Cloudflare R2 bucket and served to staff through short-lived links. Notes show thumbnails, the service drawer has a Photos strip and a lightbox, the create form has a "Condition at intake" section, and deleting a photo or a service cleans up storage. Photos stay internal: they never appear on the public status page or the documents.
   - **Note composer** **(done, #47; slices #48–#51):** in the Work log and the intake note, a note's photos sit inside the note's box, with a Photos button and a counter such as 3/10. Photos can be picked, pasted into the text or dragged onto the box, and all three ways shrink them and count them towards the 10-photo limit. A file dropped anywhere else is no longer opened by the browser.
4. **Device photos.** These can reuse `PhotoStorage` and the lightbox from service photos.
5. **Device extras** beyond the serial number, which phase 1 already stores (still to be discussed).
6. **Barcode/QR camera scanning**.
7. **Richer status workflows.**

Explicitly out of scope for now:
- roles and permissions
- self-service sign-up and email password reset
- multi-tenancy inside one deployment
- currencies other than RSD
- support for old Firebase-era QR codes or URLs
