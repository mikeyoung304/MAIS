---
title: Dual-System Migration Drift Prevention Strategies
date: 2026-02-04
status: active
priority: p1
tags: [architecture, migration, technical-debt, context-injection, session-management, prevention]
related:
  - SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md
  - SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md
  - DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md
  - EVENT_SOURCING_TO_STATE_MIGRATION_PATTERN.md
---

# Dual-System Migration Drift Prevention Strategies

Prevention strategies for the "during migration" technical debt pattern where two parallel systems diverge over time, causing P0 bugs when the OLD system's limitations become blocking.

---

## Executive Summary

| Pattern                   | Risk     | Impact                                                      |
| ------------------------- | -------- | ----------------------------------------------------------- |
| Dual-system drift         | Critical | NEW system exists but unused; OLD system lacks features     |
| Fake session IDs          | High     | Local IDs work for 1 message, fail on 2nd with "not found"  |
| Missing context injection | Critical | Agent asks known questions; P0 user experience degradation  |
| Incomplete migration      | High     | "During migration" comments become permanent technical debt |

**Key Insight:** Migrations create TWO systems that BOTH work initially. Over time, the NEW system gets features the OLD system lacks. When users need those features, they hit P0 bugs with no workaround.

---

## The Bug Pattern

### What Happened (Pitfall #91)

The tenant agent kept asking "What do you do?" even after users answered. Root cause analysis revealed:

1. **Frontend used OLD session system** - Created fake local session IDs
2. **Backend built NEW session system** - With `forbiddenSlots` context injection
3. **Missing endpoint** - `/api/v1/.../session` was never created, frontend fell back to fake IDs
4. **Result**: Agent had no context about known facts, asked redundant questions

### The Cascade

```
Migration Phase 1: Backend adds context injection to ADK sessions
                   ↓
                   Frontend still uses: sessionId = `tenant-${id}-${Date.now()}`
                   ↓
Migration Phase 2: "We'll update frontend later" (never happens)
                   ↓
6 months pass: Backend has forbiddenSlots, frontend has fake sessions
                   ↓
P0 Bug: Agent asks "What do you do?" when it already knows
```

### Why This Pattern Is Dangerous

```
          NEW SYSTEM                    OLD SYSTEM
          (Backend)                     (Frontend)
     ┌─────────────────┐           ┌─────────────────┐
     │ Real ADK        │           │ Fake local      │
     │ sessions with   │           │ session IDs     │
     │ forbiddenSlots  │           │ (no context)    │
     │ context         │           │                 │
     └─────────────────┘           └─────────────────┘
              │                            │
              │ ← Never connected! →       │
              │                            │
     Features added here          Users stuck here
```

---

## Detection Strategy 1: "During Migration" Comment Audit

### The Problem

Comments like "// during migration", "// temporary", "// TODO: update after migration" become permanent fixtures. After 30+ days, they indicate incomplete migrations.

### Detection Script

```bash
#!/bin/bash
# scripts/audit-migration-comments.sh
# Run weekly in CI to catch stale migration comments

echo "=== Migration Comment Audit ==="

# Find migration-related comments with git blame dates
MIGRATION_PATTERNS=(
  "during migration"
  "temporary"
  "TODO.*migrat"
  "FIXME.*migrat"
  "legacy.*will be removed"
  "old system"
  "after migration"
  "backward compat"
)

STALE_THRESHOLD_DAYS=30

for pattern in "${MIGRATION_PATTERNS[@]}"; do
  echo -e "\n--- Pattern: '$pattern' ---"

  grep -rn "$pattern" server/src/ apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    linenum=$(echo "$line" | cut -d: -f2)

    # Get last modification date of this line
    blame=$(git blame -L "$linenum,$linenum" --date=short "$file" 2>/dev/null | head -1)
    date=$(echo "$blame" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')

    if [ -n "$date" ]; then
      # Calculate age in days
      age_seconds=$(( $(date +%s) - $(date -d "$date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$date" +%s 2>/dev/null) ))
      age_days=$(( age_seconds / 86400 ))

      if [ "$age_days" -gt "$STALE_THRESHOLD_DAYS" ]; then
        echo "STALE ($age_days days): $file:$linenum"
        echo "  $line" | cut -d: -f3- | head -c 100
        echo ""
      fi
    fi
  done
done
```

