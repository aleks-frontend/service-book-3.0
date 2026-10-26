# Photos in a private R2 bucket, uploaded through the backend

## Context

Staff attach photos to notes in a service's log, mostly of a device's condition at intake. They show customers' devices and sometimes their data, so they must stay internal like the rest of the log. A few hundred phone photos a month would soon dwarf everything else in Postgres and its backups, and Railway charges for both. Cloudflare R2 is free up to 10 GB, with no egress fees (`techstack.md`).

## Decision

Photos are stored in a private Cloudflare R2 bucket, one per deployment (ADR-0002). The database keeps only each photo's storage keys, type and size.

- **Upload through the backend.** The admin panel posts photos to the API along with the note, and the backend puts them in the bucket. This keeps ADR-0001's single origin, needs no CORS on the bucket and lets the backend check every file before storing it. The browser shrinks photos to 2048 px first, so a note's upload stays small. We considered presigned direct-to-R2 uploads and rejected them: they need bucket CORS and a second "confirm" request, and they leave orphaned objects when the confirm never comes.
- **Serve through authenticated redirects.** `GET /api/photos/:id` (and `/thumb`) checks the session, then answers 302 with a presigned URL valid for a few minutes. Image bytes don't pass through the backend, and a link copied out of the browser stops working quickly.
- **Storage behind an interface.** `PhotoStorage` (put, delete, short-lived URL) has an R2 adapter and a local-filesystem adapter, chosen by env vars. Development and the e2e tests use the filesystem; there, the "presigned URL" is a backend path behind the session check. The API tests pass an in-memory fake to `createApp`.

## Consequences

- Objects are stored before the DB write and deleted if it fails, because the two can't share a transaction. A crash between the two can still leave an orphaned object; that is accepted.
- Deleting a service or a photo must also delete its objects, after the DB delete succeeds.
- Production needs four `R2_*` variables. With neither `R2_BUCKET` nor `PHOTO_STORAGE_DIR` set, it refuses to start rather than silently writing photos to the container's ephemeral disk.
- The R2 adapter isn't covered by automated tests; it gets a manual check against a real bucket before release.
