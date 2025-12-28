---
module: MAIS
date: 2025-12-24
problem_type: workflow_configuration
component: .mcp.json, environment configuration
symptoms:
  - MCP servers startup with environment variable warnings
  - Unused MCP servers consume memory and slow startup
  - Configuration drift between Claude Code settings and actual .mcp.json
  - Unclear which environment variable sources MCP servers read
root_cause: |
  1. MCP servers don't read .env files - they require shell-exported variables or MCP config
  2. MCP permissions not granted in Claude Code settings = dead configuration
  3. Prisma MCP has automatic config discovery (project-based)
  4. Postgres MCP requires explicit environment variables
  5. No decision framework for before adding new MCP servers
resolution_type: prevention_strategy
severity: P3
tags: [mcp, configuration, environment-variables, development-workflow]
---

# MCP Configuration Prevention Strategy

**Date:** 2025-12-24
**Severity:** P3 (Development Workflow)
**Impact:** Development velocity, startup warnings, environment configuration clarity

---

## Executive Summary

This document prevents MCP configuration issues by establishing:

1. **Decision framework** - Before adding MCP servers (verify use case, check for overlaps)
2. **Environment variable pattern** - Which MCP servers read from shell vs .mcp.json config
3. **Permission grant checklist** - Preventing dead configurations without settings permissions
4. **Code review checklist** - Detecting unused or misconfigured MCP servers in PRs

### Key Learnings from Recent Session

- **Prisma MCP** reads from project config automatically (`prisma/schema.prisma`)
- **Postgres MCP** requires explicit `DATABASE_URL` exported in shell
- **Environment variables** don't come from `.env` files - they must be shell-exported or in MCP config
- **Unused MCP servers** without permissions = startup warnings and memory overhead
- **Playwright MCP** enabled for browser automation (benefits clear: E2E testing support)

---

## Part 1: Before Adding MCP Servers

### Decision Tree: Should We Add This MCP Server?

```
┌─────────────────────────────────────────────────┐
│  "I want to add a new MCP server"              │
└──────────────────┬────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ Does an existing   │
         │ MCP server already │
         │ provide this?      │
         └─────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │ YES (overlap)       │ NO (unique need)
        └──────────┬──────────┘
                   │
    ┌──────────────▼──────────────┐
    │ ❌ REJECT                    │
    │ Use existing capability     │
    │ instead                      │
    └──────────────────────────────┘

        OR

    ┌──────────────▼──────────────────────────┐
    │ Is the use case clear and documented?  │
    └─────────────┬──────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │ YES               │ NO
        └─────────┬──────────┘
                  │
    ┌─────────────▼─────────────────────────────┐
    │ Can environment variables be provided?   │
    │ (shell export or .mcp.json config)       │
    └──────────┬─────────────────┬──────────────┘
               │                 │
        ┌──────▼─────┐    ┌──────▼──────┐
        │ YES        │    │ NO/UNCLEAR  │
        └──────┬─────┘    └──────┬──────┘
               │                 │
    ┌──────────▼────────────┐    │
    │ ✅ ADD MCP SERVER      │    │
    │ With checklist         │    │
    └────────────────────────┘    │
                                  │
                    ┌─────────────▼──────────────┐
                    │ ❌ DEFER                   │
                    │ Document blockers          │
                    │ Revisit when clear         │
                    └────────────────────────────┘
```

### Pre-Addition Verification Checklist

Before creating a pull request to add an MCP server:

- [ ] **Use case documented** - What feature/workflow does this enable?
- [ ] **No overlap check** - Search existing MCP servers for same capability
- [ ] **Environment variables identified** - List ALL required env vars (e.g., DATABASE_URL)
- [ ] **Source of env vars determined** - Where do they come from?
  - [ ] Shell export (how will developers set this?)
  - [ ] .mcp.json config (add to config section)
  - [ ] Claude Code settings (automatic)
  - [ ] Project discovery (automatic)
- [ ] **Startup impact assessed** - Will this slow down `claude` startup?
- [ ] **Permission grant planned** - Who needs to grant permissions in Claude Code UI?
- [ ] **Redundancy elimination** - Removing any other servers this replaces?

---

## Part 2: Environment Variable Sources for MCP Servers

### How MCP Servers Get Environment Variables

