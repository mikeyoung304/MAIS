---
problem_type: security-issues
component: agent-tools
severity: P0
tags: [trust-tier, type-safety, security, compile-time-safety]
root_cause: Optional security-critical field allowed silent unsafe defaults
solution: Make security fields required at type level
created: 2026-01-01
project: MAIS
related_issues: ["#523", "#541"]
---

# Required Security Fields on Agent Tools

## Problem Statement

The `trustTier` field on `AgentTool` interface was optional. When developers forgot to specify it, tools silently defaulted to T1 (auto-confirm), bypassing the approval mechanism for potentially dangerous write operations.

**Symptom:** New tools could execute writes without user confirmation.

**Root Cause:** Optional typing on security-critical configuration.

```typescript
// BEFORE: Optional = silent T1 default
export interface AgentTool {
  name: string;
  description: string;
  trustTier?: 'T1' | 'T2' | 'T3';  // Optional - dangerous!
  inputSchema: { ... };
  execute: (...) => Promise<AgentToolResult>;
}

// Tool definition without trustTier compiles fine
const dangerousTool: AgentTool = {
  name: 'delete_all_data',
  description: 'Deletes everything',
  // trustTier: ??? - forgot it, defaults to T1!
  inputSchema: { ... },
  execute: async () => { /* boom */ }
};
```

## Working Solution

### Make Security Fields Required

```typescript
// AFTER: Required = compile-time enforcement
export interface AgentTool {
  name: string;
  description: string;
  trustTier: 'T1' | 'T2' | 'T3';  // REQUIRED - TypeScript enforces
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    context: ToolContext,
    input: Record<string, unknown>
  ) => Promise<AgentToolResult>;
}

// Now this fails at compile time!
const dangerousTool: AgentTool = {
  name: 'delete_all_data',
  description: 'Deletes everything',
  // ERROR: Property 'trustTier' is missing
  inputSchema: { type: 'object', properties: {} },
  execute: async () => { /* ... */ }
};
```

### Trust Tier Guidelines

| Tier | Use Case | Behavior | Examples |
|------|----------|----------|----------|
| T1 | Read-only, metadata | Auto-confirm | `get_services`, `check_availability` |
| T2 | Low-risk writes | Soft-confirm (next message) | `upsert_services`, `update_storefront` |
| T3 | High-risk writes | Hard-confirm (explicit) | `book_service`, `process_payment` |

## Prevention Checklist

When defining interfaces with security implications:

- [ ] Are there fields that control access/permissions? → Make required
- [ ] Are there fields that affect data safety? → Make required
- [ ] What's the "safe" default if field is missing? → If no safe default, make required
- [ ] Can TypeScript enforce the constraint? → Prefer compile-time over runtime

## Red Flags in Code Review

```typescript
// RED FLAG: Optional permission field
interface Action {
  permission?: 'read' | 'write' | 'admin';  // What if missing?
}

// RED FLAG: Optional trust/role field
interface Request {
  role?: 'user' | 'admin';  // Defaults to...?
}

// RED FLAG: Optional validation flag
interface Input {
  validated?: boolean;  // Assumes validated if missing?
}
```

## Better Pattern: Required with Explicit Declaration

```typescript
// GOOD: Force explicit declaration
interface Action {
  permission: 'read' | 'write' | 'admin';  // Must specify
}

// GOOD: Default at definition site, not consumption
const DEFAULT_PERMISSION = 'read' as const;
function createAction(opts: { permission?: 'read' | 'write' }): Action {
  return {
    permission: opts.permission ?? DEFAULT_PERMISSION  // Explicit default
  };
}
```

## Runtime Validation (Defense in Depth)

Even with required types, add runtime validation:

```typescript
// In tool execution
const toolTier = tool.trustTier;
if (!toolTier) {
  // Should never happen with proper types, but defense-in-depth
  logger.error({ toolName: tool.name }, 'Tool missing trustTier');
  throw new Error('Tool configuration error: missing trustTier');
}

// Or use Zod for runtime validation
const AgentToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  trustTier: z.enum(['T1', 'T2', 'T3']),  // Required at runtime too
  // ...
});
```

## Test Cases

```typescript
describe('AgentTool trustTier requirement', () => {
  it('should reject tool without trustTier at compile time', () => {
    // This test documents expected behavior
    // The actual enforcement is at compile time via TypeScript

    const tools = getRegisteredTools();
    for (const tool of tools) {
      expect(tool.trustTier).toBeDefined();
      expect(['T1', 'T2', 'T3']).toContain(tool.trustTier);
    }
  });

  it('should have appropriate tier for write operations', () => {
    const writeTools = ['book_service', 'upsert_services', 'update_storefront'];
    const tools = getRegisteredTools();

    for (const toolName of writeTools) {
      const tool = tools.find(t => t.name === toolName);
      expect(tool?.trustTier).not.toBe('T1'); // Writes should require approval
    }
  });
});
```

## File References

- `server/src/agent/tools/types.ts:61-75` - AgentTool interface with required trustTier
- `server/src/agent/customer/customer-tools.ts` - Customer tools with explicit tiers
- `server/src/agent/tools/read-tools.ts` - Read tools all marked T1

## Cross-References

- [Agent Ecosystem Quick Reference](/docs/solutions/AGENT_ECOSYSTEM_QUICK_REFERENCE.md) - Item #5
- [Chatbot Proposal Execution Flow](/docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