### Automated Detection Test

```typescript
// server/test/prevention/migration-drift-detection.test.ts

import { execSync } from 'child_process';
import * as fs from 'fs';

describe('Migration Drift Detection', () => {
  const STALE_THRESHOLD_DAYS = 30;
  const MIGRATION_PATTERNS = [
    /during migration/i,
    /TODO.*migrat/i,
    /FIXME.*migrat/i,
    /temporary.*backward/i,
    /legacy.*will be removed/i,
  ];

  it('should not have stale migration comments older than 30 days', () => {
    const serverFiles = execSync('find server/src -name "*.ts" -type f')
      .toString()
      .trim()
      .split('\n');

    const staleComments: string[] = [];

    for (const file of serverFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of MIGRATION_PATTERNS) {
          if (pattern.test(line)) {
            // Get git blame for this line
            try {
              const blame = execSync(
                `git blame -L ${i + 1},${i + 1} --date=short "${file}" 2>/dev/null`
              ).toString();

              const dateMatch = blame.match(/\d{4}-\d{2}-\d{2}/);
              if (dateMatch) {
                const commitDate = new Date(dateMatch[0]);
                const ageMs = Date.now() - commitDate.getTime();
                const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

                if (ageDays > STALE_THRESHOLD_DAYS) {
                  staleComments.push(`${file}:${i + 1} (${ageDays} days old): ${line.trim()}`);
                }
              }
            } catch {
              // File not in git, skip
            }
          }
        }
      }
    }

    if (staleComments.length > 0) {
      console.error('Stale migration comments found:');
      staleComments.forEach((c) => console.error(`  ${c}`));
    }

    expect(staleComments).toHaveLength(0);
  });
});
```

---

## Detection Strategy 2: Dual-System Usage Analysis

### The Problem

Two systems exist for the same purpose. Metrics should show usage migrating from OLD to NEW. If OLD system has 100% usage after migration starts, migration is incomplete.

### Detection Queries

```typescript
// Add to server/src/services/metrics.service.ts

interface MigrationMetrics {
  oldSystemCalls: number;
  newSystemCalls: number;
  migrationPercentage: number;
  staleDays: number;
}

async function getMigrationMetrics(
  migrationName: string,
  oldPattern: RegExp,
  newPattern: RegExp
): Promise<MigrationMetrics> {
  // Query your logging/metrics system
  // Example with structured logs:
  const last7Days = await queryLogs({
    timeRange: '7d',
    patterns: [oldPattern, newPattern],
  });

  const oldCalls = last7Days.filter((l) => oldPattern.test(l.message)).length;
  const newCalls = last7Days.filter((l) => newPattern.test(l.message)).length;

  const total = oldCalls + newCalls;
  const migrationPercentage = total > 0 ? (newCalls / total) * 100 : 0;

  // Find when migration started (first newSystem call)
  const firstNewCall = await queryLogs({
    patterns: [newPattern],
    limit: 1,
    order: 'asc',
  });

  const staleDays =
    firstNewCall.length > 0
      ? Math.floor((Date.now() - firstNewCall[0].timestamp) / (1000 * 60 * 60 * 24))
      : 0;

  return { oldSystemCalls: oldCalls, newSystemCalls: newCalls, migrationPercentage, staleDays };
}

// Usage in health check
async function checkMigrationHealth(): Promise<HealthStatus[]> {
  const migrations = [
    {
      name: 'Session Context Injection',
      old: /fake-session-id|tenant-\d+-\d+/,
      new: /ADK session created|forbiddenSlots injected/,
    },
    {
      name: 'SectionContent Migration',
      old: /landingPageConfig read/,
      new: /SectionContentService\.get/,
    },
  ];

  const results: HealthStatus[] = [];

  for (const migration of migrations) {
    const metrics = await getMigrationMetrics(migration.name, migration.old, migration.new);

    if (metrics.migrationPercentage < 100 && metrics.staleDays > 30) {
      results.push({
        name: migration.name,
        status: 'warning',
        message:
          `Migration at ${metrics.migrationPercentage.toFixed(1)}% after ${metrics.staleDays} days. ` +
          `Old system: ${metrics.oldSystemCalls} calls, New system: ${metrics.newSystemCalls} calls.`,
      });
    }
  }

  return results;
}
```

