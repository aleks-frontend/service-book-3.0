# Services carry a UUID, a service number and a public token

## Context

The old app used the creation timestamp as both a service's ID and its display number. That is unreadable for humans and guessable in a public URL, and a public status page is planned.

## Decision

Every service has three identifiers, each with one job:

- **UUID primary key:** internal references and API paths.
- **Service number (`YYYY-NNNN`):** what staff and customers say on the phone and see on paper. It is sequential per year and restarts at 0001 each January.
- **Public token** (see `GLOSSARY.md`): used only in the public link and its QR code on the dispatch note.

The Firebase timestamp is kept only as the legacy ID.

## Consequences

- Service numbers are allocated from a per-year counter row, updated inside the service-creation transaction, so concurrent creates never collide. The year is the year of the service's date when it is created; moving the date later keeps the number. The legacy import assigns numbers in date order and advances the counters past them.
- The public link must never expose the UUID or the service number, so a customer cannot enumerate other customers' services.
- Old QR codes and URLs from the Firebase app are not supported.
