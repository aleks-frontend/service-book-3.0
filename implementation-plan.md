# Implementation plan

The full phase 1 spec is [issue #1](https://github.com/aleks-frontend/service-book-3.0/issues/1). Work is split into tracer-bullet tickets (#2–#18). Each one cuts through schema, API, UI and tests, and is demoable on its own. Blocking edges are tracked as GitHub issue dependencies.

Vocabulary is in [`GLOSSARY.md`](./GLOSSARY.md), the stack is in [`techstack.md`](./techstack.md), and decisions are in [`docs/adr/`](./docs/adr).

## Phase 1: parity with the old app, plus login

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
  - **Services list:** infinite scroll, a table/cards toggle, an "Add" modal, and a `?service=` drawer with Details, Customer report and Log tabs.
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
| #14 | Dispatch note PDF with public QR | #9, #13 | agent |
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

### Legacy import mapping (summary)

This is a summary; the authoritative rules are in #17.

| Firebase | New model |
|---|---|
| `customers/*` | Customer, keeping the legacy ID. Placeholder phones are imported as they are. |
| `devices/*` | Device. `manufacturer`, `model` and `serialNumber` are copied; `title` becomes the description; the stored `name` is dropped (the label is derived), and names that differ from manufacturer + model are reported. Placeholder manufacturers (e.g. "N/A", "-") are reported. It is owned when used by exactly one customer's services and generic when used by several. `isNewDevice` is not stored: it only tells the import which references become sale lines, and "sold by us" is later derived from sale lines. |
| `actions/*` | Action. Numeric names are stringified. |
| `services/*.customers[0]` / `devices[]` | The service's customer / its attached devices |
| `services/*.status` | `shipped` → Delivered, `completed` → Completed, `received` → Received; anything else is reported |
| `services/*.actions[]` | Work lines (string prices and quantities are coerced to integers) |
| `services/*.newDevices[]` | Sale lines |
| `services/*.remark` | Legacy-remark log entry |
| `services/*.date` (ms) | Service date. The timestamp is kept as the legacy ID, and service numbers are assigned in date order per year, with the per-year counters advanced past them. |
| top-level `"false"` key | Skipped and reported |

Empty-string arrays are treated as empty. Public tokens are generated freshly. The import supports `--dry-run`, and re-running it upserts by legacy ID.

### Cutover checklist (#18)

1. Announce a cutover window and freeze writes in the old app.
2. Take the final Firebase export, then run the import in dry-run against production and review the report.
3. Run the real import, then spot-check counts, sample services and totals against the old app.
4. Delete the test service "Test za novi app".
5. Staff members start using `https://servis.lisztrapszodia.in.rs`.
6. Lock the Firebase rules so they deny all reads and writes.
7. Watch Sentry for the first days.
8. The owner deactivates `sb.lisztrapszodia.in.rs` when ready. Nothing in this project touches that subdomain or its DNS.

## Phase 2+: after parity (roadmap)

These are roughly in order. Each will get its own spec and tickets.

1. **Customer page:** a dedicated customer detail page with full service history.
2. **Public status page:** a read-only `/s/<publicToken>` page showing status, service lines and the customer report. The QR codes on dispatch notes printed in phase 1 already point here.
3. **Service photos:** photos on services and log entries, stored in Cloudflare R2, with thumbnails and a lightbox. Photos of damage at intake are the priority.
4. **Device photos.**
5. **Device extras** beyond the serial number, which phase 1 already stores (still to be discussed).
6. **Barcode/QR camera scanning**.
7. **Richer status workflows.**

Explicitly out of scope for now:
- roles and permissions
- self-service sign-up and email password reset
- multi-tenancy inside one deployment
- currencies other than RSD
- support for old Firebase-era QR codes or URLs