This table shows the THREE ways MCP servers access environment variables:

| MCP Server     | Primary Source         | Fallback               | Notes                                      |
| -------------- | ---------------------- | ---------------------- | ------------------------------------------ |
| **Prisma**     | Project auto-discovery | N/A                    | Reads `prisma/schema.prisma` automatically |
| **Playwright** | Shell exports          | Claude Code settings   | User provides browser config               |
| **Postgres**   | Shell exports          | `.mcp.json` env config | DATABASE_URL must be in shell              |
| **File**       | Project path           | N/A                    | File system access, no env vars            |
| **GitHub**     | Shell export           | Claude Code secrets    | GH_TOKEN from environment                  |

### Critical Rule: .env Files Don't Work

```bash
# ❌ WRONG - MCP servers don't read .env files
export DATABASE_URL="..."  # In .env
# MCP server won't see this

# ✅ CORRECT - Shell export
export DATABASE_URL="..."  # In shell or .zshrc/.bashrc
# MCP server sees this in parent process

# ✅ CORRECT - In .mcp.json config
{
  "mcpServers": {
    "postgres": {
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### Pattern: Prisma MCP (Automatic)

**What it does:** Provides Prisma schema introspection and migration support

**Environment:** Reads project config automatically

- No configuration needed
- No environment variables required
- Works on any project with `prisma/schema.prisma`

**Permissions:** Must be granted in Claude Code settings (Anthropic Cloud)

**Cost:** Minimal (only on-demand schema reads)

### Pattern: Postgres MCP (Requires Export)

**What it does:** Direct database query capability

**Environment:** Requires shell-exported `DATABASE_URL`

```bash
# In ~/.zshrc or ~/.bashrc
export DATABASE_URL="postgresql://user:pass@localhost/db"

# Or in current shell session
export DATABASE_URL="..."
claude  # Now MCP sees DATABASE_URL
```

**Permissions:** Must be granted in Claude Code settings

**Cost:** High - maintains database connection, increases memory usage

### Pattern: Playwright MCP (Settings-Based)

**What it does:** Browser automation for E2E testing

**Environment:** Uses Claude Code settings configuration

**Permissions:** Must be granted in Claude Code settings

**Cost:** Medium - spawns browser process on demand

**Use case:** E2E testing automation (clear value in MAIS)

---

## Part 3: Permission Grant Checklist

MCP servers require explicit permission grant in Claude Code settings. Without this:

- Server is configured but non-functional
- Startup warnings appear
- Memory is wasted on dead code
- Developers see confusing errors

### Before Committing .mcp.json Changes

- [ ] Each MCP server in .mcp.json has been manually granted permission in:
  - Claude Code settings → Claude Code Settings → MCP Servers
- [ ] Permission grant was done AFTER adding to .mcp.json (order matters)
- [ ] Test: `claude --help` shows no MCP-related warnings
- [ ] Test: Run a simple command using the MCP server (e.g., `@prisma schema`)

### After Merging to main

- [ ] Document in CLAUDE.md which MCP servers are available
- [ ] Document the permission grant process for new developers
- [ ] Create issue if any MCP server adds startup warnings

---

## Part 4: Current MAIS MCP Configuration

### Current .mcp.json

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

### Decision Log

| Server         | Added   | Reason                                     | Status    |
| -------------- | ------- | ------------------------------------------ | --------- |
| **prisma**     | Phase 1 | Schema introspection, migration support    | ✅ Active |
| **playwright** | Phase 2 | E2E test automation (Playwright E2E tests) | ✅ Active |

### Environment Variable Configuration

| Variable       | Source       | Used By                    | Notes                     |
| -------------- | ------------ | -------------------------- | ------------------------- |
| DATABASE_URL   | Shell export | Postgres client (if added) | Not needed for Prisma MCP |
| NODE_ENV       | Shell export | Process detection          | Optional                  |
| PLAYWRIGHT\_\* | Optional     | Playwright MCP             | Browser-specific config   |

---

## Part 5: Code Review Checklist for .mcp.json Changes

Use this when reviewing PRs that modify `.mcp.json`:

### Before Reviewing

```bash
# Get context on what changed
git diff main...HEAD -- .mcp.json

# Check if this is a new MCP server addition
grep -c "mcpServers" .mcp.json

