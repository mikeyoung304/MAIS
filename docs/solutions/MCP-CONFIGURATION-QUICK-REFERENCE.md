# MCP Configuration Quick Reference

**Print this and pin it on your desk!**

---

## 30-Second Decision: Should I Add This MCP Server?

```
1. Does existing server already do this?
   YES → Don't add (remove overlap)
   NO  → Continue

2. Is use case clear & documented?
   NO → Defer, document blockers
   YES → Continue

3. Can I provide environment variables?
   NO → Defer, resolve blockers
   YES → Add with checklist
```

---

## MCP Server Checklist (Before PR)

- [ ] Use case documented in PR description
- [ ] Verified no overlap with existing servers
- [ ] All required environment variables listed
- [ ] Env var source determined (shell/config/settings)
- [ ] DEVELOPING.md updated with setup steps
- [ ] CLAUDE.md updated with new server info
- [ ] Tested MCP server works locally
- [ ] Verified startup time impact (< 2s extra)
- [ ] Manually granted permissions in Claude Code settings
- [ ] Confirmed no startup warnings (`claude --help`)

---

## Environment Variable Sources

| Source | How to Use | Example |
|--------|-----------|---------|
| **Shell Export** | Add to .zshrc/.bashrc | `export DATABASE_URL="..."` |
| **.mcp.json Config** | Add env section to server | `"env": { "DATABASE_URL": "..." }` |
| **Claude Code Settings** | Auto-discovered | Prisma reads project config |
| **.env Files** | ❌ DOESN'T WORK | Don't use for MCP |

---

## Current MAIS MCP Servers

| Server | Status | Setup | Tests |
|--------|--------|-------|-------|
| prisma | ✅ Active | Auto | `npm test` |
| playwright | ✅ Active | Auto | `npm run test:e2e` |

---

## Adding New Server - 5 Steps

### 1. Decision
```bash
# Check if overlap exists
grep -i "postgres\|sql\|database" .mcp.json
# If found → use existing
# If not → proceed
```

### 2. Update Configuration
```json
{
  "mcpServers": {
    "newserver": {
      "command": "npx",
      "args": ["-y", "newserver-mcp"]
    }
  }
}
```

### 3. Document Setup
**Add to DEVELOPING.md:**
```markdown
### New Server Setup
1. Export vars: `export VAR1="..."`
2. Grant permission in Claude Code settings
3. Test: `claude --help` (no warnings)
```

### 4. Grant Permission
1. Claude Code → Settings → MCP Servers
2. Find your server
3. Click "Grant Permission"
4. Restart Claude Code

### 5. Create PR
```markdown
## MCP: Add [Server Name]

**Use Case:** [What problem does this solve?]

**Setup:**
- Requires [env vars]
- See DEVELOPING.md

**Testing:**
- [ ] Tested locally
- [ ] Permissions granted
- [ ] Startup time < 2s overhead
```

---

## Code Review Checklist

When reviewing `.mcp.json` changes:

```bash
# Get the change
git diff main -- .mcp.json

# Verify use case
# → Is PR description clear?
# → Is it a real workflow improvement?

# Check overlap
grep -E "prisma|postgres|playwright|file|github" .mcp.json
# → Any duplication?

# Verify setup
git diff -- DEVELOPING.md CLAUDE.md
# → Are env vars documented?
# → Are setup steps clear?

# Test locally
# → Can you use the new server?
# → Are there startup warnings?
```

---

## Red Flags (Request Changes)

- [ ] No use case documented
- [ ] Overlaps with existing server capability
- [ ] No env var setup documented
- [ ] No mention of permission grant
- [ ] Startup time > 1 second additional
- [ ] Server never gets used after merge

---

## Green Flags (Approve)

- [ ] Clear use case solves real problem
- [ ] All env vars documented with source
- [ ] Setup instructions in DEVELOPING.md
- [ ] No overlap with existing servers
- [ ] Tested locally, no startup warnings
- [ ] CLAUDE.md updated

---

## Troubleshooting

### MCP Server Shows in .mcp.json but Doesn't Work

```bash
# 1. Verify permissions granted
# → Claude Code → Settings → MCP Servers → [Server] → Grant Permission

# 2. Check env vars
export VAR_NAME="value"
claude

# 3. Verify no warnings
claude --help 2>&1 | grep warning

# 4. Restart Claude Code completely
# → Not just reload, fully quit and restart
```

### Startup Warnings Like "MCP Not Found"

```bash
# Cause: Permissions not granted for new server

# Fix:
1. Open Claude Code
2. Settings → MCP Servers
3. Find warning server
4. Click "Grant Permission"
5. Restart Claude Code
```

### "Environment Variable Not Set"

```bash
# Cause: Env var not exported in shell

# Fix (temporary):
export VAR_NAME="value"
claude

# Fix (permanent):
# Add to ~/.zshrc or ~/.bashrc:
export VAR_NAME="value"

# Then reload shell:
source ~/.zshrc
```

---

## Environment Variable Sources Explained

### ✅ CORRECT: Shell Export
```bash
# In ~/.zshrc or ~/.bashrc
export DATABASE_URL="postgresql://..."

# Or in current session
export DATABASE_URL="..."
claude
```

### ✅ CORRECT: MCP Config
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["postgres-mcp"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### ❌ WRONG: .env Files
```bash
# In .env
DATABASE_URL="postgresql://..."

# MCP WON'T SEE THIS! Don't do this.
```

---

## One-Minute Permission Grant

1. Pull latest code with .mcp.json changes
2. Open Claude Code (bottom-left corner)
3. Click ⚙️ (Settings)
4. Click "MCP Servers"
5. For each new server, click "Grant Permission"
6. Restart Claude Code
7. Done!

---

## Decision Log: Current Servers

### Prisma ✅
- **Why:** Schema introspection, migrations
- **Startup:** < 200ms
- **Use Frequency:** Multiple daily during DB work
- **Status:** Keep

### Playwright ✅
- **Why:** E2E test automation
- **Startup:** None (lazy)
- **Use Frequency:** Daily during test dev
- **Status:** Keep

---

## When to Remove a Server

Remove MCP server if:
- Not used by team in past month
- Causes > 1s startup slowdown
- Overlaps with another server
- Environment setup is too complex
- Creates frequent warnings

**Process:**
1. Create issue proposing removal
2. Wait 48 hours for team feedback
3. If no objections, remove in PR
4. Update CLAUDE.md

---

## Links

- **Full Guide:** docs/solutions/MCP-CONFIGURATION-PREVENTION.md
- **Prisma MCP:** github.com/prisma/mcp-server-prisma
- **Playwright MCP:** github.com/microsoft/playwright-mcp
- **MCP Docs:** modelcontextprotocol.io

---

**Last Updated:** 2025-12-24
**Print This:** Yes, it's short!
