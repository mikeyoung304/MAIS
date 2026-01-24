# Fix Supabase Key Configuration Consistency

## Overview

The MAIS project has **inconsistent Supabase key naming** across configuration files and code. Additionally, Supabase is migrating from legacy JWT keys to a new `sb_publishable_`/`sb_secret_` format (sunset: late 2026). This plan addresses both the immediate inconsistency and prepares for the future migration.

## Problem Statement

### Immediate Issue: Naming Inconsistency

The codebase uses **two different names** for the same key:

- `SUPABASE_SERVICE_KEY` (used in application code)
- `SUPABASE_SERVICE_ROLE_KEY` (used in scripts and some docs)

This causes confusion and potential runtime errors when environment variables don't match.

### Current State Analysis

| Location                                   | Variable Name               | Status                     |
| ------------------------------------------ | --------------------------- | -------------------------- |
| `server/src/config/database.ts:25`         | `SUPABASE_SERVICE_KEY`      | ✅ Code expects this       |
| `server/src/config/env.schema.ts:34`       | `SUPABASE_SERVICE_KEY`      | ✅ Validation expects this |
| `server/.env`                              | `SUPABASE_SERVICE_KEY`      | ✅ Correct                 |
| `/.env` (root)                             | `SUPABASE_SERVICE_KEY`      | ✅ Correct                 |
| `server/.env.example:47`                   | `SUPABASE_SERVICE_ROLE_KEY` | ❌ Wrong name              |
| `server/scripts/migrate-to-signed-urls.ts` | `SUPABASE_SERVICE_ROLE_KEY` | ❌ Wrong name              |
| `render.yaml`                              | `SUPABASE_SERVICE_KEY`      | ✅ Correct                 |
| **Render Dashboard**                       | `SUPABASE_SERVICE_KEY`      | ⚠️ Needs verification      |

### Future Issue: Supabase Key Migration (Late 2026)

Supabase is transitioning from legacy JWT keys to new format:

| Old Format (Legacy)     | New Format           |
| ----------------------- | -------------------- |
| `eyJ...` (anon key)     | `sb_publishable_...` |
| `eyJ...` (service_role) | `sb_secret_...`      |

**Timeline:**

- November 2025: Monthly migration reminders begin
- Late 2026: Legacy keys sunset

## Proposed Solution

### Phase 1: Fix Naming Inconsistency (Immediate)

Standardize on `SUPABASE_SERVICE_KEY` since that's what the application code expects.

#### Files to Update:

1. **`server/.env.example`** - Change `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_KEY`
2. **`server/scripts/migrate-to-signed-urls.ts`** - Change variable references
3. **Render Dashboard** - Verify `SUPABASE_SERVICE_KEY` is set (not `SUPABASE_SERVICE_ROLE_KEY`)

### Phase 2: Documentation Update

Update documentation to clarify the correct variable names and prepare for future migration.

### Phase 3: Future Migration Prep (Q3 2025)

When Supabase releases final migration timeline, update to new key format.

## Technical Details

### Current Local Configuration (Verified ✅)

```bash
# /.env and /server/.env both have:
SUPABASE_URL=https://gpyvdknhmevcfdbgtqir.supabase.co
SUPABASE_ANON_KEY=eyJ...  # Legacy JWT format
SUPABASE_SERVICE_KEY=eyJ... # Legacy JWT format
SUPABASE_JWT_SECRET=abuk...
```

### Render Environment Variables Required

| Variable               | Value                                        | Status         |
| ---------------------- | -------------------------------------------- | -------------- |
| `SUPABASE_URL`         | `https://gpyvdknhmevcfdbgtqir.supabase.co`   | Verify         |
| `SUPABASE_ANON_KEY`    | `eyJhbGciOiJIUzI1NiIs...` (anon JWT)         | Verify         |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOiJIUzI1NiIs...` (service_role JWT) | **CHECK THIS** |
| `SUPABASE_JWT_SECRET`  | `abuksGwVLTU7cfYZBE5E...`                    | Verify         |

### Code References

```typescript
// server/src/config/database.ts:22-29
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseServiceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY; // ← Expects this name

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for service client');
    }
    // ...
  }
}
```

## Acceptance Criteria

### Phase 1 (Immediate)

- [ ] `server/.env.example` uses `SUPABASE_SERVICE_KEY`
- [ ] `migrate-to-signed-urls.ts` script uses `SUPABASE_SERVICE_KEY`
- [ ] Render has `SUPABASE_SERVICE_KEY` set (not `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Photo uploads work on production

### Phase 2 (Documentation)

- [ ] README/CLAUDE.md documents correct variable names
- [ ] Note about future Supabase key migration added

### Phase 3 (Future - Q3 2025)

- [ ] Monitor Supabase migration announcements
- [ ] Plan update to `sb_publishable_`/`sb_secret_` format

## Risks & Mitigations

| Risk                           | Mitigation                        |
| ------------------------------ | --------------------------------- |
| Render has wrong variable name | Immediate fix in dashboard        |
| Script breaks after rename     | Update script simultaneously      |
| Future key format change       | Current keys work until late 2026 |

## Dependencies

- Access to Render dashboard
- Access to Supabase dashboard (for key retrieval)

## References

- **Supabase Key Migration Discussion:** https://github.com/orgs/supabase/discussions/29260
- **Supabase API Keys Docs:** https://supabase.com/docs/guides/api/api-keys
- **Local Code:** `server/src/config/database.ts:25`
- **Validation Schema:** `server/src/config/env.schema.ts:34`

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
