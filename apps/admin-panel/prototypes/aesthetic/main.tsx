// PROTOTYPE (#24): three aesthetic directions for the admin panel, switchable with
// `?variant=A|B|C` and `?mode=light|dark`. Not part of the app's build. See PLAN.md.
import { StrictMode, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ChevronLeft, ChevronRight, Moon, NotebookText, Sun, X } from "lucide-react";
import { SAMPLE_LINE, SERVICES, STATUSES, STATUS_LABELS, type Status } from "./data";
import { checks, type Mode } from "./tokens";
import type { Direction, View } from "./shared";
import { workbench } from "./directions/workbench";
import { carbon } from "./directions/carbon";
import { circuit } from "./directions/circuit";
import "./shell.css";

const DIRECTIONS: Direction[] = [workbench, carbon, circuit];

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    variant: params.get("variant") ?? "A",
    mode: (params.get("mode") === "dark" ? "dark" : "light") as Mode,
    view: (params.get("view") === "table" ? "table" : "cards") as View,
    service: params.get("service"),
    notes: params.get("notes") === "1",
  };
}

type Params = ReturnType<typeof readParams>;

function writeParams(params: Params) {
  const search = new URLSearchParams({
    variant: params.variant,
    mode: params.mode,
    view: params.view,
  });
  if (params.service) search.set("service", params.service);
  if (params.notes) search.set("notes", "1");
  window.history.replaceState(null, "", `?${search}`);
}

/** Each direction's tokens as CSS custom properties on its root. */
function cssVars(direction: Direction, mode: Mode) {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(direction.tokens.palettes[mode]))
    vars[`--${name}`] = value;
  for (const status of STATUSES) {
    vars[`--${status}-fg`] = direction.tokens.statuses[mode][status].fg;
    vars[`--${status}-bg`] = direction.tokens.statuses[mode][status].bg;
  }
  return vars as CSSProperties;
}

function Prototype() {
  const [params, setParams] = useState(readParams);
  const [services, setServices] = useState(SERVICES);
  const [changedId, setChangedId] = useState<string | null>(null);
  const index = Math.max(
    0,
    DIRECTIONS.findIndex((d) => d.key === params.variant),
  );
  const direction = DIRECTIONS[index];

  function update(patch: Partial<Params>) {
    setParams((current) => {
      const next = { ...current, ...patch };
      writeParams(next);
      return next;
    });
  }

  function cycle(step: number) {
    update({ variant: DIRECTIONS[(index + step + DIRECTIONS.length) % DIRECTIONS.length].key });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    document.body.style.background = direction.tokens.palettes[params.mode].bg;
    document.documentElement.style.colorScheme = params.mode;
  }, [direction, params.mode]);

  const { App } = direction;

  return (
    <div
      className={direction.className}
      data-mode={params.mode}
      style={cssVars(direction, params.mode)}
    >
      <App
        mode={params.mode}
        services={services}
        view={params.view}
        onView={(view) => update({ view })}
        openId={params.service}
        onOpen={(service) => update({ service })}
        changedId={changedId}
        onStatus={(id, status: Status) => {
          setServices((all) => all.map((s) => (s.id === id ? { ...s, status } : s)));
          setChangedId(id);
        }}
      />
      {params.notes && (
        <Notes direction={direction} mode={params.mode} onClose={() => update({ notes: false })} />
      )}

      <div className="proto-bar" role="toolbar" aria-label="Prototype controls">
        <button onClick={() => cycle(-1)} aria-label="Previous direction">
          <ChevronLeft size={16} />
        </button>
        <span className="proto-bar-label">
          {direction.key} ({direction.name})
        </span>
        <button onClick={() => cycle(1)} aria-label="Next direction">
          <ChevronRight size={16} />
        </button>
        <span className="proto-bar-sep" />
        <button
          onClick={() => update({ mode: params.mode === "light" ? "dark" : "light" })}
          aria-label="Toggle light and dark"
        >
          {params.mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={() => update({ notes: !params.notes })} aria-pressed={params.notes}>
          <NotebookText size={16} /> Notes
        </button>
      </div>
    </div>
  );
}

/** The direction's spec sheet: fonts, palettes and their contrast, shape, motion, logo, PDFs. */
function Notes({
  direction,
  mode,
  onClose,
}: {
  direction: Direction;
  mode: Mode;
  onClose: () => void;
}) {
  const { Logo } = direction;
  return (
    <aside className="notes" aria-label={`${direction.name} notes`}>
      <header className="notes-head">
        <div>
          <h2 className="notes-title">{direction.name}</h2>
          <p>{direction.summary}</p>
        </div>
        <button className="notes-close" onClick={onClose} aria-label="Close notes">
          <X size={18} />
        </button>
      </header>

      <section>
        <h3>Type</h3>
        <p className="notes-sample-display">Žiča, Đurđevo, Ćuprija, Šid, Kőszeg, Hűvösvölgy</p>
        <p className="notes-sample-text">{SAMPLE_LINE}</p>
        <p className="notes-meta">
          Display: {direction.fonts.display}. Text: {direction.fonts.text}.
        </p>
      </section>

      <section>
        <h3>Logo</h3>
        <div className="notes-logos">
          <div className="notes-logo" style={{ background: direction.tokens.palettes.light.bg }}>
            <Logo mode="light" size={56} />
          </div>
          <div className="notes-logo" style={{ background: direction.tokens.palettes.dark.bg }}>
            <Logo mode="dark" size={56} />
          </div>
        </div>
      </section>

      {(["light", "dark"] as Mode[]).map((paletteMode) => (
        <section key={paletteMode}>
          <h3>{paletteMode === "light" ? "Light" : "Dark"} palette and contrast</h3>
          <div className="notes-swatches">
            {Object.entries(direction.tokens.palettes[paletteMode]).map(([name, hex]) => (
              <div key={name} className="notes-swatch">
                <span style={{ background: hex }} />
                {name} <code>{hex}</code>
              </div>
            ))}
          </div>
          <div
            className="notes-statuses"
            style={{ background: direction.tokens.palettes[paletteMode].surface }}
          >
            {STATUSES.map((status) => {
              const c = direction.tokens.statuses[paletteMode][status];
              return (
                <span key={status} style={{ color: c.fg, background: c.bg }}>
                  {STATUS_LABELS[status]}
                </span>
              );
            })}
          </div>
          <table className="notes-checks">
            <tbody>
              {checks(direction.tokens, paletteMode).map((check) => (
                <tr key={check.label} data-fail={check.ratio < check.min || undefined}>
                  <td>
                    <span className="notes-pair" style={{ color: check.fg, background: check.bg }}>
                      Aa
                    </span>
                  </td>
                  <td>{check.label}</td>
                  <td>
                    {check.ratio.toFixed(2)}:1 {check.ratio >= check.min ? "passes" : "fails"}{" "}
                    {check.min}:1
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section>
        <h3>Shape and spacing</h3>
        <ul>
          {direction.shape.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Motion</h3>
        <p>{direction.motion}</p>
      </section>
      <section>
        <h3>PDF documents</h3>
        <p>{direction.pdf}</p>
      </section>
      <p className="notes-meta">Showing {mode} mode behind this panel.</p>
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Prototype />
  </StrictMode>,
);
