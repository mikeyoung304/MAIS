# MCP Postgres Server Removal Solution

**Date:** December 24, 2025
**Status:** RESOLVED
**Commit:** 80ac7c1 - chore: remove unused postgres MCP server

## Problem Statement

Claude Code displayed warning about missing `DATABASE_URL` environment variable when initializing MCP servers:

```
⚠️  MCP Config Diagnostics: postgres server requires DATABASE_URL
```

The warning persisted after:

- Checking `.claude/settings.json` and `settings.local.json` configurations
- Verifying environment variable exports
- Restarting Claude Code multiple times

## Root Cause Analysis

### Why the Warning Occurred

1. **MCP Initialization Issue**
   - Model Context Protocol (MCP) servers run independently from the Node.js environment
   - MCP servers do NOT inherit `.env` files or shell exports
   - The `postgres` MCP server was configured in `.mcp.json` with:
     ```json
     "postgres": {
       "command": "npx",
       "args": ["-y", "@modelcontextprotocol/server-postgres"],
       "env": { "DATABASE_URL": "${DATABASE_URL}" }
     }
     ```
   - The `${DATABASE_URL}` placeholder expected an environment variable that wasn't passed at MCP startup

2. **Redundancy with Prisma**
   - MAIS architecture uses Prisma ORM for ALL database operations
   - The Prisma MCP server was already available for database introspection
   - Postgres MCP server had zero permissions granted in Claude Code settings
   - Never used in actual development workflow (Prisma handles migrations, queries, studio)

3. **Improvement in Claude Code v2.0.76+**
   - Newer versions of Claude Code added MCP configuration diagnostics
   - Previously, misconfigured MCP servers failed silently
   - Now users see warnings about unresolved environment variables

### Historical Context

The postgres MCP was added during initial MAIS setup (November 24, 2025) before:

- Clear use cases emerged for postgres MCP
- Prisma MCP became the primary database tool
- Multi-tenant architecture required tenant-scoped database access

Timeline:

- **aab8a2e** (init workspaces): postgres MCP added with hardcoded connection string
- **cb1b65f to 9f7585b**: Feature development using Prisma exclusively
- **80ac7c1** (Dec 24, 2025): postgres MCP removed as redundant

## Solution: Remove Unused Postgres MCP Server

### Before (.mcp.json)

