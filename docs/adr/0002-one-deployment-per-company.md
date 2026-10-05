# One deployment per company (single-tenant)

## Context

Service Book serves one company today but may later be sold to other repair shops.

## Decision

Each company gets its own deployment and its own database rather than sharing one multi-tenant instance. No table has a tenant column. Company identity lives in the singleton Settings record, so the same build can be branded per deployment. Multi-tenancy would add a tenant filter to every query and every test, plus cross-tenant leak risk, before there is a second customer. Separate deployments also give each company isolated data and backups.

## Consequences

- Onboarding a new company means a new Railway project, a database, a seeded staff member and filled Settings: an operational task, not a feature.
- Moving to multi-tenancy later would need a schema migration that adds a tenant key everywhere. We accept that cost if it ever arrives.
