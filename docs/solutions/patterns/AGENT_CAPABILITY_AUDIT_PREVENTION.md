---
module: MAIS
date: 2026-02-01
problem_type: architecture_gap
component: agent-v2/tools
symptoms:
  - E2E tests fail because agent lacks database CRUD tools
  - Agent successfully manipulates JSON config but misses actual data source
  - Users confused when agent says "Done" but visible result unchanged
  - Services section vs Pricing section mental model misalignment
root_cause: Agent tool coverage audit not enforced at design time; tools map to JSON fields, not database entities
resolution_type: prevention_strategy
severity: P1
tags: [agent, architecture, tool-design, data-sources, e2e-testing, capability-audit]
---

# Agent Capability Audit Prevention Strategy

**Issue:** Agent has storefront editing tools but no Package management tools, causing E2E failure where user requests "Set up my packages" and agent modifies a cosmetic text section instead.

**Root Cause:** Tool capability audit not performed during agent design. Tools created to match **UI form fields** (which read from JSON config) instead of **user data requests** (which need database entities).

---

## Prevention Strategy 1: Domain Entity to Tool Mapping Audit

**When:** During agent design (before implementing any tools)

**What:** Create exhaustive matrix of user requests → required operations → database entity → tool needed

### Audit Checklist Template

```markdown
# Agent Capability Audit: [Agent Name]

## User Story → Tool Mapping

| User Request               | User Needs          | Data Source   | DB Entity               | Tool Exists? | Priority |
| -------------------------- | ------------------- | ------------- | ----------------------- | ------------ | -------- |
| "Set up my packages"       | CRUD bookable items | Package table | Package                 | ❌ NO        | P1       |
| "Update pricing section"   | Modify text content | Config JSON   | landingPageConfig.draft | ✅ YES       | P2       |
| "Show my current services" | List packages       | Package table | Package                 | ❌ NO        | P2       |
| "Delete a service"         | Remove package      | Package table | Package                 | ❌ NO        | P1       |
| "Update service price"     | Modify price        | Package table | Package                 | ❌ NO        | P1       |

## Data Source Classification

### JSON Config Sections (Draft System)

- landingPageConfigDraft
- landingPageConfig.draft (wrapper format)
- Language/tone/branding text sections

**Tools needed:** Section CRUD operations (UPDATE/ADD/REMOVE/REORDER)
**Status:** ✅ IMPLEMENTED (storefront-write.ts)

### Database Entities (Actual Bookable Items)

- Package (pricing, duration, description)
- Segment (customer segments)
- Promotion (discount codes)
- CustomField (questionnaires)

**Tools needed:** Entity CRUD operations (CREATE/READ/UPDATE/DELETE)
**Status:** ⚠️ PARTIAL - Only Package missing (811)

### External Services (Integrations)

- Stripe (payment processing)
- Calendar (availability)
- Email (communications)

**Tools needed:** Integration operations
**Status:** ✅ IMPLEMENTED (via delegate-to-agent pattern)

## Gap Analysis

| Gap                    | Impact                         | Fix Effort | Owner             |
| ---------------------- | ------------------------------ | ---------- | ----------------- |
| No create_package tool | Can't fulfill "setup packages" | 2-4h       | Assigned          |
| No list_packages tool  | Agent can't show current state | 1-2h       | Depends on create |
| No update_package tool | Can't modify existing packages | 2-3h       | Depends on create |
| No delete_package tool | Can't remove old packages      | 2-3h       | Depends on create |

## Acceptance Criteria

- [ ] All user story requests mapped to operations
- [ ] All operations mapped to data sources
- [ ] All data sources have corresponding tools
- [ ] E2E test passes for each user story
- [ ] Tool capability matrix added to agent documentation
```

### Why This Works

1. **Forces exhaustive thinking**: Covers every possible user request
2. **Exposes gaps early**: Before tools are implemented
3. **Prevents "felt good" tools**: Only tools needed for user stories
4. **Guides prioritization**: P1 operations first
5. **Tracks dependencies**: Some tools depend on others