# List all MCP servers currently configured
grep '"[a-z]*":' .mcp.json | head -10
```

### Review Checklist

- [ ] **Use Case Clear** - Is the PR description explaining why this MCP server is needed?
- [ ] **Overlap Check** - Does another server already provide this capability?
- [ ] **Environment Variables** - Are all required env vars listed in PR description?
- [ ] **Permissions Note** - Is there a note about manually granting permissions?
- [ ] **Startup Impact** - Did reviewers test startup time? (should be < 2s slower)
- [ ] **Documentation** - Is CLAUDE.md updated with new server info?
- [ ] **No Dead Code** - Is every server in .mcp.json actually being used?

### Red Flags (Request Changes)

- [ ] Server added without clear use case
- [ ] Required environment variables not documented
- [ ] No mention of permission grant process
- [ ] Overlaps with existing capability
- [ ] No test that MCP server actually works
- [ ] Server enabled but not used by team

### Green Flags (Approve)

- [ ] Use case clearly solves a real workflow problem
- [ ] All env vars documented with source
- [ ] Tested that permissions grant works
- [ ] No overlap with existing servers
- [ ] PR updated CLAUDE.md and/or README
- [ ] Startup impact validated

---

## Part 6: Decision Record: Current MCP Servers

### Prisma MCP ✅

**Approved:** Yes
**Use Case:** Schema introspection, migration management
**Frequency of Use:** Multiple times per day during database work
**Environment:** Automatic project discovery
**Startup Impact:** Minimal (~200ms)
**Alternative:** None (core feature)

**Decision:** Keep as standard MCP server

---

### Playwright MCP ✅

**Approved:** Yes
**Use Case:** E2E test automation and browser interaction
**Frequency of Use:** During test development, debugging
**Environment:** Browser config via settings
**Startup Impact:** None (lazy-loaded)
**Alternative:** Manual test running (slower)

**Decision:** Keep as standard MCP server

---

## Part 7: Adding a New MCP Server - Walkthrough

### Scenario: Adding Postgres MCP

Suppose we want to add direct database query capability via Postgres MCP.

### Step 1: Pre-Addition Verification

```
Question: Should we add Postgres MCP?

1. Use case clear? → YES (direct schema queries)
2. No overlap? → Check: Prisma MCP covers schema
   → Postgres MCP adds direct SQL queries (different capability)
3. Env vars? → DATABASE_URL required
4. Where from? → Shell export (must document in DEVELOPING.md)
5. Impact? → Moderate (maintains connection)
6. Can grant permission? → YES
```

### Step 2: Create Branch and Update .mcp.json

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
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgres-mcp"]
    }
  }
}
```

### Step 3: Document Environment Setup

**In DEVELOPING.md:**

````markdown
### Postgres MCP (Optional)

For direct database queries via Claude Code:

1. Ensure DATABASE_URL is exported in shell:
   ```bash
   export DATABASE_URL="postgresql://..."
   ```
````

2. Grant permission in Claude Code → Settings → MCP Servers → postgres

3. Test: Run `@postgres <query>` in Claude Code

````

### Step 4: Grant Permission Manually

1. Open Claude Code settings
2. Navigate to MCP Servers
3. Find "postgres" in list
4. Click "Grant Permission"
5. Test that @postgres commands work

### Step 5: Create PR with Checklist

```markdown
## Add Postgres MCP

### Use Case
Enable direct SQL query capability for schema introspection
and debug queries without leaving Claude Code.

### What Changed
- Added postgres MCP server to .mcp.json

### Environment Setup
- Requires DATABASE_URL in shell environment
- See DEVELOPING.md for setup instructions

### Testing
- [ ] Tested on local machine: `@postgres SELECT 1`
- [ ] Verified startup time < 2s additional
- [ ] Permissions granted manually in Claude Code settings

### Checklist
- [x] Use case documented
- [x] No overlap with existing servers
- [x] Environment variables documented
- [x] Permission process documented
- [x] DEVELOPING.md updated
````

### Step 6: Code Review

Reviewer checks:

- [ ] Use case is real need (not nice-to-have)
- [ ] DEVELOPING.md clearly documents DATABASE_URL setup
- [ ] No startup slowdown reported
- [ ] Tested that permissions grant works

### Step 7: Merge and Announce

```markdown
## Team Announcement

