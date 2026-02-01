# Agent Testing Session Failure Report

**Date:** 2026-02-01
**Session:** End-to-end testing via Playwright MCP

---

## Environment

### GCP Projects (CRITICAL FINDING)

| Project     | ID             | Cloud Run Services                               | Status                       |
| ----------- | -------------- | ------------------------------------------------ | ---------------------------- |
| **Handled** | handled-484216 | 3 (customer-agent, research-agent, tenant-agent) | ✅ ACTIVE - Use this         |
| **MAIS**    | mais-480019    | 0                                                | ❌ EMPTY - Consider deleting |

**Action Required:** The MAIS project has zero Cloud Run services deployed. Either consolidate into Handled or delete to avoid confusion.

### Active Services (handled-484216)

| Agent          | Last Deployed       | Req/sec | URL                                                     |
| -------------- | ------------------- | ------- | ------------------------------------------------------- |
| customer-agent | 2026-01-31 09:02:40 | 0       | https://customer-agent-506923455711.us-central1.run.app |
| research-agent | 2026-01-29 08:42:16 | 0       | https://research-agent-506923455711.us-central1.run.app |
| tenant-agent   | 2026-02-01 11:35:41 | 0.01    | https://tenant-agent-506923455711.us-central1.run.app   |

---

## Failures Observed

### Failure #1: Agent Lacks Package Management Tools (CRITICAL)

**Symptom:** Services section shows generic "Basic Package", "Standard Package", "Premium Package" at $0/session despite agent saying it updated them.

**User request:**

> "Help me set up my photography packages. I offer: Elopement package at $2,500 for 4 hours, Full Day package at $5,000 for 8 hours with second shooter, and Luxury Destination package at $10,000 for multi-day coverage with travel included"

**Agent response:**

> "I can help with that. However, there isn't a specific tool to set up packages directly."

**Follow-up request:**

> "Update the services section with my three packages and their pricing"

**Agent response:**

> "Done. Take a look." (with Storefront ✓ indicators)

**Actual result:** Preview iframe still shows generic packages with $0 pricing.

**Root cause from logs:**

```
11:40:10.931 - Calling tool add_section with sectionType: "pricing"
11:40:11.153 - Tool result: success: true, Added pricing section to home
11:40:32.507 - Calling tool update_section with sectionId: home-pricing-1769964011041
11:40:32.783 - Tool result: success: true, Section updated in draft
```

The agent correctly added/updated a **pricing TEXT section**, but this is NOT the same as the **Services section** which displays actual bookable packages from the `Package` database table.

**Missing tools:**

- `create_package` - Create a new bookable service/package
- `update_package` - Modify existing package (name, price, description)
- `delete_package` - Remove a package
- `list_packages` - View current packages

**Files to implement:**

- `server/src/agent-v2/deploy/tenant/src/tools/packages.ts` - New tool file
- `server/src/services/package.service.ts` - Backend service for CRUD
- Add to `server/src/agent-v2/deploy/tenant/src/tools/index.ts`

---

### Failure #2: Agent Cannot Do Web Search

**User request:**

> "Can you search the web for wedding photography pricing in San Diego? I want to make sure my 3-tier packages are competitive with local photographers."

**Agent response:**

> "I am sorry, I cannot directly access the internet to search for pricing information. However, I can suggest you check out competitor websites in San Diego..."

**Root cause:** The tenant-agent does not have web search tools. Web research capability is isolated to the `research-agent`.

**Missing capability:** Either:

1. Add web search tools to tenant-agent, OR
2. Implement delegation to research-agent from tenant-agent

**Files to review:**

- `server/src/agent-v2/deploy/research/` - Research agent with web tools
- `server/src/agent-v2/deploy/tenant/src/tools/` - Tenant agent tools (missing web search)

---

### Failure #3: Services Section vs Pricing Section Confusion

**Architecture Issue:** The storefront has two overlapping concepts:

| Concept              | Source                        | Agent Can Edit? | Displays                                     |
| -------------------- | ----------------------------- | --------------- | -------------------------------------------- |
| **Services Section** | `Package` table in database   | ❌ NO           | Actual bookable packages with "Book" buttons |
| **Pricing Section**  | `landingPageConfigDraft` JSON | ✅ YES          | Text content only (no booking)               |

When the agent calls `add_section(type="pricing")` or `update_section`, it modifies the draft storefront content. But the **Services section** that shows "Basic Package", "Standard Package", "Premium Package" at $0/session is rendered from the **database Package records**.

**User expectation:** "Update my services" = update bookable packages
**Agent behavior:** Updates a text pricing section (cosmetic only)

---

### Failure #4: Tool Results Don't Reflect Actual State

The agent shows "Storefront ✓" indicators and says "Done. Take a look" but the preview doesn't reflect the changes because:

1. Agent updated a DRAFT pricing section
2. Preview iframe may be showing PUBLISHED content
3. The Services section comes from database, not draft config

**User confusion:** Agent claims success, but visible result unchanged.

---

## Successful Behaviors (What Worked)

- ✅ Discovery fact storage (`store_discovery_fact` tool)
- ✅ Hero section updates (headline, subtitle)
- ✅ About section updates
- ✅ FAQ section updates
- ✅ Contact section updates
- ✅ Testimonials section updates
- ✅ Publishing the website
- ✅ Session persistence (ADK session IDs now working)

---

## Recommended Fixes

### Priority 1: Add Package Management Tools

```typescript
// server/src/agent-v2/deploy/tenant/src/tools/packages.ts

export const createPackageTool = new FunctionTool({
  name: 'create_package',
  description: 'Create a new bookable service package',
  parameters: z.object({
    name: z.string().describe('Package name (e.g., "Elopement Package")'),
    price: z.number().describe('Price in cents'),
    description: z.string().describe('What is included'),
    duration: z.number().optional().describe('Duration in minutes'),
  }),
  execute: async (params, context) => {
    // Call MAIS API to create package
  },
});

export const updatePackageTool = new FunctionTool({
  name: 'update_package',
  description: 'Update an existing package',
  parameters: z.object({
    packageId: z.string(),
    name: z.string().optional(),
    price: z.number().optional(),
    description: z.string().optional(),
  }),
  execute: async (params, context) => {
    // Call MAIS API to update package
  },
});
```

### Priority 2: Web Search Integration

Either add web search tools to tenant-agent OR implement agent-to-agent delegation to research-agent.

### Priority 3: Clarify Section Types

Update agent system prompt to distinguish:

- "Services/Packages" = bookable items (use package tools)
- "Pricing section" = display content (use section tools)

---

## Log Locations

- **Cloud Console Logs:** https://console.cloud.google.com/run/detail/us-central1/tenant-agent/observability/logs?project=handled-484216
- **Render Backend Logs:** https://dashboard.render.com (check for API errors)

---

## Test Case for Verification

After implementing fixes, run this test:

1. Navigate to https://www.gethandled.ai/login
2. Login as tenant
3. Open agent chat
4. Say: "Create a package called 'Elopement Package' priced at $2,500 with 4 hours of coverage"
5. **Expected:** New package appears in Services section with correct name/price
6. **Verify:** Check database `Package` table for new record
