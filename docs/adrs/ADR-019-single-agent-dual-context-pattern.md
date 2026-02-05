# ADR-019: Single Agent Dual-Context Pattern for Project Hub

**SUPERSEDED:** This ADR described the dual-context agent pattern which was replaced by physically separate agents (see ADR-020).

**Status:** Superseded by ADR-020
**Date:** 2026-01-24
**Deciders:** Engineering Team, Claude Sonnet 4.5 (Phase 1 implementation)
**Technical Story:** Project Hub security hardening and architecture evolution

---

## Context

**What is the issue or situation that motivated this decision?**

The Project Hub Agent serves two distinct user types:

1. **Customers** - End users who booked a service and need to communicate with the provider, check status, request changes, etc.
2. **Tenants** - Service providers who need to manage customer requests, send messages, update project status, etc.

These user types have different permissions, see different tools, and should never access each other's data or capabilities. The question arose: **Should we deploy separate agents for each user type, or use a single agent with programmatic context separation?**

### Requirements

- **Security:** Customers must NEVER be able to call tenant tools (and vice versa)
- **Data Isolation:** Each user should only see data they're authorized to access
- **Trust Tiers:** High-risk actions (cancellations, refunds) require explicit confirmation
- **Operational Simplicity:** Easy to deploy, monitor, and debug
- **Performance:** Low latency for chat interactions

### Constraints

- Using Google ADK (Agent Development Kit) for agent implementation
- Deployed on Cloud Run
- Backend API on Render (Express.js)
- Must integrate with existing MAIS multi-tenant architecture

## Decision

**We will use a single agent with programmatic context enforcement rather than splitting into separate customer and tenant agents.**

### Key Implementation Points

1. **Tool Context Guards:** Every tool has a `requireContext(ctx, 'customer'|'tenant')` guard as its FIRST LINE
2. **Session-Based Context:** The backend sets `contextType` in session state - not the user
3. **Four-Tier Tenant ID Extraction:** Robust fallback chain for extracting tenant context
4. **T3 Confirmation:** High-risk operations require `confirmationReceived: true` parameter
5. **Ownership Verification:** Tools verify session owns the resource being accessed

### How It Works

```typescript
// Context guard pattern - applied to every tool
const tenantOnlyTool = new FunctionTool({
  execute: async (params, ctx) => {
    // Security: Check context FIRST
    const contextError = requireContext(ctx, 'tenant');
    if (contextError) return contextError;

    // Security: Verify ownership
    const session = getContextFromSession(ctx!);
    // ... tool logic with verified context
  },
});
```

## Alternatives Considered

### Option 1: Split into Two Agents (CustomerHubAgent + TenantHubAgent)

**Description:** Deploy separate agents with completely isolated codebases

**Pros:**

- Physical separation eliminates any possibility of tool bleed
- Focused prompts (easier to tune per audience)
- Independent evolution and deployment
- Clearer testing boundaries

**Cons:**