### Log Pattern Detection

```typescript
// Add distinctive log prefixes to detect which system is in use

// OLD SYSTEM (should eventually have 0 calls)
logger.info(
  { sessionId: `tenant-${tenantId}-${Date.now()}` },
  '[LEGACY-SESSION] Created local session ID'
);

// NEW SYSTEM (should have 100% of calls)
logger.info({ sessionId, forbiddenSlots }, '[ADK-SESSION] Created session with context injection');
```

---

## Detection Strategy 3: Feature Parity Matrix

### The Problem

NEW system has features OLD system lacks. When users need those features, they hit walls.

### Feature Parity Tracking

```markdown
<!-- docs/migrations/SESSION_CONTEXT_MIGRATION.md -->

# Session Context Migration - Feature Parity Matrix

| Feature                | OLD System (Local IDs) | NEW System (ADK)     | Migration Status |
| ---------------------- | ---------------------- | -------------------- | ---------------- |
| Basic session creation | Yes                    | Yes                  | Complete         |
| Session persistence    | No (fake IDs)          | Yes                  | **BLOCKED**      |
| Context injection      | No                     | Yes (forbiddenSlots) | **BLOCKED**      |
| Multi-turn memory      | No                     | Yes                  | **BLOCKED**      |
| Known facts            | No                     | Yes                  | **BLOCKED**      |

## Migration Status

- **Complete**: Both systems have feature, can proceed
- **BLOCKED**: NEW system has feature OLD system lacks; P0 risk if users need it

## Action Required

[ ] Create `/api/v1/tenant-admin/agent/session` endpoint
[ ] Update frontend to call new endpoint
[ ] Remove fake session ID generation
[ ] Add E2E test: 2+ messages to verify session persistence
```

### Automated Parity Check

```typescript
// server/test/prevention/feature-parity.test.ts

describe('Session System Feature Parity', () => {
  describe('OLD system (local session IDs)', () => {
    it.skip('session persistence - KNOWN LIMITATION', () => {
      // This test documents that OLD system cannot persist sessions
      // Skip: Will always fail until migration complete
    });

    it.skip('context injection - KNOWN LIMITATION', () => {
      // OLD system cannot inject forbiddenSlots
    });
  });

  describe('NEW system (ADK sessions)', () => {
    it('session persistence', async () => {
      const service = createTenantAgentService();
      const sessionId = await service.createSession(tenantId);

      // First message
      const response1 = await service.sendMessage(sessionId, 'Hello');
      expect(response1.error).toBeUndefined();

      // Second message (proves session persists)
      const response2 = await service.sendMessage(sessionId, 'Follow-up');
      expect(response2.error).not.toBe('session_not_found');
    });

    it('context injection with forbiddenSlots', async () => {
      const service = createTenantAgentService();
      const sessionId = await service.createSession(tenantId);

      // Verify context was injected
      const session = await getSessionState(sessionId);
      expect(session.forbiddenSlots).toBeDefined();
      expect(Array.isArray(session.forbiddenSlots)).toBe(true);
    });
  });
});
```

---

## Prevention Checklist: Completing Migrations Properly

### Phase 1: Before Starting Migration

```markdown
## Pre-Migration Checklist

- [ ] **Document current system**: How does OLD system work?
- [ ] **Document target system**: How will NEW system work?
- [ ] **Feature parity matrix**: Create table of OLD vs NEW capabilities
- [ ] **Migration timeline**: Set deadline with buffer (max 30 days active migration)
- [ ] **Rollback plan**: How to revert if NEW system has issues?
- [ ] **Success criteria**: How do we know migration is complete?
```

