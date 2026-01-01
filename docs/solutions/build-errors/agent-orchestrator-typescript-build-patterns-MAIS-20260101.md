---
title: Agent Orchestrator TypeScript Build Patterns
date: 2026-01-01
category: build-errors
tags:
  - agent
  - orchestrator
  - typescript
  - prisma
  - sessiontype
  - trusttier
severity: P1
root_cause: Type mismatches between orchestrator interfaces and Prisma schema
related_files:
  - server/src/agent/orchestrator/unified-orchestrator.ts
  - server/src/agent/orchestrator/session-manager.ts
  - server/src/agent/tools/admin-tools.ts
  - server/src/agent/tools/onboarding-tools.ts
  - server/src/agent/tools/customer-tools.ts
symptoms:
  - 'TS2322: Type ''"BUSINESS"'' is not assignable to type ''SessionType'''
  - "Property 'context' does not exist on type 'SessionState'"
  - "Property 'trustTier' is missing in type AgentTool"
  - "Type 'ChatMessage[]' is not assignable to type 'InputJsonValue'"
trigger_commits:
  - 'Phase 4.6-4.7: Agent ecosystem implementation with unified orchestrator'
solution_commits:
  - '1c5800b: fix(web): resolve ESLint/React build errors for Vercel'
  - 'd87c65a: fix(agent): cast ChatMessage[] through unknown for Prisma InputJsonValue'
  - '3abd964: fix(agent): resolve TypeScript build errors for Render deploy'
---

# Agent Orchestrator TypeScript Build Patterns

## Problem Description

During Phase 4.6-4.7 of the Agent Ecosystem implementation, multiple TypeScript build errors occurred on Render and Vercel deployments. These errors stemmed from type mismatches between the new unified orchestrator system and the underlying Prisma schema, as well as React hook ordering issues.

### Error Summary by Platform

| Platform | Issue                                 | Fix                                    |
| -------- | ------------------------------------- | -------------------------------------- |
| Render   | SessionType 'BUSINESS' not assignable | Changed to 'ADMIN' (Prisma enum)       |
| Render   | trustTier missing on 23 AgentTools    | Added T1/T2/T3 to all tools            |
| Render   | session.context undefined             | Use getAdminSession() not getSession() |
| Render   | response.proposal singular            | Changed to response.proposals (array)  |
| Render   | ChatMessage[] to InputJsonValue       | Double assertion via unknown           |
| Vercel   | React hooks called conditionally      | Moved useCallback before early return  |
| Vercel   | styled-jsx jsx attribute              | Added eslint-disable comment           |
| Vercel   | Unused test variables                 | Removed/prefixed with \_               |

## Root Cause Analysis

### Issue 1: SessionType Enum Mismatch

The Prisma schema defines only two session types:

```prisma
enum SessionType {
  ADMIN
  CUSTOMER
}
```

Code incorrectly used 'BUSINESS' which doesn't exist in the enum:

```typescript
// BROKEN - 'BUSINESS' is not a valid SessionType
sessionType: 'BUSINESS' as const,

// FIXED - Use 'ADMIN' for business/admin sessions
sessionType: 'ADMIN' as const,
```

**Key Insight**: The old "business advisor" sessions are actually admin sessions. The naming convention in the orchestrator layer doesn't match Prisma's enum—always use what Prisma defines.

### Issue 2: Missing trustTier on AgentTool

The `AgentTool` type requires a `trustTier` field to indicate the tool's trust level:

```typescript
// AgentTool type definition requires:
trustTier: 'T1' | 'T2' | 'T3';

// T1 = Auto-execute (read-only, metadata)
// T2 = Soft-confirm (creates resources, reversible)
// T3 = User-confirm (bookings, payments, irreversible)
```

All 23+ tools across admin, onboarding, and customer modules needed this field:

```typescript
// BROKEN - missing trustTier
{
  name: 'get_services',
  description: 'Get available services',
  parameters: { ... }
}

// FIXED - explicit trustTier
{
  name: 'get_services',
  description: 'Get available services',
  parameters: { ... },
  trustTier: 'T1' // Read-only, auto-execute
}
```

### Issue 3: SessionState vs AdminSessionState Hierarchy

The session state has two levels:

```typescript
// Base session state (all sessions)
interface SessionState {
  id: string;
  tenantId: string;
  phase: string;
  messages: ChatMessage[];
}

// Extended for admin sessions (includes context)
interface AdminSessionState extends SessionState {
  context: {
    businessName: string;
    quickStats: QuickStats;
    // ... other business context
  };
}
```

Using `getSession()` returns `SessionState`, which doesn't have `context`:

```typescript
// BROKEN - context doesn't exist on SessionState
const session = await sessionManager.getSession(sessionId);
const name = session.context.businessName; // Error!

// FIXED - use getAdminSession() for admin contexts
const session = await sessionManager.getAdminSession(sessionId);
const name = session.context.businessName; // Works!
```

### Issue 4: Prisma JSON Casting

Custom array types like `ChatMessage[]` cannot be directly assigned to Prisma's `InputJsonValue`:

```typescript
// BROKEN - direct assignment fails
await prisma.session.update({
  data: { messages: session.messages }, // Type error
});

// FIXED - double assertion via unknown
await prisma.session.update({
  data: {
    messages: session.messages as unknown as Prisma.InputJsonValue,
  },
});
```

