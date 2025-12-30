# P2: Field Name Standardization (title/name, priceCents/basePrice)

## Status

**COMPLETE** - 2025-12-29

## Priority

**P2 - Important**

## Resolution

Created **ADR-016: Field Naming Conventions** which documents:

1. **Layer-specific naming conventions:**
   - Database: `name`, `basePrice` (Prisma consistency)
   - Domain Entities: `title`, `priceCents` (historical, explicit cents suffix)
   - API DTOs: `title`, `priceCents` (contract stability)
   - Frontend: `name`, `basePrice` (user-friendly)
   - AI Agent: Accept both (robust to either naming)

2. **Key mappings documented:**
   - Database → Domain: `name` → `title`, `basePrice` → `priceCents`
   - Domain → API: Both conventions exposed for compatibility
   - API → Domain (input): Accept both, normalize internally

3. **Updated documentation:**
   - Created: `docs/adrs/ADR-016-field-naming-conventions.md`
   - Updated: `CLAUDE.md` Key Documentation section with ADR-016 reference

## Decision

Keep both naming conventions at their respective layers with explicit DTO mapping.

**Rationale:**

- Maintains backward compatibility
- Explicit mapping prevents subtle bugs
- Each layer can evolve independently
- Matches existing codebase patterns (already implemented in executors/index.ts)

## Files Created/Updated

- `docs/adrs/ADR-016-field-naming-conventions.md` - Full ADR with mapping guide
- `CLAUDE.md` - Added ADR-016 to Key Documentation section

## References

- ADR-016: `docs/adrs/ADR-016-field-naming-conventions.md`
- Existing mapping code: `server/src/agent/executors/index.ts` (lines 70-98)
- Existing mapping code: `server/src/routes/tenant-admin.routes.ts` (lines 306-327)

## Tags

api, schema, consistency, dto, naming-convention, documentation