Postgres MCP is now available! This allows direct database queries.

Setup:

1. Pull latest code
2. Export DATABASE_URL: `export DATABASE_URL="..."`
3. Grant permission in Claude Code → Settings → MCP Servers
4. Test: `@postgres SELECT 1`

See DEVELOPING.md for details.
```

---

## Part 8: Quick Reference - MCP Configuration Checklist

### When Adding a New MCP Server

```markdown
Pre-Addition

- [ ] Use case documented in PR description
- [ ] No overlap with existing servers
- [ ] All environment variables identified
- [ ] Env var sources determined (shell/config/settings)
- [ ] Startup impact assessed

Implementation

- [ ] Added to .mcp.json with correct command/args
- [ ] DEVELOPING.md updated with setup instructions
- [ ] CLAUDE.md updated with new server info
- [ ] Environment variable documentation clear

Testing & Permissions

- [ ] Tested MCP server locally before PR
- [ ] Verified startup time (< 2s overhead)
- [ ] Manually granted permissions in Claude Code
- [ ] Confirmed permission grant removed warnings

Documentation

- [ ] PR has clear use case description
- [ ] PR documents env var setup for teammates
- [ ] PR links to any relevant docs updates
- [ ] Team announcement ready (if merged)

Code Review

- [ ] Reviewer checked use case is real
- [ ] Reviewer verified env setup is clear
- [ ] Reviewer approved CLAUDE.md changes
- [ ] No dead/unused MCP servers removed
```

### When Reviewing .mcp.json Changes

```bash
# Quick checks
git diff main...HEAD -- .mcp.json
grep -E '(command|args):' .mcp.json

# Verify no overlap
# Is this capability already provided?

# Check documentation
git diff main...HEAD -- DEVELOPING.md CLAUDE.md

# Ask reviewer
# 1. What is the use case?
# 2. What env vars are needed?
# 3. Is there startup impact?
# 4. Have permissions been granted?
```

---

## Part 9: Common Mistakes and Fixes

### Mistake 1: Adding MCP Server Without Permissions

**What happens:**

- Server in .mcp.json but startup shows warning
- Developers confused why it's not working
- Memory wasted on dead configuration

**Prevention:**

- Always grant permission AFTER adding to .mcp.json
- Test with `claude --help` (no warnings)
- Document permission grant process in PR

**Fix:**

```bash
# If you see warnings after adding to .mcp.json:
1. Open Claude Code → Settings → MCP Servers
2. Find the new server in list
3. Click "Grant Permission"
4. Restart Claude Code
5. Verify: claude --help (no warnings)
```

### Mistake 2: Adding MCP Server That Overlaps Existing One

**What happens:**

- Two servers do same thing
- Memory overhead for unused capability
- Confusion about which to use

**Prevention:**

- Always search existing MCP servers first
- Document why new server is needed (different capability)
- Code reviewer should flag overlaps

**Example:** Don't add Postgres MCP AND Prisma MCP for schema queries

- Prisma MCP handles schema introspection
- Add Postgres MCP only for direct SQL queries (different capability)

### Mistake 3: Required Environment Variables Not Exported

**What happens:**

- New developer clones repo
- Gets error when trying to use MCP server
- Unclear how to fix

**Prevention:**

- Document in DEVELOPING.md where env vars come from
- Add setup instructions for each server
- Create issue if env var setup is unclear

**Example Documentation:**

````markdown
### Setting Up Postgres MCP

1. Get database URL from Supabase dashboard
2. Export in shell:
   ```bash
   export DATABASE_URL="postgresql://..."
   ```
````

3. Grant permission in Claude Code settings
4. Test: `@postgres SELECT 1`

````

### Mistake 4: Adding MCP Server for "Nice-to-Have" Feature

**What happens:**
- Server added without clear use case
- Team doesn't use it
- Memory and startup time wasted
- Confusion about why it's there

**Prevention:**
- Require clear use case in PR description
- Document frequency of use
- Code reviewer asks: "Is this solving a real problem?"
- Decision: "If it's not used by 50% of team, remove it"

---

## Part 10: Maintenance & Monitoring

### Weekly Check (Friday)

```bash
# Are all MCP servers still needed?
cat .mcp.json | grep -o '"[a-z]*":' | tr -d '":' | while read server; do
  echo "Checking usage of $server..."
  # Analyze: Is this used?
