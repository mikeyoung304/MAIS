# TODO 10008: Split Large Route Files Into Domain Modules

**Priority:** P2
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #8
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Several route files exceed 1000 lines:

- `tenant-admin.routes.ts` — 2,060 lines
- `auth.routes.ts` — 1,130 lines
- `internal-agent-content-generation.routes.ts` — 1,004 lines

Also: `upload.service.ts:1-18` is a deprecated wrapper.

## Fix Strategy

1. Split `tenant-admin.routes.ts` by domain (billing, settings, team, etc.)
2. Split `auth.routes.ts` by flow (login, register, reset, oauth)
3. Split `internal-agent-content-generation.routes.ts` by entity (tiers, addons, segments, sections)
4. Delete deprecated `upload.service.ts` wrapper
5. Update route mounts in `index.ts`
