// PROTOTYPE (#24), direction B: Carbon copy. The numbered duplicate receipt book.
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
import { CARBON, type Mode } from "../tokens";
import {
  NAV,
  openProps,
  StatusControl,
  TABS,
  type Direction,
  type DirectionProps,
  type Tab,
} from "../shared";
import "./carbon.css";

function Logo({ mode, size = 32 }: { mode: Mode; size?: number }) {
  const p = CARBON.palettes[mode];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {/* A receipt slip: perforated top, two carbon lines, its printed red number. */}
      <path
        d="M5 5 a1.75 1.75 0 0 0 3.5 0 a1.75 1.75 0 0 0 3.5 0 a1.75 1.75 0 0 0 3.5 0 a1.75 1.75 0 0 0 3.5 0 a1.75 1.75 0 0 0 3.5 0 a1.75 1.75 0 0 0 3.5 0 V28 H5 Z"
        fill={mode === "light" ? "#FFFFFF" : p.surface}
        stroke={p.primary}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="17" y="10" width="7" height="3" fill={p.accent} />
      <path d="M9 17 H23 M9 22 H19" stroke={p.primary} strokeWidth="2" />
    </svg>
  );
}

function Stamp({
  status,
  changed,
  onChange,
}: {
  status: Status;
  changed?: boolean;
  onChange?: (status: Status) => void;
}) {
  const stamp = (
    <span
      key={status}
      className="cc-stamp"
      data-changed={changed || undefined}
      style={{ color: `var(--${status}-fg)`, background: `var(--${status}-bg)` }}
    >
      {STATUS_LABELS[status]}
      {onChange && <ChevronDown size={13} aria-hidden />}
    </span>
  );
  return onChange ? (
    <StatusControl status={status} onChange={onChange}>
      {stamp}
    </StatusControl>
  ) : (
    stamp
  );
}

/** The service number as it is printed on the slip: the year small, the sequence large, in red. */
function SlipNumber({ number, large }: { number: string; large?: boolean }) {
  const [year, sequence] = number.split("-");
  return (
    <span className={large ? "cc-no cc-no-large" : "cc-no"}>
      <span className="cc-no-year">{year}-</span>
      {sequence}
    </span>
  );
}