---

## Prevention Strategy 2: Data Source Classification at Tool Design Time

**When:** Before implementing any tool

**What:** Explicitly categorize whether tool reads/writes JSON config or database entity

### Tool Design Template

```typescript
/**
 * Package Management Tool
 *
 * CRITICAL CLASSIFICATION:
 * - Data Source: Database (Package table)
 * - Not JSON config! (vs storefront tools)
 * - User sees changes in: Services section of storefront
 * - Backend stores in: Package table + cache invalidation
 * - Agent can read via: list_packages tool
 * - Agent can write via: create/update/delete_package tools
 */

export const createPackageTool = new FunctionTool({
  name: 'create_package',
  description: 'Create a new bookable service package',
  parameters: z.object({
    name: z.string().describe('Package name (e.g., "Elopement Package")'),
    price: z.number().describe('Price in cents'),
    description: z.string().describe('What is included'),
    duration: z.number().optional().describe('Duration in minutes'),
  }),

  // CRITICAL: Tool execution flow includes state return
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { success: false, error: 'No tenant context' };

    // Validate input with Zod (pitfall #62)
    const result = createPackageParams.safeParse(params);
    if (!result.success) {
      return { success: false, error: result.error.errors[0]?.message };
    }

    // Call backend API
    const response = await callMaisApi('/manage-packages', tenantId, {
      action: 'create',
      ...result.data,
    });

    // PITFALL #52: Return updated state, not just confirmation
    if (response.success) {
      return {
        success: true,
        data: {
          package: response.package, // Full created object
          totalPackages: response.totalPackages,
          hasServices: true, // State indicator
          // Agent can now answer "How many packages?" without extra tool call
        },
      };
    }

    return { success: false, error: response.error };
  },
});
```

### Classification Checklist

For EVERY tool, answer:

- [ ] **Data source is:** `z.enum(['json_config', 'database_entity', 'external_service'])`
- [ ] **User sees changes in:** (Specify UI location)
- [ ] **Backend stores in:** (Table/config field name)
- [ ] **Visible impact:** (What actually changes on-screen)
- [ ] **Cache invalidation:** (How does UI know to update?)
- [ ] **Agent can read via:** (Corresponding read/list tool)

---

## Prevention Strategy 3: E2E Test Coverage Requirement

**When:** Before merging any new agent tool

**What:** E2E test that validates end-to-end impact from agent request → tool call → actual data change → visible UI update

### E2E Test Pattern

```typescript
// server/test/e2e/agent-package-management.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Agent Package Management E2E', () => {
  test('should create package via agent and show in Services section', async ({ page }) => {
    // 1. SETUP: Login as tenant
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'tenant@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="submit"]');
    await page.waitForURL('**/dashboard');

    // 2. AGENT REQUEST: Ask agent to create package
    await page.click('[data-testid="open-agent-chat"]');
    await page.fill(
      '[data-testid="agent-input"]',
      'Create a package called "Elopement Package" priced at $2,500 for 4 hours of coverage'
    );
    await page.press('[data-testid="agent-input"]', 'Enter');

    // 3. TOOL EXECUTION: Wait for tool response (not just proposal)
    await expect(page.locator('[data-testid="agent-message"]:last-child')).toContainText(
      'Elopement Package'
    );

    // 4. DATABASE VERIFICATION: Check backend
    const response = await page.request.get('/api/v1/tenant/packages');
    const packages = await response.json();

    const createdPackage = packages.find((p) => p.name === 'Elopement Package');
    expect(createdPackage).toBeDefined();
    expect(createdPackage.basePrice).toBe(250000); // cents
    expect(createdPackage.duration).toBe(240); // minutes

    // 5. UI VERIFICATION: Check preview iframe updates
    const iframe = page.locator('[data-testid="storefront-preview"]');
    const servicesSection = iframe.locator('[data-section="services"]');

    await expect(servicesSection).toContainText('Elopement Package');
    await expect(servicesSection).toContainText('$2,500');

    // 6. STATE RETURN TEST: Verify agent response includes state
    const lastMessage = page.locator('[data-testid="agent-message"]:last-child');
    await expect(lastMessage).toContainText('totalPackages'); // Indicator from tool response

    // 7. FOLLOW-UP TEST: Agent should not re-ask about packages
    await page.fill('[data-testid="agent-input"]', 'How many packages do I have now?');
    await page.press('[data-testid="agent-input"]', 'Enter');

    // Should answer from memory, not ask for packages again
    await expect(page.locator('[data-testid="agent-message"]:last-child')).toContainText('1');
    // (or whatever count is correct)
  });

  test('should update package and reflect changes in Services section', async ({ page }) => {
    // ... similar setup
    // Test: Agent updates existing package price
    // Verify: Package table updated AND UI reflects change
  });

  test('should distinguish between "Services" and "Pricing" sections', async ({ page }) => {
    // ... setup
    // User: "Update the pricing section to mention payment plans"
    // Agent: Calls update_section (modifies JSON config text)
    // User: "Add a new service called 'Corporate Events' for $5,000"
    // Agent: Calls create_package (modifies Package table)
    // VERIFY: Both actions worked correctly
    // - Pricing section shows "payment plans" text (from update_section)
    // - Services section shows "Corporate Events $5,000" (from create_package)
    // - They are NOT the same thing!
  });
});
```