### Phase 2: During Migration

```markdown
## Active Migration Checklist

- [ ] **Comment format**: Use `// MIGRATION[name]: expires YYYY-MM-DD: reason`
- [ ] **Logging**: Add distinctive prefixes to identify which system handles each request
- [ ] **Metrics**: Track OLD vs NEW system usage percentage
- [ ] **Feature gates**: Use feature flags to control rollout
- [ ] **Documentation**: Update as you go, not after
- [ ] **E2E tests**: Cover both OLD and NEW paths
```

### Phase 3: Completing Migration

```markdown
## Migration Completion Checklist

- [ ] **Usage metrics**: NEW system at 100%, OLD system at 0%
- [ ] **Remove OLD code**: Delete, don't comment out
- [ ] **Remove migration comments**: No "during migration" comments remain
- [ ] **Update documentation**: Remove dual-system references
- [ ] **Regression tests**: Ensure no code paths fall back to OLD system
- [ ] **Celebrate**: Communicate completion to team
```

---

## Code Review Flags

### Red Flags (Block PR)

```markdown
## Migration Code Review - Blocking Issues

1. **Fake session ID generation**
   - Pattern: `sessionId = \`${prefix}-${id}-${Date.now()}\``
   - Why: Creates local IDs that ADK won't recognize
   - Fix: Must call `service.createSession()` which calls ADK

2. **Missing context injection**
   - Pattern: `body: JSON.stringify({ state: { tenantId } })`
   - Why: Session created without business context
   - Fix: Use `ContextBuilder.getBootstrapData()` and pass full state

3. **Dual-system without migration plan**
   - Pattern: Two implementations of same feature, no timeline
   - Why: Will inevitably drift, causing P0 bugs
   - Fix: Add migration plan with deadline, feature parity matrix

4. **"During migration" comments without expiration**
   - Pattern: `// during migration` with no date
   - Why: Becomes permanent technical debt
   - Fix: Use format `// MIGRATION[name]: expires 2026-03-01: reason`
```

### Yellow Flags (Discuss)

```markdown
## Migration Code Review - Discussion Items

1. **Parallel write paths**
   - Pattern: Both OLD and NEW systems can write same data
   - Concern: May lead to inconsistency
   - Question: "Is there a single source of truth?"

2. **Feature flag without removal plan**
   - Pattern: `if (useNewSystem) { ... } else { ... }`
   - Concern: Both branches accumulate complexity
   - Question: "When will the flag be removed?"

3. **Migration older than 30 days**
   - Pattern: Active migration started >30 days ago
   - Concern: Technical debt compounding
   - Question: "What's blocking completion? Can we prioritize?"
```

---

## Testing Recommendations

### 1. Multi-Message Session Test

The fake session bug only manifests on the SECOND message. Single-message tests pass with fake IDs.

```typescript
// e2e/tests/agent-session-persistence.spec.ts

test('agent session persists across multiple messages', async ({ page }) => {
  await page.goto('/dashboard/agent');

  // Start chat
  await page.fill('[data-testid="chat-input"]', 'Hello');
  await page.click('[data-testid="send-button"]');

  // Wait for first response
  await page.waitForSelector('[data-testid="agent-response"]');

  // CRITICAL: Send SECOND message to verify session persistence
  await page.fill('[data-testid="chat-input"]', 'What services do I offer?');
  await page.click('[data-testid="send-button"]');

  // Second response should work (fake sessions fail here)
  const secondResponse = await page.waitForSelector('[data-testid="agent-response"]:nth-child(2)');

  const text = await secondResponse.textContent();
  expect(text).not.toContain('session expired');
  expect(text).not.toContain('Session not found');
  expect(text).not.toContain('error');
});
```

### 2. Context Injection Verification Test

```typescript
// server/test/integration/context-injection.test.ts