```json
{
  "mcpServers": {
    "prisma": {
      "command": "npx",
      "args": ["-y", "prisma", "mcp"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### After (.mcp.json)

```json
{
  "mcpServers": {
    "prisma": {
      "command": "npx",
      "args": ["-y", "prisma", "mcp"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

### Changes Made

1. **Removed postgres MCP block** (7 lines deleted)
2. **Retained Prisma MCP** - Provides `migrate-status`, `prisma-studio`, schema inspection
3. **Retained Playwright MCP** - Provides E2E testing capabilities

## Verification

### MCP Configuration After Fix

```bash
# Check Claude Code recognizes valid configuration
claude doctor --mcp
```

Expected output:

```
MCP Config: ✅ Valid
  - prisma: available
  - playwright: available
```

### No Breaking Changes

- ✅ Prisma operations unaffected (migrate, studio, queries)
- ✅ All npm commands continue working
- ✅ Database functionality preserved
- ✅ E2E testing via Playwright MCP intact
- ✅ No code changes required

### Verification of Postgres MCP Removal

The following development commands continue working exactly as before:

```bash
# Prisma operations (all continue working)
cd server
npm exec prisma migrate dev --name migration_name
npm exec prisma migrate deploy
npm exec prisma studio
npm exec prisma generate
npm exec prisma db seed

# Database operations (via Prisma, not postgres MCP)
npm test                              # All 771+ tests pass
npm run test:integration              # Integration tests unchanged
npm run dev:api                       # API server starts normally

# No need for direct postgres MCP access
# All database queries go through Prisma ORM
```

## Why Postgres MCP Was Unnecessary

### MAIS Architecture Pattern

```
Routes → Services → Repositories (Prisma) → Database
                                ↓
                           Prisma MCP (for inspection)
```

**All database operations go through Prisma:**

- Query execution: `prisma.{model}.findMany()`
- Migrations: `prisma migrate dev`
- Database introspection: `prisma studio`

**Postgres MCP would only be useful for:**

- Direct SQL queries (not needed - Prisma handles it)
- Raw SQL inspection (rarely needed - Prisma provides schema)
- Ad-hoc database administration (development rarely needs this)

### Multi-Tenant Isolation Requirement

MAIS requires all queries to be scoped by `tenantId`:

```typescript
// ✅ Correct pattern (Prisma)
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});

// ❌ Dangerous pattern (raw postgres MCP)
const packages = await db.query('SELECT * FROM packages');
```

Using raw SQL via postgres MCP bypasses:

- Prisma's type safety
- Multi-tenant scoping enforcement
- Repository pattern validation

This makes postgres MCP a **security risk** in MAIS.

## Related Documentation

- **`docs/solutions/database-issues/SCHEMA_DRIFT_PREVENTION.md`** - Database migration patterns
- **`docs/reference/ARCHITECTURE.md`** - Layered architecture with Prisma
- **`docs/guides/DEVELOPING.md`** - Database commands and workflows
- **`CLAUDE.md`** - Project guidelines (sections on Prisma usage)

## FAQ

### Q: Can I query the database directly now?

**A:** Yes, but go through Prisma:

```typescript
// Via Prisma MCP studio
npm exec prisma studio

// Via Prisma client in code
const data = await prisma.table.findMany({ where: { tenantId } });

// Via npm exec
npx ts-node -e "/* raw ts code */"
```

### Q: What if I need raw SQL for debugging?

**A:** Use Prisma's raw query capabilities:

```typescript
const result = await prisma.$queryRaw`SELECT * FROM "Package" WHERE "tenantId" = ${tenantId}`;
```

This maintains type safety and tenant scoping.

### Q: Will this affect Claude Code's AI capabilities?

**A:** No. In fact, it improves them by:

- Removing configuration warnings
- Reducing MCP startup time
- Focusing MCP tools on essential tasks (Prisma schema, Playwright E2E)

### Q: Can I add postgres MCP back later?

**A:** Not recommended due to:

- Multi-tenant security concerns
- Redundancy with Prisma
- Risk of raw SQL bypassing tenant scoping

Instead, use Prisma's features:

- `prisma studio` for visual database browser
- `prisma.$queryRaw` for complex queries
- Proper repository methods for application code

## Lessons Learned

### MCP Configuration Best Practices

1. **Don't over-configure MCP**
   - Only add servers that solve real problems
   - Avoid "nice to have" tools that create maintenance burden
   - Each MCP server = potential configuration issue

2. **MCP Servers Don't Inherit Environment**
   - Don't rely on `.env` files in MCP config
   - Pass environment variables explicitly in startup
   - Test MCP servers after environment changes

3. **Keep Primary Tools Close**
   - Use tools already in your dependency tree
   - Prisma handles database? Use Prisma MCP, not generic postgres server
   - Avoid duplicate tools with different configuration

4. **Document MCP Use Cases**
   - Before adding an MCP server, document why
   - Regular audits to remove unused servers
   - Keep `.mcp.json` minimal and focused

## Summary

| Aspect                 | Before                           | After                      |
| ---------------------- | -------------------------------- | -------------------------- |
| MCP Servers            | 3 (prisma, postgres, playwright) | 2 (prisma, playwright)     |
| Environment Warnings   | ✅ Yes (DATABASE_URL missing)    | ✅ No                      |
| Database Functionality | ✅ Preserved (via Prisma)        | ✅ Preserved (via Prisma)  |
| Type Safety            | ✅ Yes (Prisma)                  | ✅ Yes (Prisma only)       |
| Multi-tenant Scoping   | ✅ Enforced (repositories)       | ✅ Enforced (repositories) |
| Development Workflow   | ✅ Unchanged                     | ✅ Unchanged               |
| Test Suite             | ✅ 771+ tests                    | ✅ 771+ tests              |

**Result:** Cleaner configuration, same functionality, zero code changes.

---

**Commit Reference:** `80ac7c1` - chore: remove unused postgres MCP server
**Files Changed:** `.mcp.json` (7 lines removed)
**Breaking Changes:** None
**Tests Affected:** None
