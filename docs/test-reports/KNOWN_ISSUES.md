# Known Issues

**Last Updated:** 2026-01-11
**Status:** Active tracking document for bugs and issues discovered during testing

---

## Table of Contents

- [Critical Issues](#critical-issues)
- [High Priority Issues](#high-priority-issues)
- [Medium Priority Issues](#medium-priority-issues)
- [Testing Notes](#testing-notes)

---

## Critical Issues

### Issue #1: Cache Invalidation Missing After Package Creation

**Status:** 🔴 Critical
**Discovered:** 2026-01-11
**Affects:** Tenant onboarding flow, AI-created packages
**Related:** Bug #18 from CLAUDE.md

#### Description

When the AI assistant creates new packages via the `upsert_services` tool, the changes don't appear in the admin UI for up to 15 minutes due to stale cache.

#### Steps to Reproduce

1. New tenant signs up
2. AI assistant creates packages (e.g., "Let's set up my services...")
3. User sends follow-up message (triggers soft-confirm and execution)
4. Packages are successfully created in database
5. Navigate to `/tenant/packages`
6. **Bug:** Only old default packages appear, new packages are invisible

#### Evidence

**Server logs show successful creation:**

```
[22:32:33] INFO: Segment created via onboarding
    segmentId: "cmkab7osu00064jp0oh9aa6gn"
    slug: "life-coaching-sessions"

[22:32:33] INFO: Package created via onboarding
    packageId: "cmkab7ouh00074jp0aynws4hk"
[22:32:33] INFO: Package created via onboarding
    packageId: "cmkab7owe00084jp0ynr53e5f"
[22:32:33] INFO: Package created via onboarding
    packageId: "cmkab7oxp00094jp0pl01brx1"
```

**But UI shows stale cached data:**

- "3 packages available"
- Only default packages (Basic, Standard, Premium at $0)
- New packages missing

#### Root Cause

The `/v1/tenant-admin/packages` endpoint uses a 15-minute cache via `catalog.service.ts`:

```typescript
async getAllPackages(tenantId: string) {
  return cachedOperation(this.cache, {
    prefix: 'catalog',
    keyParts: [tenantId, 'all-packages'],
    ttl: 900,  // 15 minutes!
  }, ...);
}
```

The `upsert_services` executor in `onboarding-executors.ts` creates packages but **does not invalidate the cache**.

#### Proposed Fix

**File:** `server/src/agent/executors/onboarding-executors.ts`

Add cache invalidation after package creation:

```typescript
registerProposalExecutor('upsert_services', async (tenantId, payload) => {
  // ... existing code creates packages ...

  return await prisma.$transaction(async (tx) => {
    // ... segment and package creation ...

    // NEW: Invalidate packages cache
    const cache = getCache(); // Or inject cache dependency
    await cache.del(`catalog:${tenantId}:all-packages`);

    return {
      action: 'created',
      // ... rest of response
    };
  });
});
```

#### Impact

- **User Experience:** Users believe their changes didn't save
- **Severity:** Critical for onboarding flow
- **Workaround:** Wait 15 minutes or restart server

#### Related Files

- `server/src/agent/executors/onboarding-executors.ts:61` - upsert_services executor
- `server/src/services/catalog.service.ts:82` - getAllPackages with cache
- `server/src/adapters/prisma/catalog.repository.ts:89` - getAllPackagesWithAddOns query
- `docs/solutions/patterns/mais-critical-patterns.md` - Prevention pattern #15

---

## High Priority Issues

### Issue #2: Misleading AI Feedback for T2 Proposals

**Status:** 🟡 High Priority
**Discovered:** 2026-01-11
**Affects:** All T2 (soft-confirm) proposal workflows
**Related:** Plan document `plans/fix-t2-onboarding-proposal-execution.md`

#### Description

The AI assistant tells users "Done. Created your... they're live now" immediately after creating a T2 proposal, but the proposal is still PENDING and requires a follow-up message to execute.

#### Steps to Reproduce

1. User: "Let's set up my services. I offer life coaching sessions: $150..."
2. **AI Response:** "Done. Created your Life Coaching Sessions with all three packages... they're live on your services page now."
3. User navigates away satisfied
4. **Reality:** Proposal is PENDING, nothing was created yet
5. User never sends follow-up message
6. Proposal remains orphaned forever

#### Evidence

**From server logs:**

```
[22:28:29] INFO: Proposal created
    proposalId: "cmkab2gxw00034jp092yn4jm3"
    toolName: "upsert_services"
    trustTier: "T2"
    status: "PENDING"  ← NOT EXECUTED YET
```

**AI's misleading response:**

> "Done. Created your Life Coaching Sessions with all three packages: - Single Session: $150 - 4-Session Package: $500 - 8-Session Package: $900 Say "wait" to undo. Otherwise they're live on your services page now."

#### Root Cause

The T2 soft-confirm system works as follows:

1. User message triggers tool → Creates PENDING proposal
2. AI responds with tool result
3. **User must send another message** → Triggers soft-confirm
4. Proposal executes on the follow-up message

The AI's response claims completion but step 4 hasn't happened yet.

#### Proposed Fix

Update the system prompt or tool response schema to provide accurate status feedback:

**Option A: Change AI response guidance**

```typescript
// In onboarding-system-prompt.ts
const T2_RESPONSE_GUIDANCE = `
When you create a T2 proposal (requires soft-confirm):
- DO NOT say "done" or "live" or "created"
- DO say "I've prepared X. Just send any message and I'll create it for you."
- Example: "I've prepared your packages. Send 'looks good' and I'll create them."
`;
```

**Option B: Add state indicator to tool responses**

```typescript
// In proposal.service.ts - return proposal status
return {
  action: 'proposal_created',
  status: 'PENDING',
  requiresConfirmation: true,
  confirmationPrompt: 'Send any message to confirm',
  // ... rest of response
};
```

#### Impact

- **User Experience:** Users believe work is complete when it's not
- **Severity:** High - causes confusion and orphaned proposals
- **Workaround:** Always send a follow-up message after AI claims completion

#### Related Files

- `server/src/agent/prompts/onboarding-system-prompt.ts` - System prompt
- `server/src/agent/proposals/proposal.service.ts:197` - softConfirmPendingT2
- `server/src/agent/orchestrator/orchestrator.ts:519` - Soft-confirm trigger
- `plans/fix-t2-onboarding-proposal-execution.md` - Detailed analysis

---

## Medium Priority Issues

### Issue #3: Package Count Doesn't Match After Creation

**Status:** 🟢 Medium Priority
**Discovered:** 2026-01-11
**Affects:** Dashboard metrics display

#### Description

Dashboard shows "3 packages available" before AND after creating 3 new packages via AI assistant. The count should show 6 packages total (3 default + 3 new).

#### Evidence

- Before creation: "3 packages available" (correct - 3 default packages)
- After creation: "3 packages available" (incorrect - should be 6 total)
- Database contains 6 packages (verified in logs)

#### Root Cause

Likely the same cache invalidation issue as #1, affecting the dashboard count query.

#### Impact

- **User Experience:** Minor confusion about package count
- **Severity:** Medium - cosmetic issue, doesn't block functionality
- **Workaround:** Refresh after cache expires

---

## Testing Notes

### Test Session: 2026-01-11 - Signup & Onboarding Flow

**Objective:** Test the complete new user signup and storefront setup flow using Playwright MCP

**Environment:**

- Development servers running on ports 3000 (Next.js) and 3001 (Express API)
- Test user: `e2etest@example.com`
- Browser: Playwright headless

**Test Steps Performed:**

1. ✅ Navigate to http://localhost:3000
2. ✅ Click "Get Handled" signup button
3. ✅ Auto-provisioned tenant account created
4. ✅ Landed in dashboard with Build Mode editor
5. ✅ AI Assistant loaded with onboarding flow (1/4)
6. ✅ Sent: "What should I do next to set up my storefront?"
7. ✅ AI identified 12 placeholder fields needing content
8. ✅ Sent: "Let's set up my services. I offer life coaching sessions: $150, $500, $900"
9. ❌ AI claimed "Done... they're live" (misleading - still PENDING)
10. ❌ Navigated to /tenant/packages - only showed 3 old $0 packages
11. ✅ Sent follow-up: "Great! Thanks for setting those up"
12. ✅ Soft-confirm triggered, packages created successfully in database
13. ❌ Refreshed /tenant/packages - still showed only 3 old packages (cache bug)

**What Works:**

- Instant tenant provisioning
- AI conversation and natural language understanding
- T2 proposal system (creates proposals correctly)
- Soft-confirm mechanism (executes on follow-up message)
- Database writes (packages created successfully)

**What's Broken:**

- AI gives false positive feedback ("they're live")
- Cache invalidation missing after writes
- UI shows stale data for 15 minutes

### Server Logs Analysis

**Key log entries proving successful execution:**

```
[22:32:32] INFO: T2 proposals soft-confirmed
    count: 1
    proposalIds: ["cmkab2gxw00034jp092yn4jm3"]

[22:32:32] INFO: Executing soft-confirmed proposals
    tenantId: "cmk8zi3h10000ffp0k9zov4sb"
    count: 1

[22:32:33] INFO: Segment created via onboarding
    segmentId: "cmkab7osu00064jp0oh9aa6gn"
    slug: "life-coaching-sessions"

[22:32:33] INFO: Package created via onboarding (3 times)
    - packageId: "cmkab7ouh00074jp0aynws4hk"
    - packageId: "cmkab7owe00084jp0ynr53e5f"
    - packageId: "cmkab7oxp00094jp0pl01brx1"
```

### Screenshots

Located in `.playwright-mcp/`:

1. `dashboard-onboarding-initial.png` - Initial Build Mode with AI assistant
2. `services-created.png` - AI claiming services were created
3. `final-packages-page.png` - Packages page showing old $0 packages (bug proof)
4. `packages-page-after-execution.png` - After soft-confirm, still showing stale data

---

## Template for New Issues

```markdown
### Issue #N: [Brief Title]

**Status:** 🔴 Critical | 🟡 High | 🟢 Medium | 🔵 Low
**Discovered:** YYYY-MM-DD
**Affects:** [Component/feature affected]
**Related:** [Links to related files, plans, or issues]

#### Description

[Clear description of the issue]

#### Steps to Reproduce

1. Step 1
2. Step 2
3. **Bug:** What happens

#### Evidence

[Logs, screenshots, code snippets]

#### Root Cause

[Technical explanation of why this happens]

#### Proposed Fix

[Code changes or approach to fix]

#### Impact

- **User Experience:** [How users are affected]
- **Severity:** [Why this priority level]
- **Workaround:** [Temporary solution if any]

#### Related Files

- `path/to/file.ts:line` - Description
```

---

## Contributing

When you discover a new issue:

1. Add it under the appropriate priority section
2. Use the template above for consistency
3. Include reproduction steps and evidence
4. Link to related files and plans
5. Update the "Last Updated" date at the top
6. If an issue is fixed, move it to a "Resolved Issues" section with fix date

---

## Resolved Issues

_No issues resolved yet_

---

**Notes:**

- Issues are numbered sequentially for easy reference
- Priority levels: 🔴 Critical (blocks core functionality), 🟡 High (significant UX impact), 🟢 Medium (minor issues), 🔵 Low (cosmetic)
- Related to existing prevention patterns in `docs/solutions/PREVENTION-QUICK-REFERENCE.md`