describe('Context Injection at Session Creation', () => {
  it('session receives forbiddenSlots from bootstrap data', async () => {
    // Setup: Tenant with known facts
    const tenant = await createTestTenant({
      branding: {
        discoveryFacts: {
          businessType: 'photographer',
          location: 'San Francisco',
        },
      },
    });

    // Create session
    const service = createVertexAgentService();
    const sessionId = await service.createSession(tenant.id);

    // Verify context was injected
    // Option A: Mock ADK and inspect call
    expect(mockAdkClient.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          forbiddenSlots: expect.arrayContaining(['businessType', 'location']),
        }),
      })
    );

    // Option B: Query ADK for session state
    const sessionState = await service.getSessionState(sessionId);
    expect(sessionState.forbiddenSlots).toContain('businessType');
    expect(sessionState.forbiddenSlots).toContain('location');
  });

  it('agent does not ask about known facts', async () => {
    const tenant = await createTestTenant({
      branding: {
        discoveryFacts: {
          businessType: 'photographer',
        },
      },
    });

    const service = createVertexAgentService();
    const sessionId = await service.createSession(tenant.id);

    // Send neutral opener
    const response = await service.sendMessage(sessionId, tenant.id, 'Hi there!');

    // Should NOT ask about business type
    expect(response.message.toLowerCase()).not.toContain('what do you do');
    expect(response.message.toLowerCase()).not.toContain('type of business');
    expect(response.message.toLowerCase()).not.toContain('what services');
  });
});
```

### 3. Migration Completion Regression Test

```typescript
// server/test/prevention/migration-completion.test.ts

