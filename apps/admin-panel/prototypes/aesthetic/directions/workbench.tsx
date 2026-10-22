// PROTOTYPE (#24), direction A: Workbench. Repair tags and workshop floor markings.
import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  LogOut,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Table2,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { formatDate, formatRsd, STATUS_LABELS, total, type Service, type Status } from "../data";
import { WORKBENCH, type Mode } from "../tokens";
import {
  NAV,
  openProps,
  StatusControl,
  TABS,
  type Direction,
  type DirectionProps,
  type Tab,
} from "../shared";
import "./workbench.css";

function Logo({ mode, size = 28 }: { mode: Mode; size?: number }) {
  const p = WORKBENCH.palettes[mode];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {/* A repair tag: notched end, punched hole, a string. */}
      <path
        d="M2 16 L10 6 H29 V26 H10 Z"
        fill={p.primary}
        stroke={p.onPrimary}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="16" r="2.6" fill={p.bg} stroke={p.onPrimary} strokeWidth="1.6" />
      <path
        d="M17 12 H25 M17 16 H25 M17 20 H22"
        stroke={p.onPrimary}
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Badge({ status, onChange }: { status: Status; onChange?: (status: Status) => void }) {
  const badge = (
    <span
      className="wb-badge"
      style={{ color: `var(--${status}-fg)`, background: `var(--${status}-bg)` }}
    >
      {STATUS_LABELS[status]}
      {onChange && <ChevronDown size={13} aria-hidden />}
    </span>
  );
  return onChange ? (
    <StatusControl status={status} onChange={onChange}>
      {badge}
    </StatusControl>
  ) : (
    badge
  );
}

function App({ services, view, onView, openId, onOpen, onStatus, changedId }: DirectionProps) {
  const open = services.find((s) => s.id === openId) ?? null;

  return (
    <div className="wb-app">
      <header className="wb-top">
        <div className="wb-brand">
          <Logo mode="dark" />
          <span>Service Book</span>
        </div>
        <nav className="wb-nav">
          {NAV.map((item) => (
            <a key={item} href="#" aria-current={item === "Services" ? "page" : undefined}>
              {item}
            </a>
          ))}
        </nav>
        <div className="wb-user">
          <span>Aleksa</span>
          <button className="wb-btn wb-btn-dark">
            <LogOut size={15} aria-hidden /> Log out
          </button>
        </div>
      </header>

      <main className="wb-main">
        <div className="wb-toolbar">
          <h1>Services</h1>
          <label className="wb-search">
            <Search size={16} aria-hidden />
            <input
              placeholder="Search by number, customer, phone, device or description"
              aria-label="Search services"
            />
          </label>
          <select className="wb-select" aria-label="Filter by status">
            <option>All statuses</option>
          </select>
          <select className="wb-select" aria-label="Sort">
            <option>Newest first</option>
          </select>
          <div className="wb-seg" role="group" aria-label="View">
            <button
              aria-pressed={view === "table"}
              onClick={() => onView("table")}
              aria-label="Table view"
            >
              <Table2 size={16} />
            </button>
            <button
              aria-pressed={view === "cards"}
              onClick={() => onView("cards")}
              aria-label="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <button className="wb-btn wb-btn-primary">
            <Plus size={16} aria-hidden /> Add
          </button>
        </div>

        {view === "table" ? (
          <table className="wb-table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Devices</th>
                <th>Status</th>
                <th className="wb-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id === changedId ? `${s.id}-${s.status}` : s.id}
                  {...openProps(s.id, onOpen)}
                  aria-selected={s.id === openId}
                  data-changed={s.id === changedId || undefined}
                >
                  <td className="wb-number">{s.number}</td>
                  <td className="wb-nowrap">{formatDate(s.date)}</td>
                  <td>
                    {s.customer.name}
                    <span className="wb-muted"> {s.customer.phone}</span>
                  </td>
                  <td>{s.devices.join(", ")}</td>
                  <td>
                    <Badge status={s.status} onChange={(status) => onStatus(s.id, status)} />
                  </td>
                  <td className="wb-num">{formatRsd(total(s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="wb-tags">
            {services.map((s) => (
              <li
                key={s.id === changedId ? `${s.id}-${s.status}` : s.id}
                className="wb-tag"
                data-changed={s.id === changedId || undefined}
                {...openProps(s.id, onOpen)}
              >
                <div className="wb-tag-head">
                  <span className="wb-number wb-tag-number">{s.number}</span>
                  <Badge status={s.status} onChange={(status) => onStatus(s.id, status)} />
                </div>
                <div className="wb-tag-customer">
                  {s.customer.name} <span className="wb-muted">{s.customer.phone}</span>
                </div>
                <div className="wb-tag-devices">{s.devices.join(", ")}</div>
                <div className="wb-tag-foot">
                  <span className="wb-muted">{formatDate(s.date)}</span>
                  <strong className="wb-num">{formatRsd(total(s))}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && (
        <Drawer key={open.id} service={open} onClose={() => onOpen(null)} onStatus={onStatus} />
      )}
    </div>
  );
}

function Drawer({
  service,
  onClose,
  onStatus,
}: {
  service: Service;
  onClose: () => void;
  onStatus: (id: string, status: Status) => void;
}) {
  const [tab, setTab] = useState<Tab>("Details");
  return (
    <>
      <div className="wb-scrim" onClick={onClose} />
      <aside className="wb-drawer" role="dialog" aria-label={`Service ${service.number}`}>
        <header className="wb-drawer-head">
          <div>
            <div className="wb-drawer-title">Service {service.number}</div>
            <div className="wb-drawer-sub">Registered on {formatDate(service.date)}</div>
          </div>
          <div className="wb-drawer-actions">
            <Badge status={service.status} onChange={(status) => onStatus(service.id, status)} />
            <button className="wb-icon" aria-label="Print">
              <Printer size={17} />
            </button>
            <button className="wb-icon" aria-label="Edit service">
              <Pencil size={17} />
            </button>
            <button className="wb-icon" aria-label="Delete service">
              <Trash2 size={17} />
            </button>
            <button className="wb-icon" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <dl className="wb-summary">
          <dt>Customer</dt>
          <dd>
            <a href="#">{service.customer.name}</a>, <a href="#">{service.customer.phone}</a>
          </dd>
          <dt>Devices</dt>
          <dd>{service.devices.join(", ")}</dd>
          <dt>Date</dt>
          <dd>{formatDate(service.date)}</dd>
          <dt>Description</dt>
          <dd>{service.description}</dd>
        </dl>

        <div className="wb-tabs" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="wb-panel">
          {tab === "Details" && (
            <>
              <table className="wb-lines">
                <thead>
                  <tr>
                    <th>Work or sale</th>
                    <th className="wb-num">Qty</th>
                    <th className="wb-num">Unit price</th>
                    <th className="wb-num">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {service.lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        {line.type === "WORK" ? (
                          <Wrench size={14} aria-label="Work" />
                        ) : (
                          <Package size={14} aria-label="Sale" />
                        )}{" "}
                        {line.label}
                      </td>
                      <td className="wb-num">{line.quantity}</td>
                      <td className="wb-num">{formatRsd(line.unitPrice)}</td>
                      <td className="wb-num">{formatRsd(line.quantity * line.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total</td>
                    <td className="wb-num">{formatRsd(total(service))}</td>
                  </tr>
                </tfoot>
              </table>
              <button className="wb-btn">
                <Plus size={15} aria-hidden /> Add line
              </button>
            </>
          )}
          {tab === "Customer report" && (
            <form className="wb-form" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="wb-report">Customer report</label>
              <p className="wb-muted">
                What was done, as the customer reads it on the service report.
              </p>
              <textarea id="wb-report" rows={7} defaultValue={service.customerReport} />
              <div className="wb-right">
                <button className="wb-btn wb-btn-primary">Save changes</button>
              </div>
            </form>
          )}
          {tab === "Log" && (
            <>
              <ol className="wb-log">
                {service.log.length === 0 && <li className="wb-muted">No log entries yet.</li>}
                {service.log.map((entry, i) => (
                  <li key={i}>
                    <div className="wb-log-meta">
                      <strong>
                        {entry.kind === "legacy" ? "Imported from the old app" : entry.author}
                      </strong>
                      <time>{entry.at}</time>
                    </div>
                    {entry.kind === "status" ? (
                      <div className="wb-log-status">
                        Status changed <Badge status={entry.from} />{" "}
                        <ArrowRight size={14} aria-hidden /> <Badge status={entry.to} />
                      </div>
                    ) : (
                      <p>{entry.text}</p>
                    )}
                  </li>
                ))}
              </ol>
              <form className="wb-form" onSubmit={(e) => e.preventDefault()}>
                <textarea rows={3} placeholder="Add an internal note…" aria-label="Note" />
                <div className="wb-right">
                  <button className="wb-btn wb-btn-primary">Add note</button>
                </div>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export const workbench: Direction = {
  key: "A",
  name: "Workbench",
  summary:
    "Repair tags and workshop floor markings: graphite and signal yellow, condensed numbers, flat and dense. Built for speed at the counter.",
  className: "wb",
  tokens: WORKBENCH,
  fonts: { display: "Big Shoulders Display (600–800)", text: "Archivo (400–700)" },
  shape: [
    "Radius 2px on everything; the tags' notch is the only shape that isn't square.",
    "No shadows. Depth comes from 1px rules and the ink header bar; the drawer sits on a dark scrim.",
    "4px spacing grid. Table rows are 40px, cards are tight: the most services per screen of the three.",
    "Yellow is reserved for what needs action: the primary button, In progress, the active nav bar, focus in dark mode.",
  ],
  motion:
    "Fast and mechanical: the drawer slides in from the right in 160ms with a sharp ease-out, dialogs cut in with an 80ms fade and no scale. A row whose status changes flashes a yellow left edge once (300ms); nothing else moves.",
  pdf: "The PDFs keep the ink-and-yellow identity without fills: Archivo text, the service number in Big Shoulders, a 2pt ink rule under the header with the yellow tag logo beside it (yellow alone is too faint on paper), and status as plain bold text.",
  Logo,
  App,
};