- Two Cloud Run deployments (2x cost, 2x monitoring)
- Cannot share context (tenant can't see customer's questions)
- Session migration complexity if context needs to switch
- A2A protocol overhead for any cross-agent communication
- Coordination bugs (session sync issues - Pitfall #40)
- Duplicated code for shared utilities

**Why rejected:** The security benefits are achievable with programmatic guards. The operational complexity isn't worth it when `requireContext()` provides equivalent isolation.

### Option 2: Status Quo (Single Agent, No Guards)

**Description:** Continue with single agent, trust prompt to prevent misuse

**Pros:**

- No implementation cost
- Already deployed

**Cons:**

- Prompt injection could bypass security
- No programmatic enforcement
- Violates Pitfall #60: "Dual-context prompt-only security"
- Audit/compliance concerns

**Why rejected:** Prompt-only security is insufficient for production systems. Programmatic enforcement is required.

### Option 3: Single Agent with Dynamic Tool Registration

**Description:** Register only context-appropriate tools per session

**Pros:**

- Tools not visible to LLM = can't be called
- Clean tool list per context
- Slightly smaller context window

**Cons:**

- Still need runtime guards (defense in depth)
- Adds complexity to session initialization
- Harder to debug (tool availability varies)
- Doesn't eliminate need for ownership verification

**Why rejected:** Dynamic registration is complementary but not sufficient. We implemented both: dynamic tool filtering (ADK `tools` array based on context) AND runtime guards (belt and suspenders).

## Consequences

### Positive Consequences

- **Operational Simplicity:** Single deployment, single log stream, single monitoring dashboard
- **Shared Context:** Tenant can see customer questions in same session (if needed)
- **Lower Latency:** No A2A protocol overhead for context switches
- **Cost Efficiency:** One Cloud Run instance instead of two
- **Security Proven:** Phase 1 deployment verified all guards working
- **Defense in Depth:** 3 layers (context, trust tier, ownership)

### Negative Consequences

- **Coupled Evolution:** Changes affecting both contexts require careful testing
- **Larger Codebase:** Single file contains all tools (~1600 lines)
- **Prompt Complexity:** System prompt must handle both contexts

### Neutral Consequences

- **Testing:** Must test both contexts in same agent (could be pro or con)
- **Code Organization:** All tools in one file (easier to see whole picture, but long)

## Implementation

**How will this decision be implemented?**

### Phase 1 (Complete) - Security Hardening

1. ✅ Add `requireContext()` guard to all 11 tools
2. ✅ Implement 4-tier tenant ID extraction
3. ✅ Add T3 confirmation for CANCELLATION/REFUND
4. ✅ Add ownership verification to all tools
5. ✅ Deploy to Cloud Run (revision: project-hub-agent-00003-2tj)

### Phase 2 (In Progress) - Documentation & Enhancement

1. ✅ Document architecture (PROJECT_HUB_ARCHITECTURE.md)
2. ✅ Create this ADR
3. 🔄 Add context visibility UI indicator
4. 🔄 Performance baseline metrics
5. 🔄 Per-session rate limiting

### Phase 3 (Planned) - Monitoring & Testing

1. Cloud Monitoring alerts for context violations
2. E2E testing in staging environment
3. Error budget and SLO definition

**Success Criteria:**

- Zero context violations in production
- Zero T3 bypasses in production
- p95 tool latency < 3s
- Clear audit trail for all high-risk operations

## Risks and Mitigation

| Risk                         | Impact | Likelihood | Mitigation Strategy                                          |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------ |
| Context guard bypass         | High   | Low        | 3 security layers; guards are FIRST LINE of tools            |
| Prompt injection via context | High   | Low        | Context from session state, not user input                   |
| Tool name collision          | Medium | Low        | Distinct naming (get_project_status vs get_pending_requests) |
| Tenant sees customer data    | High   | Low        | Backend ownership verification on all operations             |
| Performance degradation      | Medium | Medium     | 15s timeout, monitoring, rate limiting                       |

## Compliance and Standards

**Does this decision affect:**

- [x] Security requirements - **Addressed with 3-layer defense**
- [ ] Privacy/compliance (GDPR, etc.) - No change
- [x] Performance SLAs - **15s timeout, monitoring planned**
- [x] Architectural principles - **Follows MAIS multi-tenant patterns**
- [x] Documentation standards - **ADR + architecture doc created**
- [x] Testing requirements - **Phase 3 includes E2E testing**

## References

- [PROJECT_HUB_ARCHITECTURE.md](../architecture/PROJECT_HUB_ARCHITECTURE.md) - Detailed architecture documentation
- [ADR-018: Hub-and-Spoke Agent Architecture](ADR-018-hub-and-spoke-agent-architecture.md) - Related agent pattern
- [Phase 1 Deployment Report](../deployment/PROJECT_HUB_PHASE_1_DEPLOYMENT_REPORT.md) - Security verification
- [DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md](../solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md) - Prevention patterns
- [Pitfall #60](../../CLAUDE.md) - Dual-context prompt-only security

---

## Follow-up

**Open questions:**

- Should we add per-session rate limiting beyond per-tenant? (Phase 2 task)
- What SLOs are appropriate for Project Hub? (Phase 3 discussion)

**Next actions:**

- [x] Deploy Phase 1 security hardening
- [x] Create architecture documentation
- [x] Create this ADR
- [ ] Implement context visibility UI
- [ ] Set up Cloud Monitoring alerts
- [ ] Run E2E tests in staging

---

## Notes

This decision was made after Phase 1 security hardening was deployed and verified working in production. The 4 P1 security issues (tool context enforcement, 4-tier tenant ID, T3 confirmation, ownership verification) were all implemented as part of the "single agent" approach, proving that programmatic enforcement is sufficient.

The decision to keep a single agent was informed by:

1. Successful Phase 1 deployment with all security features
2. Operational simplicity benefits
3. No security gaps identified in production
4. Ability to share context between customer/tenant views

---

## Version History

| Date       | Author          | Changes         |
| ---------- | --------------- | --------------- |
| 2026-01-24 | Claude Opus 4.5 | Initial version |