### Why This Works

1. **Tests agent + tool + database + UI integration**: Not just tool alone
2. **Catches state return issues**: Test will fail if tool returns `{ success: true }` without data
3. **Documents intended behavior**: E2E test IS the specification
4. **Forces data verification**: Not just "did agent respond" but "did data actually change"
5. **Detects cache/preview issues**: UI refresh problems show up immediately

---

## Prevention Strategy 4: Tool Capability Index Documentation

**When:** After implementing tools

**What:** Create index document that explicitly lists:

- Every tool
- What data it touches
- What user stories it enables
- What it does NOT do

### Documentation Template

````markdown
# Tenant-Agent Tool Capability Index

## Tool Inventory

### Storefront Editing Tools (JSON Config)

**Purpose:** Modify draft storefront content

| Tool               | Action                 | Data Source            | Visible To         | Notes                  |
| ------------------ | ---------------------- | ---------------------- | ------------------ | ---------------------- |
| update_section     | Modify section content | landingPageConfigDraft | Preview (not live) | Text only, no layout   |
| add_section        | Create new section     | landingPageConfigDraft | Preview (not live) | From templates only    |
| remove_section     | Delete section         | landingPageConfigDraft | Preview (not live) | Sections not entities  |
| reorder_sections   | Move section           | landingPageConfigDraft | Preview (not live) | Position only          |
| publish_storefront | Apply changes          | Wrapper system         | Live customer view | Creates published copy |

**User Requests These Enable:**

- "Update my hero headline"
- "Add an FAQ section"
- "Remove the gallery section"
- "Update my about text"

**User Requests These DO NOT Enable:**

- ❌ "Update my packages" (needs Package table tools)
- ❌ "Add a new service"
- ❌ "Change pricing"
- ❌ "Delete a service"

---

### Package Management Tools (Database)

**Purpose:** Manage bookable services

| Tool           | Action         | Data Source   | User Sees In     | Notes               |
| -------------- | -------------- | ------------- | ---------------- | ------------------- |
| create_package | Create service | Package table | Services section | Full CRUD           |
| update_package | Modify service | Package table | Services section | Versioned           |
| delete_package | Remove service | Package table | Services section | Checks for bookings |
| list_packages  | Show services  | Package table | Service list     | Read-only           |

**User Requests These Enable:**

- ✅ "Set up my photography packages"
- ✅ "Create an Elopement Package"
- ✅ "Update the price of my Basic package"
- ✅ "Delete the old Gold package"
- ✅ "List my current services"

**User Requests These DO NOT Enable:**

- ❌ "Update the Pricing section" (needs storefront tools)
- ❌ "Edit the hero text"

---

### Known Gaps (Roadmap)

