---
title: MCP Postgres Server Redundant Configuration
slug: mcp-postgres-redundant-server-configuration
category: integration-issues
severity: P3
component: Claude Code MCP
status: resolved
date_created: 2025-12-24
date_resolved: 2025-12-24
symptoms:
  - "Claude Code startup warning: [postgres] mcpServers.postgres: Missing environment variables: DATABASE_URL"
  - "/doctor shows MCP Config Diagnostics warning"
  - "Settings marked as valid but warning persists"
root_cause: Unused MCP server configured with environment variable that MCP cannot resolve from .env files
tags:
  - mcp
  - claude-code
  - configuration
  - environment-variables
  - postgres
  - prisma
related_docs:
  - docs/solutions/database-issues/supabase-ipv6-session-pooler-connection.md
  - docs/solutions/database-issues/database-client-mismatch-MAIS-20251204.md
  - .claude/PLAYWRIGHT_MCP_SETUP.md
  - .claude/ADVANCED_MCP_SETUP.md
---

# MCP Postgres Server Redundant Configuration

## Executive Summary

Claude Code displayed a warning about missing `DATABASE_URL` for the postgres MCP server. Investigation revealed the postgres MCP server was:
1. Never functional (no permissions granted in settings)
2. Redundant with Prisma MCP (which handles all database operations)
3. Causing warnings because MCP servers don't read `.env` files

**Solution:** Remove the unused postgres MCP server from `.mcp.json`.

## Problem Description

### Symptom

After restarting Claude Code v2.0.76, the `/doctor` command showed:

```
MCP Config Diagnostics

[Contains warnings] Project config (shared via .mcp.json)
Location: /Users/mikeyoung/CODING/MAIS/.mcp.json
└ [Warning] [postgres] mcpServers.postgres: Missing environment variables: DATABASE_URL
```

### Initial Misdiagnosis

First investigation focused on `~/.claude/settings.local.json` permission patterns:
- Found spaces in patterns: `Bash(npm :*)` instead of `Bash(npm:*)`
- Fixed permission patterns and deleted deprecated `config.json`
- Warning persisted after restart

### Actual Issue

The `.mcp.json` file contained a postgres MCP server that was never used:

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
        "DATABASE_URL": "${DATABASE_URL}"  // Cannot resolve from .env
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

## Root Cause Analysis

### Critical Discovery: MCP Environment Variable Handling

**MCP servers do NOT read `.env` files.** Environment variables must be:

1. **Shell-exported** before starting Claude Code
2. **Configured in `.mcp.json` args** (hardcoded or via shell expansion)
3. **Loaded by the tool itself** (Prisma MCP does this automatically)

The `${DATABASE_URL}` syntax in MCP config requires the variable to be available in the shell environment when Claude starts.

### Why the Warning Appeared Now

Claude Code v2.0.76 improved MCP diagnostics to warn about missing environment variables. Previously, the postgres server would silently fail to start.

### Investigation: Was Postgres MCP Ever Used?

Launched 4 parallel investigation agents to verify:

| Agent | Finding |
|-------|---------|
| Git History | postgres MCP added Nov 24, 2025 during early setup |
| Database Workflow | All DB operations use Prisma via Bash commands |
| MCP Server Analysis | **Zero permissions** granted for postgres MCP |
| DATABASE_URL Flow | Flows through Prisma, not MCP |

**Conclusion:** The postgres MCP server was added speculatively but never configured for actual use.

## Solution

### Remove Unused Postgres MCP Server

**Commit:** `80ac7c1`

```diff
 {
   "mcpServers": {
     "prisma": {
       "command": "npx",
       "args": ["-y", "prisma", "mcp"]
     },
-    "postgres": {
-      "command": "npx",
-      "args": ["-y", "@modelcontextprotocol/server-postgres"],
-      "env": {
-        "DATABASE_URL": "${DATABASE_URL}"
-      }
-    },
     "playwright": {
       "command": "npx",
       "args": ["-y", "@playwright/mcp@latest"]
     }
   }
 }
```

### Why This is Safe

