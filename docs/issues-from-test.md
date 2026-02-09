# Onboarding UX Issues - February 7, 2026

**Test Date:** 2026-02-07
**Test URL:** https://www.gethandled.ai/tenant/dashboard
**Tenant:** Rio's Plans (wedding planner in Macon, GA)
**Tenant Slug:** `rerererer-1770426978827`
**Screenshots:** `onboarding-issues-2026-02-07.png`, `storefront-placeholder-content-2026-02-07.png`

---

## Executive Summary

Tested the onboarding flow on production (gethandled.ai) and discovered **8 critical issues** preventing the "wow moment" reveal from working. The most severe issue: **the agent claims to have the user's business information but has never written it to the storefront**. All content remains as placeholders.

### Smoking Gun Evidence

1. **Agent knows the details**: "Welcome back. Last time we covered that you're Rio's Plans, a wedding planner in Macon, GA, offering day-of, full planning, and consulting."

2. **Storefront shows 100% placeholders**: Hero headline is "[Your Transformation Headline]", About section says "Share your story, experience, and passion here...", Services are generic $0 packages.

3. **Agent admits failure**: When prompted to continue, agent responded "I seem to be having some technical difficulties" with a "Storefront ✓" tool indicator, then fell back to asking more questions.

4. **No logout button**: User is trapped in onboarding with no way to switch accounts or exit.

### Root Cause Hypothesis

The agent's `build_first_draft` or `update_section` tool is **failing silently inside the Cloud Run agent service**. All HTTP requests to/from the frontend succeed (200 responses), but the agent's internal tool execution throws an exception that's caught and converted into a graceful fallback ("Let's try something else").

**This creates a dead end:** Users think the system is working (agent still responds), agent thinks it's helping (asks follow-up questions), but **no content will ever be generated** until the underlying Cloud Run error is fixed.

### Priority Issues