describe('Session Migration Completion', () => {
  it('no code generates fake local session IDs', async () => {
    // Search codebase for fake session ID patterns
    const files = await glob('server/src/**/*.ts');
    const fakePatterns = [
      /sessionId\s*=\s*`.*\$\{.*\}-\$\{Date\.now\(\)\}`/,
      /sessionId\s*=\s*`tenant-\$\{/,
      /sessionId\s*=\s*`project-\$\{/,
      /sessionId\s*=\s*`session-\$\{/,
    ];

    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');

      for (const pattern of fakePatterns) {
        if (pattern.test(content)) {
          // Allow if marked as intentional local fallback
          if (!content.includes('LOCAL:') && !content.includes('// INTENTIONAL_LOCAL_SESSION')) {
            violations.push(`${file}: Contains fake session ID pattern`);
          }
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('all session creation calls service.createSession()', async () => {
    // Search for session creation that doesn't use service
    const routes = await glob('server/src/routes/**/*.ts');
    const violations: string[] = [];

    for (const file of routes) {
      const content = fs.readFileSync(file, 'utf-8');

      // If file mentions session but doesn't import service
      if (content.includes('sessionId') || content.includes('session')) {
        const hasServiceImport =
          content.includes('createVertexAgentService') ||
          content.includes('createTenantAgentService') ||
          content.includes('createCustomerAgentService');

        const hasDirectGeneration =
          /sessionId\s*=\s*`/.test(content) || /sessionId\s*=\s*['"]/.test(content);

        if (hasDirectGeneration && !hasServiceImport) {
          violations.push(`${file}: Direct session ID generation without service`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });
});
```

---

## Documentation Requirements

### 1. Migration Plan Template

```markdown
<!-- docs/migrations/MIGRATION_TEMPLATE.md -->

# Migration: [Name]

## Overview

- **Start Date:** YYYY-MM-DD
- **Target Completion:** YYYY-MM-DD (max 30 days from start)
- **Owner:** [Name/Team]
- **Status:** [Planning | Active | Completing | Done]

## Systems

### OLD System

- **Location:** `path/to/old/code`
- **How it works:** [Description]
- **Limitations:** [What it can't do]

### NEW System

- **Location:** `path/to/new/code`
- **How it works:** [Description]
- **Advantages:** [What it adds]

## Feature Parity Matrix

| Feature     | OLD      | NEW      | Migration Status   |
| ----------- | -------- | -------- | ------------------ |
| [Feature 1] | [Yes/No] | [Yes/No] | [Complete/Blocked] |

## Migration Steps

1. [ ] Step 1 with deadline
2. [ ] Step 2 with deadline
3. [ ] Remove OLD system code

## Rollback Plan

If NEW system has issues:

1. [Step to revert]
2. [Step to restore OLD system]

## Success Criteria

Migration is complete when:

- [ ] 100% of traffic uses NEW system
- [ ] OLD system code is deleted
- [ ] No "during migration" comments remain
- [ ] Documentation updated
```

### 2. Comment Format for Active Migrations

```typescript
// CORRECT: Expiring migration comment
// MIGRATION[session-context]: expires 2026-03-01: Using legacy session until frontend updated

// WRONG: Permanent migration comment
// during migration
// TODO: update after migration
// temporary backward compat
```

### 3. Post-Migration Documentation

After completing migration, document:

```markdown
<!-- docs/solutions/migrations/SESSION_CONTEXT_MIGRATION_COMPLETE.md -->

# Session Context Migration - Complete

**Completed:** 2026-02-04
**Duration:** 28 days (within 30-day target)

## What Changed

- **Before:** Frontend generated fake session IDs (`tenant-${id}-${Date.now()}`)
- **After:** Frontend calls `/api/v1/tenant-admin/agent/session` which creates real ADK sessions

## Why It Mattered

- Agent could not remember context between messages
- P0 bug: Agent asked "What do you do?" when it already knew

## Key Learnings

1. **Always create endpoint for frontend before backend feature**
2. **E2E tests must send 2+ messages to verify session persistence**
3. **30-day migration deadline prevents drift**

## Deleted Code

- `apps/web/src/hooks/useLegacySession.ts` (fake session generation)
- `// MIGRATION[session-context]` comments in 3 files

## Regression Prevention

- Test: `agent-session-persistence.spec.ts` sends 2 messages
- Lint rule: Blocks `sessionId = \`tenant-${` pattern
```

---

## Quick Reference Card

```
DUAL-SYSTEM MIGRATION DRIFT - QUICK REFERENCE

1. Detection: "During Migration" Comments
   - Run: scripts/audit-migration-comments.sh weekly
   - Flag: Comments older than 30 days are STALE
   - Action: Complete migration or document why blocked

2. Detection: Usage Metrics
   - Track: OLD system calls vs NEW system calls
   - Alert: If OLD > 0% after target completion date
   - Action: Investigate why traffic not migrating

3. Detection: Feature Parity
   - Document: What NEW system has that OLD lacks
   - Risk: P0 when users need NEW-only features
   - Action: Prioritize completing migration

4. Prevention: Migration Hygiene
   - Comment format: // MIGRATION[name]: expires YYYY-MM-DD: reason
   - Max duration: 30 days for active migrations
   - Tests: Multi-message for sessions (2+), not just single message

5. Testing: Session Persistence
   - CRITICAL: Single-message tests PASS with fake sessions
   - Always test: Send 2+ messages in E2E tests
   - Verify: Second message doesn't get "session not found"

6. Completion Checklist
   - [ ] NEW system at 100% usage
   - [ ] OLD system code DELETED (not commented)
   - [ ] No "during migration" comments remain
   - [ ] Documentation updated
   - [ ] Regression tests added
```

---

## Related Pitfalls (CLAUDE.md)

- **#85:** Fake session ID pattern - `tenant-${id}-${Date.now()}` instead of ADK createSession()
- **#91:** Agent asking known questions - Context not injected at session creation
- **#92:** Code path drift in duplicate implementations (retired after Phase 5)
- **#84:** Orphan service pattern - Service created but never wired to routes

---

## References

- **Slot-Policy Pattern:** `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- **Service Wiring:** `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
- **Dual Draft System:** `docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
- **Event Sourcing Migration:** `docs/solutions/database-issues/EVENT_SOURCING_TO_STATE_MIGRATION_PATTERN.md`
- **Context Builder:** `server/src/services/context-builder.service.ts`
- **Session Creation Fix:** `server/src/services/vertex-agent.service.ts`