- **Prisma MCP** provides all database tooling: `migrate-status`, `prisma-studio`, schema inspection
- **Multi-tenant security preserved** - Prisma enforces `tenantId` scoping; raw postgres MCP would bypass it
- **Zero code changes** - All npm commands, tests, and development workflows continue unchanged
- **No breaking changes** - 771+ tests pass, database operations unaffected

## Verification

After removing the postgres MCP server:

1. Restart Claude Code: `claude` or reopen terminal
2. Run `/doctor` - should show no MCP warnings
3. Verify Prisma MCP works: `mcp__prisma__migrate-status` tool available

## Prevention Strategies

### Before Adding MCP Servers

1. **Verify clear use case** - Document why this server is needed
2. **Check for overlap** - Does an existing server provide this capability?
3. **Understand env var requirements** - Can you provide them via shell or config?
4. **Grant permissions** - Add to Claude Code settings if needed
5. **Test after adding** - Run `/doctor` to verify no warnings

### MCP Server Configuration Checklist

- [ ] Server has explicit permissions in settings (if required)
- [ ] Environment variables are available (exported or hardcoded in config)
- [ ] Functionality doesn't overlap with existing servers
- [ ] Documented reason for inclusion
- [ ] Tested with `/doctor` after configuration

### Code Review Checklist for `.mcp.json` Changes

- [ ] New server has clear documented purpose
- [ ] Environment variables can be resolved (not dependent on .env)
- [ ] No redundancy with existing servers (especially Prisma)
- [ ] Permissions granted if server requires them
- [ ] PR includes testing instructions

## MCP Environment Variable Patterns

### Pattern 1: Shell Export (Before Starting Claude)

```bash
export DATABASE_URL="postgresql://..."
claude  # Now MCP can access ${DATABASE_URL}
```

### Pattern 2: Hardcode in Config (Not Recommended for Secrets)

```json
{
  "mcpServers": {
    "example": {
      "env": {
        "API_KEY": "actual-value-here"
      }
    }
  }
}
```

### Pattern 3: Tool Self-Loads (Best for Prisma)

Prisma MCP automatically reads from the project's `.env` file. No additional configuration needed.

## Comparison: Prisma MCP vs Postgres MCP

| Capability | Prisma MCP | Postgres MCP |
|-----------|-----------|-------------|
| Schema inspection | Yes | Yes |
| Migration status | Yes | No |
| Visual data browser | Yes (prisma-studio) | No |
| Raw SQL execution | No | Yes (read-only) |
| Reads .env automatically | Yes | No |
| Multi-tenant aware | Yes (via ORM) | No |

For MAIS, Prisma MCP is the correct choice because all database operations go through Prisma ORM with tenant isolation.

## Related Issues

- [GitHub Issue #1254](https://github.com/anthropics/claude-code/issues/1254) - Environment variables not passed to MCP servers (bug in env merging)
- ADR-013: PostgreSQL Advisory Locks - Database locking strategy uses Prisma transactions

## Lessons Learned

1. **MCP servers are subprocesses** - They don't inherit Node.js environment or `.env` files
2. **Add MCP servers intentionally** - Verify use case before adding
3. **Prisma MCP is sufficient** - For Prisma-based projects, it handles all database needs
4. **Claude Code diagnostics improved** - v2.0.76+ warns about missing env vars (helpful!)
5. **Parallel agent investigation** - 4 agents in parallel quickly validated the removal was safe

## FAQ

**Q: Why not just export DATABASE_URL in my shell?**

A: You could, but then you'd have a redundant MCP server. Prisma MCP already provides database tooling and reads from `.env` automatically. Adding postgres MCP gains nothing but adds configuration complexity.

**Q: What if I need raw SQL queries via MCP?**

A: Use Prisma's `prisma.$queryRaw()` via the application, or `psql` via Bash tool. The postgres MCP server is read-only anyway and wouldn't help with writes.

**Q: How do I know if an MCP server is being used?**

A: Check if permissions are granted in `.claude/settings.local.json`. If no `mcp__servername__*` permissions exist, the server is likely unused.
