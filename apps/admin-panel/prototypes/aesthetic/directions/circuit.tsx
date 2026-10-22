// PROTOTYPE (#24), direction C: Circuit. The board inside every device on the bench.
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
import { CIRCUIT, type Mode } from "../tokens";
import {
  NAV,
  openProps,
  StatusControl,
  TABS,
  type Direction,
  type DirectionProps,
  type Tab,
} from "../shared";
import "./circuit.css";

function Logo({ mode, size = 30 }: { mode: Mode; size?: number }) {
  const p = CIRCUIT.palettes[mode];
  const body = mode === "light" ? p.primary : p.surface;
  const copper = mode === "light" ? p.accent : p.primary;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {/* A chip: pins on two sides, a copper pad and a trace leaving it. */}
      {[9, 14, 19, 24].map((y) => (
        <g key={y} fill={copper}>
          <rect x="2" y={y - 1.5} width="5" height="3" rx="1" />
          <rect x="25" y={y - 1.5} width="5" height="3" rx="1" />
        </g>
      ))}
      <rect
        x="6"
        y="4"
        width="20"
        height="24"
        rx="5"
        fill={body}
        stroke={copper}
        strokeWidth={mode === "dark" ? 1.6 : 0}
      />
      <circle cx="12.5" cy="11" r="3" fill="none" stroke={copper} strokeWidth="2" />
      <path
        d="M12.5 14 V18 L19 22.5"
        fill="none"
        stroke={copper}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Led({
  status,
  changed,
  onChange,
}: {
  status: Status;
  changed?: boolean;
  onChange?: (status: Status) => void;
}) {
  const pill = (
    <span
      key={status}
      className="ci-led"
      data-changed={changed || undefined}
      style={{ color: `var(--${status}-fg)`, background: `var(--${status}-bg)` }}
    >
      <span className="ci-led-dot" />
      {STATUS_LABELS[status]}
      {onChange && <ChevronDown size={13} aria-hidden />}
    </span>
  );
  return onChange ? (
    <StatusControl status={status} onChange={onChange}>
      {pill}
    </StatusControl>
  ) : (
    pill
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
    <div className="ci-app">
      <header className="ci-top">
        <div className="ci-brand">
          <Logo mode={mode} />
          <span>Service Book</span>
        </div>
        <nav className="ci-nav">
          {NAV.map((item) => (
            <a key={item} href="#" aria-current={item === "Services" ? "page" : undefined}>
              {item}
            </a>
          ))}
        </nav>
        <div className="ci-user">
          <span className="ci-avatar" aria-hidden>
            A
          </span>
          <span>Aleksa</span>
          <button className="ci-icon" aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="ci-main">
        <div className="ci-head">
          <h1>Services</h1>
          <button className="ci-btn ci-btn-primary">
            <Plus size={17} aria-hidden /> Add
          </button>
        </div>
        <div className="ci-toolbar">
          <label className="ci-search">
            <Search size={17} aria-hidden />
            <input
              placeholder="Search by number, customer, phone, device or description"
              aria-label="Search services"
            />
          </label>
          <select className="ci-select" aria-label="Filter by status">
            <option>All statuses</option>
          </select>
          <select className="ci-select" aria-label="Sort">
            <option>Newest first</option>
          </select>
          <div className="ci-seg" role="group" aria-label="View">
            <button aria-pressed={view === "cards"} onClick={() => onView("cards")}>
              <LayoutGrid size={16} aria-hidden /> Cards
            </button>
            <button aria-pressed={view === "table"} onClick={() => onView("table")}>
              <Table2 size={16} aria-hidden /> Table
            </button>
          </div>
        </div>

        {view === "cards" ? (
          <ul className="ci-cards">
            {services.map((s) => (
              <li key={s.id} className="ci-card" {...openProps(s.id, onOpen)}>
                <div className="ci-card-top">
                  <span className="ci-number">{s.number}</span>
                  <Led
                    status={s.status}
                    changed={s.id === changedId}
                    onChange={(status) => onStatus(s.id, status)}
                  />
                </div>
                <div className="ci-card-customer">{s.customer.name}</div>
                <div className="ci-muted">{s.customer.phone}</div>
                <div className="ci-card-devices">{s.devices.join(", ")}</div>
                <div className="ci-card-foot">
                  <span className="ci-muted">{formatDate(s.date)}</span>
                  <span className="ci-amount">{formatRsd(total(s))}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ci-table-wrap">
            <table className="ci-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Devices</th>
                  <th>Status</th>
                  <th className="ci-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} {...openProps(s.id, onOpen)} aria-selected={s.id === openId}>
                    <td className="ci-number">{s.number}</td>
                    <td className="ci-nowrap">{formatDate(s.date)}</td>
                    <td>
                      <div className="ci-strong">{s.customer.name}</div>
                      <div className="ci-muted ci-small">{s.customer.phone}</div>
                    </td>
                    <td>{s.devices.join(", ")}</td>
                    <td>
                      <Led
                        status={s.status}
                        changed={s.id === changedId}
                        onChange={(status) => onStatus(s.id, status)}
                      />
                    </td>
                    <td className="ci-right ci-amount">{formatRsd(total(s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {open && (
        <Drawer
          key={open.id}
          service={open}
          changed={open.id === changedId}
          onClose={() => onOpen(null)}
          onStatus={onStatus}
        />
      )}
    </div>
  );
}

function Drawer({
  service,
  changed,
  onClose,
  onStatus,
}: {
  service: Service;
  changed: boolean;
  onClose: () => void;
  onStatus: (id: string, status: Status) => void;
}) {
  const [tab, setTab] = useState<Tab>("Details");
  return (
    <>
      <div className="ci-scrim" onClick={onClose} />
      <aside className="ci-drawer" role="dialog" aria-label={`Service ${service.number}`}>
        <header className="ci-drawer-head">
          <div>
            <div className="ci-drawer-title">Service {service.number}</div>
            <div className="ci-muted">Registered on {formatDate(service.date)}</div>
          </div>
          <button className="ci-icon" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="ci-drawer-actions">
          <Led
            status={service.status}
            changed={changed}
            onChange={(status) => onStatus(service.id, status)}
          />
          <span className="ci-grow" />
          <button className="ci-icon ci-icon-box" aria-label="Print">
            <Printer size={17} />
          </button>
          <button className="ci-icon ci-icon-box" aria-label="Edit service">
            <Pencil size={17} />
          </button>
          <button className="ci-icon ci-icon-box" aria-label="Delete service">
            <Trash2 size={17} />
          </button>
        </div>

        <dl className="ci-summary">
          <div>
            <dt>Customer</dt>
            <dd>
              <a href="#">{service.customer.name}</a>
              <br />
              <a href="#">{service.customer.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Devices</dt>
            <dd>{service.devices.join(", ")}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(service.date)}</dd>
          </div>
          <div className="ci-wide">
            <dt>Description</dt>
            <dd>{service.description}</dd>
          </div>
        </dl>

        <div className="ci-tabs" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="ci-panel">
          {tab === "Details" && (
            <>
              <ul className="ci-lines">
                {service.lines.map((line, i) => (
                  <li key={i}>
                    <span className="ci-line-icon" data-type={line.type}>
                      {line.type === "WORK" ? (
                        <Wrench size={15} aria-label="Work" />
                      ) : (
                        <Package size={15} aria-label="Sale" />
                      )}
                    </span>
                    <span className="ci-grow">
                      {line.label}
                      <span className="ci-muted ci-small">
                        {" "}
                        {line.quantity} × {formatRsd(line.unitPrice)}
                      </span>
                    </span>
                    <span className="ci-amount">{formatRsd(line.quantity * line.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <div className="ci-total">
                <span>Total</span>
                <span>{formatRsd(total(service))}</span>
              </div>
              <button className="ci-btn">
                <Plus size={15} aria-hidden /> Add line
              </button>
            </>
          )}
          {tab === "Customer report" && (
            <form className="ci-form" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="ci-report">Customer report</label>
              <p className="ci-muted">
                What was done, as the customer reads it on the service report.
              </p>
              <textarea id="ci-report" rows={7} defaultValue={service.customerReport} />
              <div className="ci-end">
                <button className="ci-btn ci-btn-primary">Save changes</button>
              </div>
            </form>
          )}
          {tab === "Log" && (
            <>
              <ol className="ci-log">
                {service.log.length === 0 && <li className="ci-muted">No log entries yet.</li>}
                {service.log.map((entry, i) => (
                  <li key={i}>
                    <div className="ci-log-meta">
                      <span>
                        {entry.kind === "legacy" ? "Imported from the old app" : entry.author}
                      </span>
                      <time>{entry.at}</time>
                    </div>
                    {entry.kind === "status" ? (
                      <div className="ci-log-status">
                        Status changed <Led status={entry.from} />{" "}
                        <ArrowRight size={14} aria-hidden /> <Led status={entry.to} />
                      </div>
                    ) : (
                      <p>{entry.text}</p>
                    )}
                  </li>
                ))}
              </ol>
              <form className="ci-form" onSubmit={(e) => e.preventDefault()}>
                <textarea rows={3} placeholder="Add an internal note…" aria-label="Note" />
                <div className="ci-end">
                  <button className="ci-btn ci-btn-primary">Add note</button>
                </div>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export const circuit: Direction = {
  key: "C",
  name: "Circuit",
  summary:
    "The board inside every device on the bench: solder-mask green, copper and silkscreen white, with statuses as LEDs. Soft, rounded and friendly.",
  className: "ci",
  tokens: CIRCUIT,
  fonts: { display: "Chakra Petch (500–700)", text: "Red Hat Text (400–700)" },
  shape: [
    "Radius by size: 20px on the drawer, 16px on panels and cards, 10px on controls, full pills on statuses and tabs.",
    "A soft green-tinted shadow lifts the top bar, cards and drawer in light mode; dark mode drops shadows and uses a 1px rule and the LEDs' glow.",
    "8px spacing grid, generous: 16px card padding, 52px table rows, the drawer floats 12px off the screen edges.",
    "Copper is the one accent: service numbers in light mode, the primary button in dark mode.",
  ],
  motion:
    "Soft and springy: the drawer floats in from the right with a slight scale (0.98 to 1) over 280ms with a gentle overshoot; dialogs scale from 0.96 in 200ms. When a status changes, its LED pulses once (a 600ms glow) and the card stays put; reduced motion turns all of it into plain fades.",
  pdf: "On paper the board becomes the silkscreen: Red Hat Text on white, the number and headings in Chakra Petch, mask-green hairlines and rounded outlines instead of tinted boxes, and copper only for the total.",
  Logo,
  App,
};