| #   | Issue                                                  | Severity | Impact                                                      |
| --- | ------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| 4   | Reveal hasn't triggered despite sufficient data        | **P0**   | Core flow broken - no "wow moment"                          |
| 8   | Agent tool execution failure with graceful fallback    | **P0**   | Silent failure - impossible to debug without Cloud Run logs |
| 1   | No logout button during onboarding                     | **P0**   | User trapped in wrong account                               |
| 2   | Previous conversation history not showing              | **P1**   | Context loss reduces trust                                  |
| 5   | Agent state mismatch (says content exists but doesn't) | **P1**   | Agent confusion creates distrust                            |
| 7   | Possible legacy code stacking                          | **P1**   | Technical debt causing unpredictable behavior               |
| 3   | Session ID 404 error                                   | **P1**   | Conversation history lost                                   |
| 6   | Stripe status 404 error                                | **P2**   | Non-blocking, poor error handling                           |

### Required Actions

1. **Immediate:** Check Cloud Run logs for `tenant-agent` service around 2026-02-07 14:53 UTC (search for tenant slug `rerererer-1770426978827` or errors during tool execution)
2. **Database audit:** Check if `revealCompletedAt`, `OnboardingProgress.phase`, and `SectionContent` rows match expected state
3. **Code review:** Search for "MIGRATION", "TODO", "FIXME" comments older than 30 days (Pitfall #90 - dual-system migration drift)
4. **Add logout button:** Minimal header or "Log out" option in agent panel during onboarding

---

## Issue 1: No Logout Button During Onboarding (P0 - User Trapped)

### Description

When a new tenant is in the middle of onboarding, they don't see the full dashboard (by design), which means the logout button is also hidden. This creates a "locked in" experience where:

- User clicks "Login" on marketing site
- Browser auto-logs them into a previously-started onboarding session
- No way to log out or switch accounts
- User must either complete onboarding or manually clear cookies

### Current Behavior

- Onboarding dashboard shows: ComingSoon display + Agent panel + "Skip setup" button
- NO logout button visible anywhere in the UI
- No navigation header with account controls

### Expected Behavior

- Onboarding dashboard should include a logout option (top-right corner or in agent panel header)
- OR: Show minimal header with account menu even during onboarding
- OR: "Skip setup" button should offer "Log out" as an alternative action

### Impact

**Severity: P0 (High)** - Users cannot escape onboarding if they're in the wrong account or want to try a different signup flow.

---

## Issue 2: Previous Conversation History Not Showing (P1 - Context Loss)

### Description

When a tenant returns to continue onboarding, the chat panel should display the previous conversation (last few questions and replies), but currently only shows a single "Welcome back" summary message.

### Current Behavior

Chat panel shows:

```
[Agent message] Welcome back. Last time we covered that you're Rio's Plans,
a wedding planner in Macon, GA, offering day-of, full planning, and consulting.
Want to pick up where we left off?

[Tool indicator] Tool ✓
```

### Expected Behavior

Chat panel should show:

```
[Agent] What do you do, and who do you do it for?
[User] I'm a wedding planner in Macon, GA
[Agent] Great! What services do you offer?
[User] Day-of coordination, full planning, and consulting
[Agent] Got it. What makes your approach different?
[User] ...
---
[Agent] Welcome back. Last time we covered [summary]. Want to pick up...
```

### Technical Details

- Network log shows: `GET /api/tenant-admin/agent/tenant/session/2457e9b7-b337-4774-b05e-a5748905f020` => **404**
- This suggests the old session was deleted or doesn't exist
- A NEW session was created: `POST /api/tenant-admin/agent/tenant/session` => 200
- The new session may not have access to the old conversation history

### Impact

**Severity: P1 (High)** - Context loss makes users feel like the system "forgot" their previous interaction. Reduces trust in the AI assistant.

---

## Issue 3: Session ID 404 Error (P1 - Data Integrity)

### Description

The frontend is attempting to fetch a session that no longer exists on the backend.

### Error Details

```
[ERROR] Failed to load resource: the server responded with a status of 404 ()
@ https://www.gethandled.ai/api/tenant-admin/agent/tenant/session/2457e9b7-b337-4774-b05e-a5748905f020
```

### Possible Causes

1. **Session expiration** - Old session was expired/purged from the database
2. **Session cleanup** - System deleted inactive sessions
3. **Session ID mismatch** - Frontend cached an old session ID that's no longer valid
4. **Agent redeployment** - Agent service was redeployed and sessions weren't persisted

### Questions for Investigation

- **Where is the session ID stored on the frontend?** (localStorage? cookies? Zustand store?)
- **What triggers session creation vs. session reuse?** (Bootstrap data? First chat message?)
- **Is there a session TTL/expiration policy?**
- **Do sessions persist across agent redeployments?**

### Impact

**Severity: P1 (Medium)** - Causes console errors and conversation history loss. May block returning users from continuing onboarding.

---

## Issue 4: Reveal Hasn't Triggered Despite Sufficient Data (P0 - Core Flow Broken)

### Description

The agent has collected sufficient discovery facts to trigger the first draft build, but the UI is still showing "Your website is being crafted" (Coming Soon state) instead of revealing the website.

### Evidence of Sufficient Data

According to the agent's welcome-back message, the following facts are known:

- ✅ `businessType`: "wedding planner"
- ✅ `location`: "Macon, GA"
- ✅ `servicesOffered`: "day-of, full planning, and consulting"

According to the slot machine logic (`slot-machine.ts` lines 297-303), the first draft should trigger when:

```typescript
FIRST_DRAFT_REQUIRED = ['businessType', 'location']; // ✅ Both present
FIRST_DRAFT_OPTIONAL = ['servicesOffered', 'uniqueValue', 'dreamClient']; // ✅ servicesOffered present
readySections.length >= 3; // ❓ Unknown - needs verification
```

### Current State

- **UI State:** `coming_soon` (ComingSoon display showing)
- **Onboarding Phase:** "Services (3/4)" - This suggests the system thinks we're in the SERVICES phase
- **Preview Link:** `/t/rerererer-1770426978827?preview=draft&edit=true` - Link exists but clicking opens a tab (not tested yet)

### Expected Behavior

Based on the discovered facts, the system should have:

1. Called `build_first_draft` tool
2. Generated MVP sections (Hero, About, Services)
3. Called `update_section` for each
4. Triggered `RevealTransition` (3.3s animation)
5. Switched UI to `preview` state showing the live storefront

### User Report

> "Earlier interactions with this agent at this stage prompted it to tell me to look at my hero section as if it had created just the hero for me. But the site still says building, there's no website shown."

This suggests:

- **Agent believed it had built content** ("look at my hero section")
- **UI never received the REVEAL_SITE action** or ignored it
- **Possible race condition** between agent tool completion and frontend state updates

### CRITICAL EVIDENCE 1: Database State Confirms Root Cause

**Database Audit Results (2026-02-07):**

**Tenant Table Query:**

```sql
SELECT id, slug, "revealCompletedAt", branding
FROM "Tenant" WHERE slug = 'rerererer-1770426978827';
```

**Result:**

- **id:** `cmlbmify200002xg3q3hkx36u`
- **slug:** `rerererer-1770426978827`
- **revealCompletedAt:** `2026-02-07 01:16:25.915` ✅ **SET** (13.5 hours before test)
- **branding.discoveryFacts:** `{"location":"Macon, GA","businessName":"Rio's Plans","businessType":"wedding planner","servicesOffered":"Day of, full planning, and consulting"}` ✅ **PRESENT**

**SectionContent Table Query:**

```sql
SELECT * FROM "SectionContent"
WHERE "tenantId" = 'cmlbmify200002xg3q3hkx36u';
```

**Result:** **0 rows** ❌ **NO CONTENT EXISTS**

The SectionContent table contains 73 records for other tenants, but **ZERO rows for Rio's Plans**. The agent never wrote any section content to the database despite `revealCompletedAt` being set.

**This proves:**

1. ✅ The `build_first_draft` tool was called (it wrote `revealCompletedAt`)
2. ❌ The `update_section` tool calls failed or were never executed
3. ❌ The database is in an inconsistent state (reveal flag set, but no content)
4. ❌ The storefront falls back to placeholder content because no real content exists in the database

### CRITICAL EVIDENCE 2: Cloud Run Logs Show Silent Database Write Failure

**Investigation Date:** 2026-02-07 15:12 UTC
**Log Source:** Google Cloud Run - `tenant-agent` service
**Time Range Analyzed:** 2026-02-06 20:19 - 20:26 EST (01:19 - 01:26 UTC)

**Log Evidence:**

```
2026-02-06 20:26:01.462 | {"args":{"sectionId":"cmlbmigb300082xq3qt77hapw","headline":"Your Dream Wedding, Beautifully Pl..."}

2026-02-06 20:26:01.463 | {"level":"debug","msg":"[TenantAgent] Extracted tenantId from userId (colon format): cmlbmify200002xg3q3hkx36u"}

2026-02-06 20:26:01.463 | {"level":"info","msg":"[TenantAgent] update_section called","sectionId":"cmlbmigb300082xq3qt77..."}

2026-02-06 20:26:02.485 | {"level":"info","msg":"[TenantAgent] Tool result: update_section","result":"{\"success\":true,\"m..."}
```

**SMOKING GUN DISCOVERED:**

1. ✅ The `update_section` tool was **called** at `20:26:01.463 EST` (01:26 UTC)
2. ✅ The tool **reported success** at `20:26:02.485 EST`: `"result":"{\"success\":true,...}"`
3. ❌ The database contains **ZERO SectionContent rows** for this tenant (verified via Supabase query)
4. ⏱️ This occurred ~10 minutes AFTER `revealCompletedAt` was set (`01:16:25 UTC`)

**Conclusion:**

The agent's `update_section` tool is **reporting success to the LLM while failing to persist data to the database**. This creates a catastrophic silent failure mode where:

- The LLM thinks content was written (success response)
- The agent tells the user to "look at your hero section" (based on success response)
- The database remains empty (write never happened or was rolled back)
- The storefront shows 100% placeholders (because no real data exists)
- No error is logged or surfaced to developers

**Root Cause Hypothesis:**

One of the following is happening inside the `update_section` tool:

1. **Database write succeeds then gets rolled back** - Transaction failure after success reported
2. **Success response sent before write is confirmed** - Tool returns early, write fails async
3. **Wrong tenant ID used in write** - Data written to different tenant due to ID mismatch
4. **Validation fails after success check** - Zod validation passes initially but database constraint fails
5. **Mock mode interference** - Tool thinks it's in mock mode and skips real database writes

**Next Steps:**

- Expand the `update_section` log entry to see the full result object
- Check if there are any ERROR or WARNING logs immediately after the success response
- Review `update_section` tool code in `server/src/agent-v2/deploy/tenant/src/tools/` for race conditions
- Check for transaction rollback logs in PostgreSQL/Prisma query logs

### CRITICAL EVIDENCE 3: Storefront Has 100% Placeholder Content

**Screenshot:** `storefront-placeholder-content-2026-02-07.png`

Navigated to `/t/rerererer-1770426978827` (the storefront preview link) and found:

**What's showing (ALL PLACEHOLDERS):**

- **Hero Headline:** "[Your Transformation Headline]"
- **Hero Subheadline:** "[Who you help and the outcome they get. Example: 'Helping busy professionals find calm.']"
- **Hero CTA:** "[Book Your Session]"
- **About Title:** "About Me"
- **About Body:** "Share your story, experience, and passion here. Help potential clients understand who you are and why they should work with you."
- **Services:** Three generic packages (Basic/Standard/Premium) all priced at $0/session with generic descriptions
- **Contact:** "Contact information coming soon. Check back later!"

**What SHOULD be showing (based on agent knowledge):**

- **Business Name:** Rio's Plans
- **Business Type:** Wedding planner
- **Location:** Macon, GA
- **Services:** Day-of coordination, full planning, consulting
- **Personalized headline:** Something like "Macon Wedding Planning by Rio" (location-forward headline)
- **About section:** Should mention planning experience and approach
- **Services:** Three bookable wedding planning packages

**Conclusion:** The agent has the knowledge (proven by the "Welcome back" summary message) but has **NEVER written it to the storefront**. This confirms:

1. ❌ `build_first_draft` was never called, OR
2. ❌ `build_first_draft` was called but `update_section` was never called, OR
3. ❌ `update_section` was called but wrote placeholder content instead of generated content, OR
4. ❌ `update_section` wrote real content but was immediately overwritten by a subsequent operation

### Questions for Investigation

- **Has `revealCompletedAt` been written to the database for this tenant?**
  ```sql
  SELECT revealCompletedAt FROM Tenant WHERE slug = 'rerererer-1770426978827';
  ```
- **What is the current value of `OnboardingProgress.phase`?**
  ```sql
  SELECT phase FROM OnboardingProgress WHERE tenantId = ?;
  ```
- **Are there any section content rows for this tenant?**

  ```sql
  SELECT section, isDraft, content FROM SectionContent WHERE tenantId = ?;
  ```

  - **Expected:** If `build_first_draft` ran, should see rows for hero, about, services with `isDraft: true`
  - **If rows exist with placeholder content:** Tool executed but LLM didn't generate real content
  - **If rows don't exist:** Tool never executed or failed silently

- **Check agent logs for `build_first_draft` tool calls:**
  - Did the tool get called?
  - Did `update_section` get called 3 times (hero, about, services)?
  - Did `/mark-reveal-completed` get called?
  - What was the response from each call?
  - Search for tenant slug: `rerererer-1770426978827` in Cloud Run logs (tenant-agent service)

### Impact

**Severity: P0 (Critical)** - Core onboarding flow is broken. Users don't see the "wow moment" reveal even when they've provided sufficient information. Agent says content exists but UI shows "building" state.

---

## Issue 5: Agent State Mismatch (P1 - Agent Confusion)

### Description

The agent appears to have an inconsistent understanding of what content has been created vs. what the user can actually see.

### Symptoms

1. **Agent says:** "Look at my hero section" (implying content was created)
2. **UI shows:** "Your website is being crafted" (implying content hasn't been created yet)
3. **Phase indicator:** "Services (3/4)" (implying we're past hero/about and working on services)

### Possible Root Causes

1. **Tool execution succeeded but UI state didn't update** - Race condition between tool completion and frontend refresh
2. **Agent hallucinates section creation** - Agent thinks it called tools but didn't actually execute them
3. **Dashboard action not extracted** - `REVEAL_SITE` dashboardAction in tool results wasn't processed by frontend
4. **View state guards preventing reveal** - `coming_soon` state guards blocking `revealSite()` transition (see Pitfall #92)
5. **Legacy code conflict** - New reveal logic conflicting with old onboarding flow

### Questions for Investigation

- **Check AgentPanel.tsx `handleTenantAgentToolComplete()`:** Does it extract and process `dashboardAction` from tool results? (Pitfall #82)
- **Check agent-ui-store.ts guards:** Are there guards preventing `revealSite()` from running during `coming_soon` state? (Should NOT exist - only other actions are guarded)
- **Check agent Cloud Run logs:** Search for tenant slug `rerererer-1770426978827` and look for tool execution logs

### Impact

**Severity: P1 (High)** - Creates confusion and distrust. Agent says one thing, UI shows another. Users don't know if the system is working or broken.

---

## Issue 6: Stripe Status 404 Error (P2 - Non-Blocking)

### Description

The frontend is attempting to fetch Stripe connection status, which returns 404.

### Error Details

```
[ERROR] Failed to load resource: the server responded with a status of 404 ()
@ https://www.gethandled.ai/api/tenant-admin/stripe/status
```

### Possible Causes

1. **Mock tenant** - This tenant may be a test/mock tenant without Stripe integration
2. **Stripe not connected** - Tenant hasn't connected Stripe yet, and endpoint returns 404 instead of 200 with `{ connected: false }`
3. **Endpoint doesn't exist in production** - API route may not be deployed

### Impact

**Severity: P2 (Low)** - Non-blocking. Payments may not work but doesn't prevent onboarding testing. Should return 200 with `{ connected: false }` instead of 404 for better UX.

---

## Issue 7: Possible Legacy Code Stacking (P1 - Technical Debt)

### User Report

> "This thing seems confused. There may be legacy code stacked on top of each other."

### Hypothesis

The onboarding flow may have multiple implementations:

1. **Old onboarding flow** - Original implementation before dashboard rebuild
2. **New onboarding flow** - Phase 1-4 rebuild with Coming Soon → Reveal → Review → Publish
3. **Hybrid state** - System is running both, causing state conflicts

### Evidence

- Session ID 404 suggests old session storage mechanism
- Agent state mismatch suggests dual execution paths
- Phase indicator "Services (3/4)" vs. Coming Soon display suggests different state sources

### Files to Audit for Dead Code

Based on CLAUDE.md Pitfall #88 (Dead PostMessage handlers) and Pitfall #85 (Comment-code mismatch):

**Frontend:**

- `apps/web/src/lib/build-mode/` - Check for orphaned hooks/utilities
- `apps/web/src/hooks/useBuildModeSync.ts` - Is this the ONLY source of truth?
- `apps/web/src/components/agent/AgentPanel.tsx` - Check for dead dashboardAction cases
- `apps/web/src/stores/agent-ui-store.ts` - Check for dead view states or actions

**Backend:**

- `server/src/services/onboarding.service.ts` - Check for unused methods
- `server/src/services/section-content.service.ts` - Check for legacy vs. new paths
- `server/src/routes/internal-agent.routes.ts` - Check for duplicate session management

### Recommended Approach

1. Run `grep -rn "MIGRATION\|TODO\|FIXME\|HACK\|XXX" apps/web/src/ server/src/` to find tech debt comments
2. Search for "during migration" comments older than 30 days (Pitfall #90)
3. Check for dual implementations of same functionality
4. Verify DI wiring in `server/src/di.ts` matches what routes actually use

### Impact

**Severity: P1 (High)** - If legacy code is interfering with new code, it will cause unpredictable behavior and make debugging extremely difficult.

---

## Issue 8: Agent Tool Execution Failure with Graceful Fallback (P0 - Silent Failure)

### Description

When the user sent "Yes, let's pick up where we left off", the agent attempted to build content but encountered internal failures, then gracefully fell back to asking more questions instead of exposing the error or retrying.

### Agent Response

```
"I seem to be having some technical difficulties. Let's try something else.
I'm thinking we should work on the About section next. Give me the short
version of your story."

[Tool indicator: "Storefront ✓"]
```

### Network Analysis

All HTTP requests succeeded with 200 responses:

- `POST /api/tenant-admin/agent/tenant/chat => [200]` ✅ Agent responded
- `GET /api/tenant-admin/sections/draft => [200]` ✅ Frontend fetched draft sections
- No 4xx or 5xx errors in browser network logs

### Conclusion

The failure is happening **inside the agent service (Cloud Run)**, not in the frontend or backend API. Possible causes:

1. **Agent tool call failed internally** - `build_first_draft` or `update_section` threw an exception inside the agent
2. **Backend API called by agent returned error** - Agent called MAIS backend API (e.g., `/api/internal-agent/sections`) which returned 500 or validation error
3. **Permission/auth issue** - Agent's internal API token may be invalid or expired
4. **Timeout** - Tool execution exceeded timeout and was cancelled
5. **Validation error** - Generated content failed Zod validation in the backend

### Why This Is P0 Critical

**Silent failure mode** - The agent:

1. ✅ Knows it failed ("technical difficulties")
2. ✅ Gracefully recovers (asks more questions)
3. ❌ Doesn't log the error where developers can see it
4. ❌ Doesn't expose what actually failed
5. ❌ Doesn't retry or offer to retry

This creates a **dead end** where:

- Users think the agent is working (it's still responsive)
- Agent thinks it's helping (it's asking follow-up questions)
- Reality: No content will ever be generated until the underlying issue is fixed
- Developers have no visibility into the failure

### Required Investigation

**Check Cloud Run logs for tenant-agent service:**

```bash
# Search for the session or tenant slug
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tenant-agent AND textPayload=~'rerererer-1770426978827'" --limit 100 --format json

# Search for errors around the time of the test (2026-02-07 ~14:53 UTC)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tenant-agent AND severity>=ERROR AND timestamp>='2026-02-07T14:50:00Z'" --limit 100

# Look for tool execution logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tenant-agent AND textPayload=~'build_first_draft'" --limit 50
```

**What to look for in logs:**

- Exception stack traces
- HTTP error responses from internal API calls
- Timeout messages
- Validation errors (Zod parse failures)
- Auth/permission errors
- Tool execution start/end markers

### Impact

**Severity: P0 (Critical)** - Core onboarding flow silently fails. Agent appears to work but never generates content. No visibility into the root cause without access to Cloud Run logs.

---

## Immediate Next Steps

### 1. Verify Database State (5 minutes)

Run these queries against production database:

```sql
-- Get tenant details
SELECT id, slug, revealCompletedAt, branding
FROM Tenant
WHERE slug = 'rerererer-1770426978827';

-- Get onboarding progress
SELECT tenantId, phase, researchTriggered, discoveryFacts
FROM OnboardingProgress
WHERE tenantId = (SELECT id FROM Tenant WHERE slug = 'rerererer-1770426978827');

-- Get section content
SELECT section, isDraft, content
FROM SectionContent
WHERE tenantId = (SELECT id FROM Tenant WHERE slug = 'rerererer-1770426978827');

-- Get agent sessions
SELECT id, createdAt, lastActivityAt
FROM AgentSession
WHERE tenantId = (SELECT id FROM Tenant WHERE slug = 'rerererer-1770426978827')
ORDER BY createdAt DESC
LIMIT 5;
```

### 2. Check Agent Cloud Run Logs (10 minutes)

Search for tenant slug `rerererer-1770426978827` in Cloud Run logs:

- Filter to `tenant-agent` service
- Look for tool executions: `build_first_draft`, `update_section`, `store_discovery_fact`
- Look for errors or warnings
- Verify `/mark-reveal-completed` was called

### 3. Test Reveal Manually (5 minutes)

In browser console, force the reveal:

```javascript
// Get the Zustand store
const store = window.__ZUSTAND_STORE__; // Or however it's exposed

// Force reveal
store.getState().agentUIActions.revealSite();
```

If this works, the problem is in the trigger logic, not the reveal animation itself.

### 4. Check Bootstrap Data (5 minutes)

In browser console, check what bootstrap data was returned:

```javascript
// Check session storage or fetch bootstrap directly
fetch('/api/tenant-admin/agent/tenant/onboarding-state')
  .then((r) => r.json())
  .then(console.log);
```

Look for:

- `revealCompleted: boolean` - Should be `false` if reveal hasn't happened
- `discoveryFacts` - Should include businessType, location, servicesOffered
- `phase` - Should match what phase indicator shows
- `sessionId` - Should NOT be the 404'd session ID

---

## Questions for User

1. **When did you last interact with this tenant?** (To understand session expiration timeline)
2. **Do you remember the exact message the agent sent about "look at my hero section"?** (To understand what the agent thought it had done)
3. **Can you try clicking "View your storefront" link in the top right?** (To see if content exists but just isn't revealed)
4. **Have there been any agent redeployments recently?** (To understand if sessions were lost)
5. **Is this tenant a real signup or a mock/test tenant?** (To understand data integrity expectations)

---

## Related CLAUDE.md Pitfalls

- **#82** - dashboardAction not extracted from tool results
- **#83** - Agent asking known questions (slot policy context injection)
- **#85** - Comment-code mismatch in DI wiring
- **#86** - Agent onboarding says "first draft" but shows placeholders
- **#88** - Dead PostMessage handlers (zombie code)
- **#90** - Dual-system migration drift
- **#92** - Zustand actions bypassing coming_soon state

---

## Test Environment Details

**Browser:** Playwright (Chromium)
**Network Conditions:** Standard (no throttling)
**Viewport:** Desktop (default size)
**Date/Time:** 2026-02-07 ~14:48 UTC

**Successful Requests:**

- `/api/tenant-admin/sections/draft` => 200 (Draft sections fetched successfully)
- `/api/tenant-admin/agent/tenant/onboarding-state` => 200 (Bootstrap data fetched)
- `/api/tenant-admin/preview-token` => 200 (Preview token generated)
- `POST /api/tenant-admin/agent/tenant/session` => 200 (New session created)
- `POST /api/tenant-admin/agent/tenant/chat` => 200 (Chat message sent)

**Failed Requests:**

- `/api/tenant-admin/stripe/status` => 404
- `/api/tenant-admin/agent/tenant/session/2457e9b7-b337-4774-b05e-a5748905f020` => 404

**Aborted Requests:**

- `/api/auth/session` => ERR_ABORTED (Multiple times - likely race condition during navigation)