**Why double assertion?** TypeScript's type system sees `ChatMessage[]` and `InputJsonValue` as incompatible types. Casting through `unknown` tells TypeScript "trust me, I know this is valid JSON."

### Issue 5: React Hook Ordering (Vercel)

React hooks must be called in the same order on every render:

```typescript
// BROKEN - useCallback after conditional return
function Component({ data }) {
  if (!data) return null; // Early return

  const handler = useCallback(() => {}, []); // Error: hook after return
  return <button onClick={handler}>Click</button>;
}

// FIXED - hooks before any returns
function Component({ data }) {
  const handler = useCallback(() => {}, []); // Hook first

  if (!data) return null; // Early return after hooks
  return <button onClick={handler}>Click</button>;
}
```

## Prevention Checklist

### When Adding New Agent Tools

- [ ] **trustTier Required**: Every tool must have `trustTier: 'T1' | 'T2' | 'T3'`
- [ ] **Trust Level Guide**:
  - T1: Read-only operations, metadata updates
  - T2: Creates/modifies resources, but reversible
  - T3: Bookings, payments, or irreversible actions

### When Working with Sessions

- [ ] **SessionType Values**: Only use `'ADMIN'` or `'CUSTOMER'` (never 'BUSINESS')
- [ ] **Context Access**: Use `getAdminSession()` when you need `context.businessName`, `quickStats`, etc.
- [ ] **Type Safety**: Check return type—`getSession()` returns base `SessionState`

### When Storing Chat Messages in Prisma

- [ ] **Double Assertion**: Cast `ChatMessage[]` through `unknown`:
  ```typescript
  messages as unknown as Prisma.InputJsonValue;
  ```
- [ ] **Why**: Prisma's JSON types don't align with custom array types

### When Writing React Components

- [ ] **Hook Order**: All `useState`, `useCallback`, `useMemo`, `useEffect` calls must be BEFORE any `return` statements
- [ ] **Conditional Logic**: Move conditionals that return early to AFTER all hooks

## Quick Verification Commands

```bash
# Check for invalid SessionType values
grep -rn "SessionType.*BUSINESS" server/src/

# Find tools missing trustTier
grep -A5 "name:.*get_\|name:.*update_\|name:.*create_" server/src/agent/tools/*.ts | grep -B5 "parameters:" | grep -L "trustTier"

# Check for Prisma JSON casting issues
grep -rn "messages:.*session\." server/src/agent/

# Find React hooks after returns (approximate)
grep -B10 "useCallback\|useState\|useMemo" apps/web/src/**/*.tsx | grep "return null\|return (\|return <"

# TypeScript build check (catches what IDE misses)
npm run typecheck
```

## Code Examples

### Correct Tool Definition

```typescript
export const getServicesToolAdmin: AgentTool = {
  name: 'get_services',
  description: 'Retrieve all active services for the tenant',
  parameters: z.object({
    segmentSlug: z.string().optional(),
  }),
  trustTier: 'T1', // Read-only, auto-execute
};
```

### Correct Session Access Pattern

```typescript
// For admin/business sessions that need context
async function handleAdminChat(sessionId: string) {
  const session = await sessionManager.getAdminSession(sessionId);

  const systemPrompt = buildPrompt({
    businessName: session.context.businessName,
    quickStats: session.context.quickStats,
  });

  // Save updated messages
  await sessionManager.updateSession(sessionId, {
    messages: session.messages as unknown as Prisma.InputJsonValue,
  });
}
```

### Correct React Hook Pattern

```tsx
function AgentChatPanel({ tenantId }: Props) {
  // 1. All hooks first
  const [messages, setMessages] = useState<Message[]>([]);
  const handleSend = useCallback(
    (text: string) => {
      // ... send logic
    },
    [tenantId]
  );

  // 2. Early returns after hooks
  if (!tenantId) {
    return <div>No tenant selected</div>;
  }

  // 3. Main render
  return <ChatInterface messages={messages} onSend={handleSend} />;
}
```

## Related Documentation

- [Chatbot Proposal Execution Flow](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
- [Circular Dependency Executor Registry](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)
- [Phase 5 Testing and Caching Prevention](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [TypeScript Unused Variables Build Failure](typescript-unused-variables-build-failure-MAIS-20251227.md)

## Files Modified

| File                                                    | Changes                         |
| ------------------------------------------------------- | ------------------------------- |
| `server/src/agent/orchestrator/unified-orchestrator.ts` | SessionType fix, Prisma casting |
| `server/src/agent/orchestrator/session-manager.ts`      | getAdminSession method          |
| `server/src/agent/tools/admin-tools.ts`                 | Added trustTier to all tools    |
| `server/src/agent/tools/onboarding-tools.ts`            | Added trustTier to all tools    |
| `server/src/agent/tools/customer-tools.ts`              | Added trustTier to all tools    |
| `apps/web/src/components/chat/*.tsx`                    | React hook ordering             |

## Key Takeaways

1. **Prisma is source of truth** for enum values—don't invent new ones
2. **trustTier is mandatory** on every AgentTool—it drives execution behavior
3. **Know your session type** hierarchy—use the right getter method
4. **Double assertion** (`as unknown as Type`) is the pattern for Prisma JSON
5. **React hooks before returns**—always, no exceptions
