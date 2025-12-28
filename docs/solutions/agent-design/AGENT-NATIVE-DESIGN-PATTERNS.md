---
title: 'Agent-Native Design Patterns for Business Advisor Systems'
category: 'best-practices'
severity: 'n/a'
problem_type: 'design-pattern'
date_created: '2025-12-26'
status: 'approved'

symptoms: |
  Building an AI agent system for a multi-tenant platform requires careful decisions about:
  - How to map user capabilities to agent tools
  - How to maintain multi-tenant data isolation
  - How to design system prompts that guide effectively
  - How to implement approval workflows for AI-generated changes
  - How to balance UX with security controls

root_cause: |
  Traditional agent implementations often fail because they:
  1. Use system prompts as security controls (prompt injection bypasses them)
  2. Encode business logic in workflow tools instead of primitives
  3. Require confirmation for every action (fatigue)
  4. Don't enforce tenant isolation at tool level
  5. Over-engineer with complex context refresh strategies

solution_summary: |
  Agent-native architecture with primitive tools, trust tiers, server-side approval,
  single context injection, and features as prompts. Simplified from 43→18 tools,
  310→100 line prompt through multi-agent review.

prevention: |
  - Use server-side approval mechanism (not just prompt instructions)
  - Implement trust tiers (T1: auto, T2: soft confirm, T3: hard confirm)
  - Single context injection at session start (tools are the refresh)
  - Keep tools as primitives, features as prompts
  - Enforce tenant isolation at tool level, not route level

related_files:
  - plans/AGENT-CAPABILITY-MAP.md
  - plans/AGENT-SYSTEM-PROMPT-DRAFT.md
  - docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
  - docs/solutions/PREVENTION-STRATEGIES-INDEX.md

tags:
  - agent-design
  - agent-native-architecture
  - capability-mapping
  - system-prompt-design
  - multi-tenant-isolation
  - trust-tiers
  - approval-workflow
---

# Agent-Native Design Patterns for Business Advisor Systems

> Lessons learned from designing the MAIS Business Growth Agent, validated through 6-agent parallel review.

## Quick Reference

| Metric              | Before Review | After Review | Reduction |
| ------------------- | ------------- | ------------ | --------- |
| Tools               | 43            | 18           | 58%       |
| System Prompt Lines | 310           | ~100         | 68%       |
| Context Layers      | 3             | 1            | 67%       |
| Feature Areas       | 5             | 3 (core)     | 40%       |

---

## The 5-Step Design Process

### Step 1: Map User Capabilities to Tools

Create an exhaustive inventory of what users can DO in the UI, then map to agent tools.

```markdown
| User Action    | UI Location   | Proposed Tool     | Notes                  |
| -------------- | ------------- | ----------------- | ---------------------- |
| Create package | /packages/new | `upsert_package`  | Combined create/update |
| View bookings  | /bookings     | `get_bookings`    | With filters           |
| Block a date   | /calendar     | `manage_blackout` | Combined create/delete |
```

**Key insight:** Combine CRUD operations where possible (`upsert_package` vs separate create/update).

### Step 2: Define System Prompt

Focus on identity, core rules, and one good example. Features emerge from the prompt, not code.

```markdown
## Identity

You are the MAIS Business Growth Assistant...

## Core Rules

### ALWAYS

- Propose before changing
- Be specific ("$3,500" not "competitive pricing")

### NEVER

- Execute T3 operations without explicit confirmation
- Retry failed operations without asking
```

**Key insight:** ~100 lines is enough. Remove verbose feature sections - the agent figures it out.

### Step 3: Design Context Injection

**Single static injection at session start.** Tools are the refresh mechanism.

```markdown
## Your Business Context

You are helping **{tenant.name}** ({tenant.slug}).

- Stripe: {connected ? 'Ready' : 'Not yet connected'}
- Packages: {count} configured
- Upcoming bookings: {count}

For current details, use your read tools.
```