function App({
  mode,
  services,
  view,
  onView,
  openId,
  onOpen,
  onStatus,
  changedId,
}: DirectionProps) {
  const open = services.find((s) => s.id === openId) ?? null;

  return (
    <div className="cc-app">
      <aside className="cc-spine">
        <div className="cc-brand">
          <Logo mode={mode} />
          <span>
            Service
            <br />
            Book
          </span>
        </div>
        <nav className="cc-nav">
          {NAV.map((item) => (
            <a key={item} href="#" aria-current={item === "Services" ? "page" : undefined}>
              {item}
            </a>
          ))}
        </nav>
        <div className="cc-user">
          <span>Aleksa</span>
          <button className="cc-link-btn">
            <LogOut size={15} aria-hidden /> Log out
          </button>
        </div>
      </aside>

      <main className="cc-main">
        <div className="cc-head">
          <h1>Services</h1>
          <div className="cc-head-actions">
            <div className="cc-seg" role="group" aria-label="View">
              <button
                aria-pressed={view === "cards"}
                onClick={() => onView("cards")}
                aria-label="Card view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                aria-pressed={view === "table"}
                onClick={() => onView("table")}
                aria-label="Table view"
              >
                <Table2 size={16} />
              </button>
            </div>
            <button className="cc-btn cc-btn-primary">
              <Plus size={16} aria-hidden /> Add
            </button>
          </div>
        </div>
        <div className="cc-filters">
          <label className="cc-search">
            <Search size={16} aria-hidden />
            <input
              placeholder="Search by number, customer, phone, device or description"
              aria-label="Search services"
            />
          </label>
          <select className="cc-select" aria-label="Filter by status">
            <option>All statuses</option>
          </select>
          <select className="cc-select" aria-label="Sort">
            <option>Newest first</option>
          </select>
        </div>

        {view === "cards" ? (
          <ul className="cc-slips">
            {services.map((s) => (
              <li key={s.id} className="cc-slip" {...openProps(s.id, onOpen)}>
                <div className="cc-slip-top">
                  <span className="cc-muted">{formatDate(s.date)}</span>
                  <SlipNumber number={s.number} />
                </div>
                <div className="cc-slip-customer">{s.customer.name}</div>
                <div className="cc-muted">{s.customer.phone}</div>
                <div className="cc-slip-devices">{s.devices.join(", ")}</div>
                <div className="cc-slip-foot">
                  <Stamp
                    status={s.status}
                    changed={s.id === changedId}
                    onChange={(status) => onStatus(s.id, status)}
                  />
                  <span className="cc-amount">{formatRsd(total(s))}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="cc-ledger-wrap">
            <table className="cc-ledger">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Devices</th>
                  <th>Status</th>
                  <th className="cc-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} {...openProps(s.id, onOpen)} aria-selected={s.id === openId}>
                    <td className="cc-ledger-no">
                      <SlipNumber number={s.number} />
                    </td>
                    <td className="cc-nowrap">{formatDate(s.date)}</td>
                    <td>
                      <div>{s.customer.name}</div>
                      <div className="cc-muted cc-small">{s.customer.phone}</div>
                    </td>
                    <td>{s.devices.join(", ")}</td>
                    <td>
                      <Stamp
                        status={s.status}
                        changed={s.id === changedId}
                        onChange={(status) => onStatus(s.id, status)}
                      />
                    </td>
                    <td className="cc-right cc-amount">{formatRsd(total(s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      <div className="cc-scrim" onClick={onClose} />
      <aside className="cc-drawer" role="dialog" aria-label={`Service ${service.number}`}>
        <div className="cc-drawer-bar">
          <Stamp status={service.status} onChange={(status) => onStatus(service.id, status)} />
          <span className="cc-grow" />
          <button className="cc-icon" aria-label="Print">
            <Printer size={17} />
          </button>
          <button className="cc-icon" aria-label="Edit service">
            <Pencil size={17} />
          </button>
          <button className="cc-icon" aria-label="Delete service">
            <Trash2 size={17} />
          </button>
          <button className="cc-icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <header className="cc-drawer-head">
          <div>
            <h2>Service</h2>
            <div className="cc-muted">Registered on {formatDate(service.date)}</div>
          </div>
          <SlipNumber number={service.number} large />
        </header>

        <dl className="cc-fields">
          <div>
            <dt>Customer</dt>
            <dd>
              <a href="#">{service.customer.name}</a>
              <a href="#" className="cc-phone">
                {service.customer.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(service.date)}</dd>
          </div>
          <div className="cc-wide">
            <dt>Devices</dt>
            <dd>{service.devices.join(", ")}</dd>
          </div>
          <div className="cc-wide">
            <dt>Description</dt>
            <dd>{service.description}</dd>
          </div>
        </dl>

        <div className="cc-tabs" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="cc-panel">
          {tab === "Details" && (
            <>
              <table className="cc-lines">
                <tbody>
                  {service.lines.map((line, i) => (
                    <tr key={i}>
                      <td className="cc-line-icon">
                        {line.type === "WORK" ? (
                          <Wrench size={15} aria-label="Work" />
                        ) : (
                          <Package size={15} aria-label="Sale" />
                        )}
                      </td>
                      <td>{line.label}</td>
                      <td className="cc-right cc-muted cc-nowrap">
                        {line.quantity} × {formatRsd(line.unitPrice)}
                      </td>
                      <td className="cc-right cc-nowrap">
                        {formatRsd(line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="cc-total">
                <span>Total</span>
                <span>{formatRsd(total(service))}</span>
              </div>
              <button className="cc-btn">
                <Plus size={15} aria-hidden /> Add line
              </button>
            </>
          )}
          {tab === "Customer report" && (
            <form className="cc-form" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="cc-report">Customer report</label>
              <p className="cc-muted">
                What was done, as the customer reads it on the service report.
              </p>
              <textarea
                id="cc-report"
                className="cc-ruled"
                rows={7}
                defaultValue={service.customerReport}
              />
              <div className="cc-end">
                <button className="cc-btn cc-btn-primary">Save changes</button>
              </div>
            </form>
          )}
          {tab === "Log" && (
            <>
              <ol className="cc-log">
                {service.log.length === 0 && <li className="cc-muted">No log entries yet.</li>}
                {service.log.map((entry, i) => (
                  <li key={i}>
                    <div className="cc-log-meta">
                      <span>
                        {entry.kind === "legacy" ? "Imported from the old app" : entry.author}
                      </span>
                      <time>{entry.at}</time>
                    </div>
                    {entry.kind === "status" ? (
                      <div className="cc-log-status">
                        Status changed <Stamp status={entry.from} />{" "}
                        <ArrowRight size={14} aria-hidden /> <Stamp status={entry.to} />
                      </div>
                    ) : (
                      <p>{entry.text}</p>
                    )}
                  </li>
                ))}
              </ol>
              <form className="cc-form" onSubmit={(e) => e.preventDefault()}>
                <textarea
                  className="cc-ruled"
                  rows={3}
                  placeholder="Add an internal note…"
                  aria-label="Note"
                />
                <div className="cc-end">
                  <button className="cc-btn cc-btn-primary">Add note</button>
                </div>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export const carbon: Direction = {
  key: "B",
  name: "Carbon copy",
  summary:
    "The shop's numbered duplicate receipt book: white slips, carbon-blue ink, and every service number printed in red. Calm, paper-like and card-first.",
  className: "cc",
  tokens: CARBON,
  fonts: { display: "Zilla Slab (500–700)", text: "Libre Franklin (400–700)" },
  shape: [
    "Radius 4px on slips, dialogs and inputs; 0 on the spine and the ledger.",
    "One shadow, on paper only: slips and the drawer lift off the page with a soft blue-grey shadow. Controls stay flat.",
    "8px spacing grid with roomy slips; the ledger rows are ruled 44px apart, with a red margin line after the number.",
    "Red is only ever the printed number (and Cancelled), so the eye finds a service by its number first.",
  ],
  motion:
    "Paper-like: the drawer slides out from the right like a slip pulled from the book, 240ms ease-out with a small settle; dialogs rise 8px and fade in 180ms. When a status changes, its stamp presses in (a 200ms scale from 1.15 to 1), so the change reads as stamping the slip.",
  pdf: "The intake receipt and service report become the white copy of the slip: Libre Franklin text, Zilla Slab headings, the service number printed in red at the top right, carbon-blue hairlines and ruled lines, and no tinted boxes.",
  Logo,
  App,
};
