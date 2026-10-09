## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on this repo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Admin panel conventions

### Entity pickers

Every field that picks an entity (customer, device, action, …) offers creating one from two places, and both behave the same:

- **The picker**: `<Entity>Picker` wraps react-select's `CreatableSelect` and takes `onCreate(text)`. The create row sits last (`createOptionPosition="last"`), is built with `lib/createOption.ts`, rendered with `CreateOptionLabel`, and reads `New <entity> "{{text}}"`.
- **The field header**: the label on the left, a `Button variant="link" size="xs"` with a `Plus` icon reading `New <entity>` on the right; disabled whenever the picker is.
- **One dialog for both**: each path opens the same `<Entity>FormDialog`, the picker passing what was typed as its default (name, model, …) and the button an empty one. On save, the new entity becomes the picker's value. Render the dialog outside the `<form>`.

The devices field in `ServiceForm.tsx` is the reference implementation; copy its shape when adding a picker.