**Key insight:** Don't build 3-layer refresh systems. The agent calls tools when it needs current data.

### Step 4: Implement Trust Tiers

Not all operations need confirmation. This prevents fatigue while maintaining security.

| Tier         | Behavior                         | Operations                      |
| ------------ | -------------------------------- | ------------------------------- |
| **T1: Auto** | Execute immediately              | Blackouts, branding, visibility |
| **T2: Soft** | "I'll do X. Say 'wait' if wrong" | Package changes, pricing        |
| **T3: Hard** | Must get explicit "yes"          | Cancellations, refunds, deletes |

**Key insight:** ~70% of operations can be T1/T2, reducing friction dramatically.

### Step 5: Implement Server-Side Approval

**CRITICAL:** System prompt instructions are NOT security controls. Use server-side enforcement.

```typescript
// Write tools return proposals, not executed results
interface ToolProposal {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: 'T1' | 'T2' | 'T3';
  requiresApproval: boolean;
  expiresAt: Date; // 30 minutes
}

// Agent calls confirm_proposal() to execute
// Server enforces the approval, not the prompt
```

---

## Core Patterns

### Pattern A: Tools as Primitives

```typescript
// ❌ WRONG - Encodes workflow
tool('setup_photography_business', { style, packages, pricing });

// ✅ RIGHT - Primitive the agent composes
tool('upsert_package', { name, price, description });
```

The agent decides WHAT to create based on conversation. Tools just provide capability.

### Pattern B: Features as Prompts

```markdown
// ❌ WRONG - Feature in code
function createWeddingPackages(tier: 'budget' | 'standard' | 'premium') {
// hardcoded package structures
}

// ✅ RIGHT - Feature in prompt

## Package Recommendations

When creating packages:

- 3 tiers typically work best (entry / standard / premium)
- Price based on value delivered, not just time
- Name packages descriptively (not "Basic/Pro/Enterprise")
```

Change behavior by editing prose, not refactoring code.

### Pattern C: Action Parity

Whatever users can do in the UI, the agent can do via tools.

```markdown
| UI Screen | User Action | Agent Tool      | Parity |
| --------- | ----------- | --------------- | ------ |
| Dashboard | View stats  | get_dashboard   | ✅     |
| Packages  | Create/Edit | upsert_package  | ✅     |
| Calendar  | Block dates | manage_blackout | ✅     |
| Booking   | Cancel      | cancel_booking  | ✅     |
```

No artificial limitations. The agent has full capability but is INSTRUCTED to propose first.

### Pattern D: Tenant Isolation

Every tool receives `tenantId` from authenticated session, NEVER from user input.

```typescript
async function get_packages(context: AuthenticatedContext) {
  const { tenantId } = context; // From JWT, not user input
  return prisma.package.findMany({
    where: { tenantId }, // ALWAYS filter
  });
}
```

### Pattern E: Data Sanitization

User-controlled data must be sanitized before context injection.

```typescript
const INJECTION_PATTERNS = [/ignore.*instructions/i, /you are now/i, /system:/i];

function sanitizeForContext(text: string): string {
  let result = text;
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result.slice(0, 100); // Length limit
}
```

---

## Anti-Patterns to Avoid

### 1. Prompt-Only Approval

```markdown
❌ "Never make changes without user approval" (in prompt)
✅ Server-side proposal mechanism that enforces approval
```

Prompts can be bypassed via injection. Server enforcement cannot.

### 2. Confirmation Fatigue

```markdown
❌ Every write operation requires explicit "yes"
✅ Trust tiers: T1 auto, T2 soft, T3 hard
```

Users abandon agents that ask too many questions.

### 3. Over-Engineered Context

```markdown
❌ 3-layer context with 5-minute refresh intervals
✅ Single static injection + tools for current data
```

Tools ARE the refresh mechanism. Don't duplicate it.

### 4. Tool Explosion