| Request                          | Why Not Supported        | Owner | ETA                 |
| -------------------------------- | ------------------------ | ----- | ------------------- |
| "Search the web for competitors" | Research-agent only      | —     | Delegation: 2026-Q1 |
| "Create a discount code"         | Promotion entity missing | —     | Phase 5             |
| "Set up custom questionnaire"    | CustomField missing      | —     | Phase 5             |

---

## Critical Disambiguation

### "Services" Section vs "Pricing" Section

| Aspect             | Services Section                          | Pricing Section                      |
| ------------------ | ----------------------------------------- | ------------------------------------ |
| **Data Source**    | Package table                             | landingPageConfigDraft JSON          |
| **What User Sees** | Bookable packages with "Book Now" buttons | Text describing pricing philosophy   |
| **Agent Tool**     | create_package, update_package            | update_section, add_section          |
| **Example**        | "Elopement Package $2,500 [Book Now]"     | "We offer flexible payment plans..." |
| **Modifying Tool** | `manage_packages` route                   | `update_section` tool                |
| **When to Use**    | "I have 3 packages..."                    | "Explain our pricing philosophy"     |

**CRITICAL:** Agent must disambiguate these in system prompt + tool descriptions!

---

## System Prompt Clarification

Add to agent system.ts:

```typescript
/**
 * CRITICAL: Data Source Awareness
 *
 * User requests fall into 3 categories:
 *
 * 1. PACKAGES (Database) - Bookable services
 *    Request: "Set up my photography packages"
 *    Use: create_package / update_package / delete_package / list_packages tools
 *    User sees: Services section on storefront
 *    Change is: LIVE immediately (database-backed)
 *
 * 2. STOREFRONT SECTIONS (JSON Config Draft) - Text content
 *    Request: "Update my hero text to say XYZ"
 *    Use: update_section / add_section / remove_section tools
 *    User sees: Preview (not live)
 *    Change is: In DRAFT only (must publish to go live)
 *
 * 3. SEARCH / RESEARCH - External knowledge
 *    Request: "What do competitors charge?"
 *    Use: Delegate to research-agent via agent-to-agent protocol
 *
 * Common confusion:
 * ❌ "Update pricing section" → Don't use update_section for prices!
 *    That only changes TEXT. Use create_package for actual bookable prices.
 */
```
````

---

## Detection Heuristics

### Red Flag: Tool Capability Mismatch

Check these when adding agent or tool:

1. **Agent can edit forms but not data**
   - ✅ Can modify landingPageConfig JSON
   - ❌ Cannot modify corresponding Package table
   - Fix: Add Package CRUD tools

2. **Multiple data sources for single concept**
   - ✅ "Services" could be landingPageConfig.sections OR Package table
   - ❌ Agent doesn't disambiguate which to edit
   - Fix: Add system prompt clarification + tool separation

3. **E2E test mismatch**
   - ✅ Agent says "I created your package"
   - ❌ Package table is unchanged
   - ❌ Only landingPageConfigDraft was modified
   - Fix: Tools must hit actual data source

4. **"Take a look" with no visible change**
   - ❌ Agent returns success indicators
   - ❌ Preview iframe shows no change
   - Root cause: JSON draft modified but wasn't published or data source was wrong
   - Fix: Verify cache invalidation + data source + publish workflow

---

## Approval Checklist: Before Merging Any New Agent

### Tool Capability Audit