done

# Any startup warnings?
claude --help 2>&1 | grep -i warning
````

### Monthly Review (First Friday)

- [ ] Audit which MCP servers are actually used
- [ ] Remove any servers that aren't being used
- [ ] Update CLAUDE.md if needed
- [ ] Check for new MCP servers that might benefit team

### Decision to Remove MCP Server

Consider removal if:

- Not used by team in past month
- Causes startup slowdown (> 1s overhead)
- Causes memory issues
- Overlaps with another server
- Environment setup is too complex

**Process:**

1. Create issue proposing removal
2. Request feedback from team (48 hours)
3. If no objections, create PR removing server
4. Update CLAUDE.md to document removal

---

## Part 11: Documentation Template for New MCP Server

Use this template when adding a new MCP server:

```markdown
# MCP Server: [Name]

## Use Case

[What problem does this solve? Why do developers need it?]

## Environment Setup

[How do developers get environment variables?]

### For Local Development

1. [Step 1]
2. [Step 2]
3. Test: [Command to verify it works]

### For CI/CD

[If applicable, how is this configured for automated runs?]

## Permissions

Grant permission in Claude Code → Settings → MCP Servers → [Server Name]

## Usage

[How do developers use this? Examples?]

## Troubleshooting

- **Error: "MCP not found"** → Grant permission in settings
- **Error: "Env var not set"** → Export [VAR_NAME] in shell
- **Slow startup** → This is normal on first run (caches dependencies)

## Alternatives

[If developer doesn't want to use this, what are alternatives?]

## Decision Record

- **Added:** [Date]
- **Frequency of Use:** [Daily/Weekly/Monthly]
- **Startup Impact:** [Time in ms]
- **Maintenance:** [Who maintains this?]
```

---

## Part 12: Integration with CLAUDE.md

### Recommended CLAUDE.md Section

Add to main CLAUDE.md:

````markdown
## MCP Servers Configuration

MAIS uses MCP (Model Context Protocol) servers to extend Claude Code capabilities.

### Available Servers

| Server     | Use Case                         | Setup               | Permissions  |
| ---------- | -------------------------------- | ------------------- | ------------ |
| prisma     | Schema introspection, migrations | Automatic           | Auto-granted |
| playwright | E2E test automation              | Automatic           | Manual grant |
| postgres\* | Direct SQL queries               | Export DATABASE_URL | Manual grant |

\*Not currently enabled. See [MCP Configuration Prevention](./docs/solutions/MCP-CONFIGURATION-PREVENTION.md)

### Permission Grant Process

After pulling code with .mcp.json changes:

1. Open Claude Code
2. Click Settings (⚙️)
3. Navigate to "MCP Servers"
4. For each new server, click "Grant Permission"
5. Restart Claude Code
6. Verify: `claude --help` shows no warnings

### Environment Variables

MCP servers **do not read .env files**. Environment variables must be:

1. **Shell-exported:**
   ```bash
   export DATABASE_URL="postgresql://..."
   claude  # Now sees DATABASE_URL
   ```
````

2. **In .mcp.json config:**

   ```json
   {
     "mcpServers": {
       "postgres": {
         "env": { "DATABASE_URL": "..." }
       }
     }
   }
   ```

3. **In Claude Code settings:** (automatic for some servers)

See each server's documentation for setup details.

### Adding New MCP Servers

See [MCP Configuration Prevention Strategy](./docs/solutions/MCP-CONFIGURATION-PREVENTION.md) for:

- Decision framework
- Pre-addition checklist
- Permission grant process
- Code review guidelines

```

---

## References

**Related Documentation:**
- CLAUDE.md - MCP servers section
- DEVELOPING.md - Environment setup
- .mcp.json - Current configuration
- .env.example - Environment variables template

**External Resources:**
- [Anthropic MCP Documentation](https://modelcontextprotocol.io/)
- [Prisma MCP Server](https://github.com/prisma/mcp-server-prisma)
- [Playwright MCP Server](https://github.com/microsoft/playwright-mcp)

---

**Document Status:** Complete
**Last Updated:** 2025-12-24
**Maintainer:** Architecture Team
**Next Review:** 2025-01-24
```