```markdown
❌ 43 separate tools (create_X, update_X, delete_X for every entity)
✅ 18 combined tools (upsert_X, manage_X)
```

Combine CRUD where possible. Defer power-user features.

### 5. Workflow Tools

```markdown
❌ tool("onboard_new_client", { ... }) - encodes YOUR workflow
✅ tool("upsert_package") + prompt that describes onboarding flow
```

Let the agent figure out HOW. Tools provide primitive capability.

---

## Multi-Agent Review Process

Our design was validated by 6 specialized reviewers running in parallel:

| Reviewer           | Focus                 | Key Finding                   |
| ------------------ | --------------------- | ----------------------------- |
| **Architecture**   | Layering, scalability | Single context layer simpler  |
| **Security**       | Injection, isolation  | Server-side approval required |
| **UX**             | Friction, clarity     | Trust tiers reduce fatigue    |
| **Agent-Native**   | Primitives, parity    | Tools correctly primitive     |
| **Implementation** | API coverage, effort  | 84% endpoints exist           |
| **Simplicity**     | Over-engineering      | 58% tool reduction possible   |

### When to Run Multi-Agent Review

- Before implementing any agent system
- After major design changes
- When adding new tool categories
- For security-sensitive features

---

## Deferred Features (YAGNI)

These exist in backend but are deferred for MVP:

| Feature               | Why Deferred      | When to Add  |
| --------------------- | ----------------- | ------------ |
| Custom domains        | <5% MVP users     | User request |
| Services (time-slots) | Packages first    | Phase 2      |
| Add-ons               | Nice-to-have      | Phase 2      |
| Availability rules    | Blackouts simpler | Phase 2      |
| Reschedule booking    | Rare, UI works    | Phase 2      |

**Key insight:** Ship less. Learn what users need. Add complexity later.

---

## Implementation Checklist

### Pre-Implementation

- [ ] Capability map complete (user action → tool)
- [ ] System prompt < 150 lines
- [ ] Trust tiers defined for all write operations
- [ ] Security review passed
- [ ] Tenant isolation documented

### Implementation

- [ ] Server-side proposal mechanism built
- [ ] All tools receive tenantId from JWT
- [ ] Data sanitization for context injection
- [ ] Audit logging for all tool calls
- [ ] Error handling patterns in prompt

### Post-Implementation

- [ ] Multi-agent review (≥5/6 approvals)
- [ ] Token usage tracking
- [ ] Success metrics defined
- [ ] Runbook for common issues

---

## Success Metrics

| Metric                | Target                 | How to Measure              |
| --------------------- | ---------------------- | --------------------------- |
| Time to first package | <10 min                | Signup → creation           |
| Completion rate       | >70%                   | Users who create ≥1 package |
| Confirmation fatigue  | <2 T3 confirms/session | Count hard confirms         |
| Error rate            | <5%                    | Tool call failures          |
| Security incidents    | 0                      | Audit log anomalies         |

---

## Related Documentation

### Architecture

- [ADR-006: Modular Monolith](../adrs/ADR-006-modular-monolith-architecture.md)
- [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

### Security

- [Prevention Strategies Index](../solutions/PREVENTION-STRATEGIES-INDEX.md)
- [Security Assessment Index](../security/SECURITY-ASSESSMENT-INDEX.md)

### Agent Design

- [Capability Map v2.0](../../plans/AGENT-CAPABILITY-MAP.md)
- [System Prompt v2.0](../../plans/AGENT-SYSTEM-PROMPT-DRAFT.md)

### Review Methodology

- [Multi-Agent Code Review Process](methodology/multi-agent-code-review-process.md)

---

## Version History

| Version | Date       | Changes                                     |
| ------- | ---------- | ------------------------------------------- |
| 2.0     | 2025-12-26 | Simplified after 6-agent review             |
| 1.0     | 2025-12-26 | Initial design (43 tools, 3 context layers) |