```markdown
## Agent Tool Capability Review

- [ ] **Capability Index Created**: docs/agent-v2/deploy/[agent]/TOOL_CAPABILITY_INDEX.md
- [ ] **All user stories mapped**: Audit checklist completed
- [ ] **All data sources identified**: Classification template filled
- [ ] **No tool gaps**: Every user request has corresponding tool
- [ ] **System prompt clarifies data sources**: Ambiguities documented
- [ ] **E2E tests cover user stories**: Every request type tested
- [ ] **Tool state returns included**: No confirmation-only responses (pitfall #52)
- [ ] **Cache invalidation verified**: UI updates when data changes
- [ ] **Error messages non-leaking**: No tenant ID in errors (pitfall #60)

## Examples

If adding customer-agent:

- [ ] Can list available packages? (create_package exists)
- [ ] Can filter by category? (list_packages with filters)
- [ ] Can see pricing/duration? (Package fields returned)
- [ ] Can book appointment? (create_booking tool)

If adding tenant-agent:

- [ ] Can create packages? (create_package tool)
- [ ] Can update prices? (update_package tool)
- [ ] Can delete old services? (delete_package tool)
- [ ] Can see current services? (list_packages tool)

If adding research-agent:

- [ ] Can search web? (web_search tool)
- [ ] Can analyze competitors? (search + analysis pipeline)
- [ ] Can provide recommendations? (structured response format)
```

---

## Quick Decision Tree: "Do I Need a Tool?"

```
User requests feature X
    ↓
Does user need to read/write data?
    ├─ YES
    │  ├─ JSON config (storefront text)? → Section tools (update/add/remove)
    │  ├─ Database entity (packages, bookings)? → CRUD tools (create/read/update/delete)
    │  └─ External service (Stripe, Calendar)? → Integration tools (delegate if needed)
    └─ NO → Can respond from context, no tool needed

Does this entity already have tools?
    ├─ YES → Use existing tools
    └─ NO → Create tools (P1: blocking user stories)
```

---

## Integration with Existing Workflows

### Relation to Tool Design Process

1. **Step 1: Capability Audit** (this doc)
   - Map user stories → operations → tools

2. **Step 2: Tool Implementation** (tools/index.ts)
   - Implement CRUD tools for each entity
   - Follow state-return pattern (pitfall #52)
   - Use Zod validation (pitfall #62)

3. **Step 3: Backend Routes** (internal-agent.routes.ts)
   - Add `/manage-packages`, `/manage-segments`, etc.
   - Call service layer with tenant scoping

4. **Step 4: System Prompt** (system.ts)
   - Clarify data sources
   - Prevent Services vs Pricing confusion

5. **Step 5: E2E Testing** (e2e/agent-\*.spec.ts)
   - Test full workflow: request → tool → database → UI

6. **Step 6: Documentation** (TOOL_CAPABILITY_INDEX.md)
   - Publish index of what works/doesn't work

### Relation to Trust Tiers

- **T1 (auto-confirm):** Still need capability audit (e.g., read-only tools)
- **T2 (soft-confirm):** Audit ensures proposal preview is accurate
- **T3 (hard-confirm):** Audit ensures deletion has necessary guards

### Relation to Agent-to-Agent Delegation

When agent lacks capability, consider delegation instead of new tool:

```typescript
// PATTERN: Agent lacks web search, delegates to research-agent
if (userRequest.includes('search') || userRequest.includes('competitor')) {
  return {
    success: true,
    action: 'delegate_to_research_agent',
    message: 'Let me search the web for that information...',
    payload: { question: userRequest },
  };
}
```

---

## References

**Pitfall Index:**

- #52: Tool confirmation-only response (missing state return)
- #60: Dual-context tool isolation (tenant info leakage)
- #62: Type assertion without validation (runtime data)
- #88: Fact-to-Storefront bridge missing (tools implemented but not used)

**Related Docs:**

- AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md - State return patterns
- AGENT_TOOLS_PREVENTION_INDEX.md - Full tool design guide
- DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md - Multi-tenant tool safety
- CLAUDE.md → Agent Architecture section

**Test Patterns:**

- AGENT_TOOL_TEST_PATTERNS.md - Unit/integration/E2E test hierarchy

---

## Maintenance

**Last Updated:** 2026-02-01
**Status:** Active - apply to all new agents
**Applies To:** Agent-v2 architecture, all agents

When adding new tools or agents:

1. Run capability audit (checklist above)
2. Create tool capability index doc
3. Add E2E tests for each user story
4. Update this doc with findings
5. Archive lessons to `/docs/solutions/patterns/`

---

**Print this and review BEFORE designing new agent capabilities!**
