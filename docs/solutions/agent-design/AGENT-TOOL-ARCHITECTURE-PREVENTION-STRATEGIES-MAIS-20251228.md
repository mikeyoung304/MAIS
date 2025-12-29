---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: agent/tools
issues_prevented: [451, 452, 453, 454, 455, 456, 457]
severity: [P1, P2, P2, P2, P2, P2, P3]
tags: [agent-tools, performance, type-safety, dry, security, database]
---

# Agent Tool Architecture Prevention Strategies

Comprehensive guidance to prevent 7 critical agent architecture issues discovered during code review (Issues 451-457).

## Overview

During the agent tools code review (2025-12-28), seven issues were identified:

| Issue | Title                     | Severity | Impact                                         |
| ----- | ------------------------- | -------- | ---------------------------------------------- |
| 451   | Unbounded Queries         | P1       | Performance degradation, token bloat, timeouts |
| 452   | Duplicate Tools           | P2       | LLM confusion, maintenance burden              |
| 453   | Type Safety Bypasses      | P2       | Runtime errors, hard to debug                  |
| 454   | Soft-Confirm Timing       | P2       | Unintended approvals, security issue           |
| 455   | Duplicated Error Handling | P2       | DRY violation, maintenance burden              |
| 456   | Missing Database Index    | P2       | Query performance degradation                  |
| 457   | Sequential Queries        | P3       | Unnecessary latency                            |

## 1. Unbounded Query Prevention

### Problem

Agent tools fetch data without pagination limits, causing:

- Memory exhaustion with large datasets (520+ blackout dates)
- Token bloat when returned to LLM context
- Slow response times and potential timeouts
- Unpredictable behavior as tenant data grows

### Root Cause

Read tools (`get_packages`, `get_addons`, `get_segments`, `get_blackouts`, `get_blackout_dates`) lack `take` limits while properly bounded tools like `get_bookings` use `take: Math.min(limit, 50)`.

### Prevention Checklist

When adding read tools to agent:

- [ ] **All read tools have `take` limit**

  ```typescript
  // ✅ CORRECT
  const items = await prisma.item.findMany({
    where: { tenantId },
    take: Math.min(limit || 50, 100), // Cap at reasonable max
  });

  // ❌ WRONG - Unbounded
  const items = await prisma.item.findMany({
    where: { tenantId },
  });
  ```

- [ ] **Limits are documented in tool description**

  ```typescript
  const getTool = {
    name: 'get_items',
    description: 'Fetch items for tenant (max 50 returned)',
    // ...
  };
  ```

- [ ] **Different tool types have appropriate limits**
  - List tools: `take: 50`
  - Detail/search tools: `take: 100`
  - Status/summary tools: `take: 25`

- [ ] **Tool response includes pagination metadata**

  ```typescript
  return {
    success: true,
    items,
    total: items.length,
    hasMore: items.length === take, // Indicates more available
    helpText: 'Showing first 50 items...',
  };
  ```

- [ ] **Tools tested with large datasets**

  ```typescript
  test('get_items handles large datasets efficiently', async () => {
    // Create 1000+ items
    const response = await tool.execute({ tenantId });

    // Verify only limited results returned
    expect(response.items.length).toBeLessThanOrEqual(50);
    expect(response.hasMore).toBe(true);

    // Verify response time acceptable
    expect(responseTime).toBeLessThan(500); // < 500ms
  });
  ```

### Code Patterns

#### Pattern 1: Basic Pagination

```typescript
// For simple read tools
const items = await prisma.item.findMany({
  where: { tenantId, ...filters },
  orderBy: { createdAt: 'desc' }, // Consistent ordering
  take: Math.min(limit || 50, 100), // Client-provided or default
});

return {
  success: true,
  items: items.map(formatItem),
  total: items.length,
  hasMore: items.length === (limit || 50),
};
```

#### Pattern 2: With Date Filtering

```typescript
// When filtering by date range
const items = await prisma.item.findMany({
  where: {
    tenantId,
    createdAt: {
      gte: fromDate ? new Date(fromDate) : undefined,
      lte: toDate ? new Date(toDate) : undefined,
    },
  },
  orderBy: { createdAt: 'desc' },
  take: Math.min(limit || 50, 100),
});
```

#### Pattern 3: Count Total (Optional)

```typescript
// For tools that need total count
const [items, total] = await Promise.all([
  prisma.item.findMany({
    where: { tenantId },
    take: 50,
  }),
  prisma.item.count({ where: { tenantId } }),
]);

return {
  success: true,
  items,
  total, // Actual total count
  returned: items.length,
  hasMore: total > items.length,
};
```

### Code Review Checklist

When reviewing agent tool PRs:

- [ ] All `findMany()` calls have `take` limit
- [ ] Limits are reasonable (10-100 range)
- [ ] Documentation mentions limit
- [ ] Ordering is consistent (newest first preferred)
- [ ] Tests verify pagination works

---

## 2. Duplicate Tool Prevention

### Problem

Multiple overlapping tools create:

- LLM decision paralysis (agent doesn't know which to use)
- Inconsistent semantics (different tools, same functionality)
- Maintenance burden (fix bug in one, forget other)
- Risk of tools being called in wrong order

### Root Cause

Tools added over time without consolidation:

- `get_blackouts` (old read interface)
- `get_blackout_dates` (user-friendly alias, duplicate)
- `manage_blackout` (combined create/delete)
- `add_blackout_date` (has range support)
- `remove_blackout_date` (by ID)

This creates 5 tools for what should be 3.

### Prevention Checklist

When adding new agent tools:

- [ ] **Verify tool doesn't duplicate existing functionality**

  ```bash
  # Search for similar tools
  grep -r "get_" server/src/agent/tools/
  grep -r "manage_" server/src/agent/tools/
  grep -r "add_" server/src/agent/tools/
  ```

- [ ] **Establish clear tool naming patterns**
  - Read tools: `get_{resource}`
  - Write tools: `add_{resource}`, `update_{resource}`, `remove_{resource}`
  - Combined tools: `manage_{resource}` (avoid if possible)
  - Special: `check_{predicate}`, `refresh_{context}`

- [ ] **Group related tools with clear ownership**

  ```typescript
  // For blackout management:
  // ✅ CORRECT - 3 tools with clear purpose
  -get_blackout_dates - // read
    add_blackout_date - // write (with range support)
    remove_blackout_date - // write (by ID)
    // ❌ WRONG - 5 tools with overlap
    get_blackouts - // duplicate of get_blackout_dates
    get_blackout_dates - // same as above
    manage_blackout - // overlaps with add/remove
    add_blackout_date -
    remove_blackout_date;
  ```

- [ ] **Each tool has distinct purpose in system prompt**

  ```typescript
  // In system prompt capability hints:
  "You have access to:
   - get_blackout_dates: Retrieve all blackout dates
   - add_blackout_date: Block specific dates or date ranges
   - remove_blackout_date: Remove specific blackout by ID"
  ```

- [ ] **No overlapping parameter combinations**

  ```typescript
  // ❌ WRONG - Same function, different parameter names
  manage_blackout({ date, action: 'add' })
  add_blackout_date({ date })

  // ✅ CORRECT - Each tool has unique parameters
  add_blackout_date({ date, endDate?, reason? })  // handles ranges
  remove_blackout_date({ id })  // by ID only
  ```

### Code Patterns

#### Pattern 1: Read Tool

```typescript
const getBlackoutDatesTool = {
  name: 'get_blackout_dates',
  description: 'Retrieve all blackout dates for the business',
  inputSchema: {
    type: 'object',
    properties: {
      fromDate: { type: 'string', description: 'Optional start date (YYYY-MM-DD)' },
      toDate: { type: 'string', description: 'Optional end date (YYYY-MM-DD)' },
    },
  },
  async execute(input) {
    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        tenantId,
        date: {
          gte: input.fromDate ? new Date(input.fromDate) : undefined,
          lte: input.toDate ? new Date(input.toDate) : undefined,
        },
      },
      orderBy: { date: 'asc' },
      take: 100,
    });

    return {
      success: true,
      blackoutDates: blackouts.map((b) => ({
        id: b.id,
        date: b.date.toISOString().split('T')[0],
        reason: b.reason || 'Not specified',
      })),
      total: blackouts.length,
    };
  },
};
```

#### Pattern 2: Write Tool with Range Support

```typescript
const addBlackoutDateTool = {
  name: 'add_blackout_date',
  description: 'Block date or date range from bookings',
  inputSchema: {
    type: 'object',
    required: ['startDate'],
    properties: {
      startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      endDate: { type: 'string', description: 'Optional end date for range (YYYY-MM-DD)' },
      reason: { type: 'string', description: 'Why this date is blocked' },
    },
  },
  async execute(input) {
    const start = new Date(input.startDate);
    const end = input.endDate ? new Date(input.endDate) : start;

    // Validate range
    if (end < start) {
      return { success: false, error: 'End date must be after start date' };
    }

    // Add each date in range
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push({
        tenantId,
        date: new Date(d),
        reason: input.reason,
      });
    }

    await prisma.blackoutDate.createMany({
      data: dates,
      skipDuplicates: true,
    });

    return {
      success: true,
      message: `Blocked ${dates.length} date(s)`,
      blockCount: dates.length,
    };
  },
};
```

#### Pattern 3: Delete Tool by ID

```typescript
const removeBlackoutDateTool = {
  name: 'remove_blackout_date',
  description: 'Unblock a specific date',
  inputSchema: {
    type: 'object',
    required: ['blackoutDateId'],
    properties: {
      blackoutDateId: { type: 'string', description: 'Blackout date ID to remove' },
    },
  },
  async execute(input) {
    const deleted = await prisma.blackoutDate.delete({
      where: {
        id: input.blackoutDateId,
        tenantId, // Ownership check
      },
    });

    return {
      success: true,
      message: `Unblocked ${deleted.date.toISOString().split('T')[0]}`,
    };
  },
};
```

### Code Review Checklist

When reviewing tool consolidation PRs:

- [ ] Duplicate tools identified and marked for removal
- [ ] Keep only tools with distinct purposes
- [ ] All removed tools verified as truly redundant
- [ ] System prompt updated to remove capability hints for removed tools
- [ ] No orphaned imports after removal
- [ ] Tests updated to remove tests for removed tools
- [ ] Documentation updated

---

## 3. Type Safety Prevention

### Problem

Type casts (`as any`, `as BookingStatus`) bypass TypeScript checks, causing:

- Runtime errors when data shapes change
- Hard-to-debug failures (type error masks as logic error)
- False security with "valid TypeScript code"
- Maintenance risk when schemas evolve

### Root Cause

Type mismatches between:

- Prisma generated types and agent code
- Enum validation and raw string values
- Dynamic model access and specific types
- Filter objects and their type requirements

### Prevention Checklist

When writing agent tools:

- [ ] **No `as any` casts in critical paths**

  ```typescript
  // ❌ WRONG - Type bypass
  status: status as any;

  // ✅ CORRECT - Validated
  status: validateBookingStatus(status);
  ```

- [ ] **Validate enums at runtime**

  ```typescript
  // ✅ CORRECT - Type guard
  const isValidStatus = (s: string): s is BookingStatus =>
    Object.values(BookingStatus).includes(s as BookingStatus);

  if (!isValidStatus(status)) {
    return { success: false, error: 'Invalid status' };
  }
  ```

- [ ] **Type helper functions with all fields**

  ```typescript
  // ❌ WRONG - Takes any, loses types
  function formatAddOn(addOn: any) {
    return { name: addOn.name, price: addOn.price };
  }

  // ✅ CORRECT - Explicit types
  function formatAddOn(addOn: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    createdAt: Date;
  }) {
    return {
      id: addOn.id,
      name: addOn.name,
      price: (addOn.priceCents / 100).toFixed(2),
    };
  }
  ```

- [ ] **Dynamic model access with type safety**

  ```typescript
  // ❌ WRONG - Type lost in cast
  const result = await prisma[model as any].findMany(...);

  // ✅ CORRECT - Explicit models or safer cast
  async function getModelData<T extends keyof typeof prisma>(
    model: T,
    where: Record<string, unknown>
  ) {
    const prismaModel = prisma[model] as any;  // Explicit: any is necessary here
    return prismaModel.findMany({ where });
  }
  ```

- [ ] **Zod validation for untrusted input**

  ```typescript
  import { z } from 'zod';

  // ✅ CORRECT - Runtime validated
  const DateRangeSchema = z.object({
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
  });

  const input = DateRangeSchema.parse(userInput); // Throws if invalid
  ```

- [ ] **Type assertions only with `in` checks**

  ```typescript
  // ✅ CORRECT - Runtime check before assertion
  if ('status' in data && typeof data.status === 'string') {
    const status = data.status as BookingStatus;
  }

  // ❌ WRONG - No runtime check
  const status = data.status as BookingStatus;
  ```

### Code Patterns

#### Pattern 1: Enum Validation

```typescript
import { BookingStatus } from '@/generated/prisma';

// Create validation function at module level
const BookingStatusValues = Object.values(BookingStatus);

function isValidBookingStatus(status: unknown): status is BookingStatus {
  return typeof status === 'string' && BookingStatusValues.includes(status as BookingStatus);
}

// Use in tools
const getBookingsTool = {
  async execute(input) {
    if (input.status && !isValidBookingStatus(input.status)) {
      return {
        success: false,
        error: `Invalid status. Must be one of: ${BookingStatusValues.join(', ')}`,
      };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        ...(input.status && { status: input.status }), // Now type-safe
      },
    });
  },
};
```

#### Pattern 2: Typed Helper Functions

```typescript
// Define return type explicitly
type FormattedAddOn = {
  id: string;
  name: string;
  price: string;
  description: string;
};

// Require all necessary fields
function formatAddOn(addOn: {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}): FormattedAddOn {
  return {
    id: addOn.id,
    name: addOn.name,
    price: `$${(addOn.priceCents / 100).toFixed(2)}`,
    description: addOn.description,
  };
}

// Use with confidence - TypeScript knows what fields are needed
const formatted = addOns.map(formatAddOn);
```

#### Pattern 3: Zod Validation

```typescript
import { z } from 'zod';

// Define schema
const BookingFilterSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PAID', 'FULFILLED', 'CANCELED']).optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  limit: z.number().min(1).max(100).default(20),
});

type BookingFilter = z.infer<typeof BookingFilterSchema>;

// Use in tool
const getBookingsTool = {
  async execute(input: unknown) {
    // Validate input - throws ZodError if invalid
    const filter = BookingFilterSchema.parse(input);

    // filter.status is now type-safe
    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        ...(filter.status && { status: filter.status }),
      },
      take: filter.limit,
    });
  },
};
```

#### Pattern 4: Generics for Dynamic Models

```typescript
// For tools that work with multiple models
async function getGenericData<T extends { id: string; tenantId: string }>(
  model: 'package' | 'booking' | 'customer',
  tenantId: string,
  filter?: Record<string, unknown>
): Promise<T[]> {
  // Map model name to actual Prisma model
  const modelMap = {
    package: prisma.package,
    booking: prisma.booking,
    customer: prisma.customer,
  } as const;

  const prismaModel = modelMap[model] as any; // Explicit: necessary for dynamic access

  return prismaModel.findMany({
    where: { tenantId, ...filter },
    take: 50,
  });
}
```

### Code Review Checklist

When reviewing type safety in tools:

- [ ] No `as any` without explicit comment explaining why
- [ ] All enums validated with type guards
- [ ] Helper functions have explicit parameter types
- [ ] No unchecked `data[key]` access
- [ ] Zod used for user-provided input
- [ ] Type assertions only after `in` checks
- [ ] TypeScript strict mode passes

---

## 4. Soft-Confirm Timing Prevention

### Problem

Auto-confirm mechanism confirms proposals when user sends ANY message without rejection keywords, even if conversation has shifted topics:

```
User: "Update my package price to $500"
Agent: "I'll update the price. Confirm?" (T2 proposal created)
User: "Actually, wait. What bookings do I have this week?"
Agent: Shows bookings
User: "Great, thanks!"  ← This triggers auto-confirm of price change!
```

Results in unintended approvals and security issues.

### Root Cause

`softConfirmPendingT2` function checks only for rejection keywords ("no", "cancel", etc.), not context. A topic change followed by an affirmative reply about the new topic triggers old proposals.

### Prevention Checklist

When implementing auto-confirm features:

- [ ] **Add expiration timer to proposals**

  ```typescript
  // ✅ CORRECT - Only confirm recent proposals
  const TWO_MINUTES = 2 * 60 * 1000;
  const recentProposals = proposals.filter((p) => Date.now() - p.createdAt.getTime() < TWO_MINUTES);

  // ❌ WRONG - All pending proposals auto-confirm
  const allPending = proposals.filter((p) => p.status === 'pending');
  ```

- [ ] **Track conversation context with proposals**

  ```typescript
  interface Proposal {
    id: string;
    action: string;
    createdAt: Date;
    expiresAt: Date; // Add this
    createdInMessageId: string; // Track conversation context
    relatedMessageIds: string[]; // Messages within 2-minute window
  }
  ```

- [ ] **Require affirmative signal, not just absence of rejection**

  ```typescript
  // ✅ BETTER - Positive affirmation required
  const affirmativeKeywords = ['yes', 'confirm', 'okay', 'ok', 'sounds good', 'approve'];
  const hasAffirmative = affirmativeKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );

  if (hasAffirmative && !hasRejection) {
    confirmProposal();
  }
  ```

- [ ] **Require explicit proposal reference**

  ```typescript
  // ✅ SAFEST - Most explicit
  // User must say: "confirm the price change" or "yes, $500"
  const proposalRef = extractProposalReference(userMessage);
  if (proposalRef) {
    confirmProposalByReference(proposalRef);
  }
  ```

- [ ] **Document auto-confirm behavior in system prompt**
  ```typescript
  const systemPrompt = `
    When proposing T2 changes:
    1. State the proposal clearly
    2. Use exact phrasing: "To confirm, [action]"
    3. Wait for user response
    4. Auto-confirm only if:
       - User says "yes", "confirm", "okay"
       - Created within last 2 minutes
       - No topic change detected
    5. If user changes topic, expire proposal and require re-request
  `;
  ```

### Code Patterns

#### Pattern 1: Time-Based Expiry (Recommended)

```typescript
interface Proposal {
  id: string;
  tenantId: string;
  action: 'update_price' | 'change_capacity' | 'block_dates';
  payload: unknown;
  createdAt: Date;
  expiresAt: Date; // Add expiration
  status: 'pending' | 'confirmed' | 'expired' | 'rejected';
}

async function softConfirmPendingT2(tenantId: string, userMessage: string): Promise<void> {
  // Get pending proposals created in last 2 minutes
  const TWO_MINUTES = 2 * 60 * 1000;
  const twoMinutesAgo = new Date(Date.now() - TWO_MINUTES);

  const proposals = await prisma.proposal.findMany({
    where: {
      tenantId,
      status: 'pending',
      createdAt: { gte: twoMinutesAgo }, // Only recent
    },
  });

  // Check for rejection keywords
  const rejectionKeywords = ['no', 'cancel', "don't", 'do not', 'stop', 'reject', 'decline'];
  const hasRejection = rejectionKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );

  if (hasRejection) {
    // Reject all pending proposals
    await prisma.proposal.updateMany({
      where: { tenantId, status: 'pending' },
      data: { status: 'rejected' },
    });
    return;
  }

  // Auto-confirm only if message lacks both topic change signals
  const topicChangeKeywords = ['what about', 'how about', 'show me', 'check', 'look at'];
  const hasTopicChange = topicChangeKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );

  if (!hasTopicChange && proposals.length > 0) {
    // Confirm recent proposals
    await prisma.proposal.updateMany({
      where: {
        id: { in: proposals.map((p) => p.id) },
      },
      data: { status: 'confirmed' },
    });
  }
}
```

#### Pattern 2: Conversation Context Tracking

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relatedProposalIds: string[]; // Proposals mentioned in this message
}

async function handleUserMessage(conversationId: string, content: string): Promise<void> {
  // Detect if message references a proposal
  const proposalMentioned = extractProposalReference(content);

  // Get active proposals for this conversation
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { proposals: { where: { status: 'pending' } } },
  });

  // Only confirm if explicitly mentioned or very recent
  if (proposalMentioned) {
    const proposal = conversation.proposals.find((p) => p.id === proposalMentioned);
    if (proposal) {
      await confirmProposal(proposal.id);
    }
  } else if (conversation.proposals.length === 1) {
    const recentProposal = conversation.proposals[0];
    // Only if created within last message or two
    const messagesSinceProposal = await countMessagesSince(
      conversationId,
      recentProposal.createdAt
    );
    if (messagesSinceProposal <= 1) {
      await confirmProposal(recentProposal.id);
    }
  }
}

function extractProposalReference(message: string): string | null {
  // Look for patterns like:
  // "confirm the price change"
  // "yes, $500"
  // "approve the request"
  const patterns = [
    /confirm(?:ed?)?\s+(?:the\s+)?(\w+)/i,
    /yes[,\s]+[`$](\d+)/i,
    /approve\s+(?:the\s+)?(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

#### Pattern 3: Explicit Confirmation Required

```typescript
// Most conservative: require explicit reference and affirmation

async function confirmProposalExplicitly(
  conversationId: string,
  userMessage: string
): Promise<{ confirmed: boolean; proposalId?: string; message: string }> {
  const affirmativeKeywords = [
    'yes',
    'confirm',
    'okay',
    'ok',
    'approve',
    'go ahead',
    'sounds good',
  ];

  const hasAffirmative = affirmativeKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );

  if (!hasAffirmative) {
    return { confirmed: false, message: 'Please say "yes" to confirm' };
  }

  // Extract which proposal they're confirming
  const proposalRef = extractProposalReference(userMessage);
  if (!proposalRef) {
    return {
      confirmed: false,
      message: 'Which proposal would you like to confirm?',
    };
  }

  // Get the proposal
  const proposal = await prisma.proposal.findFirst({
    where: {
      conversationId,
      status: 'pending',
      // Match by action type (price, dates, etc.)
      action: { contains: proposalRef },
    },
  });

  if (!proposal) {
    return {
      confirmed: false,
      message: 'I could not find that proposal. Would you like to try again?',
    };
  }

  // Confirm it
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedMessage: userMessage,
    },
  });

  return {
    confirmed: true,
    proposalId: proposal.id,
    message: `Confirmed! ${proposal.action} complete.`,
  };
}
```

### Code Review Checklist

When reviewing auto-confirm features:

- [ ] Proposals have `expiresAt` field
- [ ] Expiry checked before auto-confirmation
- [ ] Topic change signals detected
- [ ] Affirmative keywords checked (not just rejection)
- [ ] Tests cover topic-change scenario
- [ ] Conversation context tracked with proposals
- [ ] System prompt documents behavior

---

## 5. Error Handling DRY Prevention

### Problem

Error handling pattern repeated ~36 times across read-tools and write-tools:

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error, tenantId }, 'Error in [tool_name] tool');
  return {
    success: false,
    error: `Failed to [action]: ${errorMessage}. [Help text]`,
    code: '[TOOL_NAME]_ERROR',
  };
}
```

Violates DRY principle and creates maintenance burden.

### Root Cause

Each tool implements error handling independently without extracting common pattern.

### Prevention Checklist

When writing agent tools:

- [ ] **Extract error handler to utility**

  ```typescript
  // ✅ CORRECT - Single source of truth
  import { handleToolError } from './utils';

  try {
    // tool logic
  } catch (error) {
    return handleToolError(error, 'get_bookings', tenantId);
  }
  ```

- [ ] **Extract formatting helpers**

  ```typescript
  // ✅ CORRECT - Reusable formatters
  import { formatPrice, formatDate, buildDateRange } from './utils';

  const prices = bookings.map((b) => formatPrice(b.totalPrice));
  const dates = bookings.map((b) => formatDate(b.date));
  ```

- [ ] **Centralize shared logic**

  ```typescript
  // Build once, use everywhere
  const dateRangeFilter = buildDateRange(input.fromDate, input.toDate);

  const results = await Promise.all([
    prisma.booking.findMany({ where: { tenantId, ...dateRangeFilter } }),
    prisma.invoice.findMany({ where: { tenantId, ...dateRangeFilter } }),
  ]);
  ```

- [ ] **Consistent error codes**

  ```typescript
  // ✅ CORRECT - Enum of error codes
  enum ToolErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
    EXECUTION_ERROR = 'EXECUTION_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
  }

  return handleToolError(error, 'get_bookings', tenantId, ToolErrorCode.DATABASE_ERROR);
  ```

### Code Patterns

#### Pattern 1: Error Handler Utility

```typescript
// server/src/agent/tools/utils.ts

enum ToolErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

interface ToolError {
  success: false;
  error: string;
  code: ToolErrorCode;
  details?: Record<string, unknown>;
}

function handleToolError(
  error: unknown,
  toolName: string,
  tenantId: string,
  code: ToolErrorCode = ToolErrorCode.EXECUTION_ERROR,
  helpText?: string
): ToolError {
  // Extract error message
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  // Log with context
  logger.error(
    {
      error,
      tenantId,
      toolName,
      code,
    },
    `Error executing ${toolName} tool`
  );

  // Build user-friendly message
  const userMessage = `Failed to execute ${toolName}: ${errorMessage}`;

  return {
    success: false,
    error: helpText ? `${userMessage}. ${helpText}` : userMessage,
    code,
  };
}

export { handleToolError, ToolErrorCode };
```

#### Pattern 2: Formatting Helpers

```typescript
// server/src/agent/tools/utils.ts

const formatPrice = (cents: number): string => {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const formatDateTime = (date: Date): string => {
  return date.toISOString(); // Full ISO 8601
};

const formatCurrency = (cents: number, currencyCode: string = 'USD'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });
  return formatter.format(cents / 100);
};

export { formatPrice, formatDate, formatDateTime, formatCurrency };
```

#### Pattern 3: Date Range Builder

```typescript
// server/src/agent/tools/utils.ts

interface DateRange {
  gte?: Date;
  lte?: Date;
}

function buildDateRange(fromDate?: string, toDate?: string): DateRange {
  const range: DateRange = {};

  if (fromDate) {
    range.gte = new Date(fromDate);
    if (isNaN(range.gte.getTime())) {
      throw new Error(`Invalid fromDate: ${fromDate}`);
    }
  }

  if (toDate) {
    range.lte = new Date(toDate);
    if (isNaN(range.lte.getTime())) {
      throw new Error(`Invalid toDate: ${toDate}`);
    }
  }

  // Validate range if both provided
  if (fromDate && toDate && range.gte && range.lte && range.lte < range.gte) {
    throw new Error('toDate must be after fromDate');
  }

  return range;
}

function buildWhereWithDateRange(
  baseWhere: Record<string, unknown>,
  dateField: string,
  fromDate?: string,
  toDate?: string
): Record<string, unknown> {
  const dateRange = buildDateRange(fromDate, toDate);

  if (Object.keys(dateRange).length === 0) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    [dateField]: dateRange,
  };
}

export { buildDateRange, buildWhereWithDateRange };
```

#### Pattern 4: Tool Result Helper

```typescript
// server/src/agent/tools/utils.ts

interface ToolSuccess<T> {
  success: true;
  data: T;
  total?: number;
  hasMore?: boolean;
}

interface ToolFailure {
  success: false;
  error: string;
  code: ToolErrorCode;
}

type ToolResult<T> = ToolSuccess<T> | ToolFailure;

function createSuccess<T>(
  data: T,
  options?: { total?: number; hasMore?: boolean }
): ToolSuccess<T> {
  return {
    success: true,
    data,
    total: options?.total,
    hasMore: options?.hasMore,
  };
}

function createFailure(error: string, code: ToolErrorCode): ToolFailure {
  return {
    success: false,
    error,
    code,
  };
}

export { createSuccess, createFailure, type ToolResult };
```

#### Pattern 5: Refactored Tool Example

```typescript
// server/src/agent/tools/read-tools.ts

import {
  handleToolError,
  ToolErrorCode,
  formatPrice,
  formatDate,
  buildWhereWithDateRange,
  createSuccess,
  createFailure,
} from './utils';

const getBookingsTool = {
  name: 'get_bookings',
  description: 'Retrieve bookings for the business',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      fromDate: { type: 'string' },
      toDate: { type: 'string' },
      limit: { type: 'number' },
    },
  },
  async execute(input, { tenantId, prisma }) {
    try {
      // Use helper for date range
      const where = buildWhereWithDateRange({ tenantId }, 'date', input.fromDate, input.toDate);

      // Fetch with limit
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { date: 'desc' },
        take: Math.min(input.limit || 20, 100),
      });

      // Use formatter helper
      const formatted = bookings.map((b) => ({
        id: b.id,
        date: formatDate(b.date),
        price: formatPrice(b.totalPrice),
        status: b.status,
      }));

      return createSuccess(formatted, {
        total: formatted.length,
        hasMore: formatted.length === (input.limit || 20),
      });
    } catch (error) {
      return handleToolError(
        error,
        'get_bookings',
        tenantId,
        ToolErrorCode.DATABASE_ERROR,
        'Unable to fetch bookings. Please try again.'
      );
    }
  },
};
```

### Code Review Checklist

When reviewing DRY compliance in tools:

- [ ] Error handling uses `handleToolError` utility
- [ ] No try/catch error messages written inline
- [ ] Date formatting uses `formatDate` or `formatDateTime`
- [ ] Price formatting uses `formatPrice`
- [ ] Date ranges built with `buildDateRange` helper
- [ ] Error codes use `ToolErrorCode` enum
- [ ] No duplicated error handling patterns
- [ ] All tests pass

---

## 6. Database Index Prevention

### Problem

Agent tools make queries without supporting indexes:

- `get_dashboard` queries: `tenantId + createdAt + status`
- `refresh_context` queries: `tenantId + createdAt + status`
- Revenue calculations: aggregate by month

But indexes are:

- `@@index([tenantId, confirmedAt])` - wrong date field
- `@@index([createdAt])` - not tenant-scoped

Results in full table scans as data grows.

### Root Cause

Indexes created for other use cases, not verified against agent tool queries.

### Prevention Checklist

When adding new agent queries:

- [ ] **Verify indexes cover query WHERE clause**

  ```typescript
  // Query uses these filters:
  where: {
    tenantId,      // Always first
    createdAt: { gte: startDate, lte: endDate },  // Date range
    status: { in: ['PAID', 'CONFIRMED'] },  // Status filter
  }

  // Need index: tenantId, createdAt, status (in that order)
  // ✅ CORRECT
  @@index([tenantId, createdAt, status])

  // ❌ WRONG - Missing createdAt
  @@index([tenantId, status])

  // ❌ WRONG - Not tenant-scoped
  @@index([createdAt])
  ```

- [ ] **Add composite indexes for multi-field queries**

  ```prisma
  // For agent dashboard revenue calculation
  model Booking {
    id String @id
    tenantId String
    date DateTime
    createdAt DateTime
    confirmedAt DateTime?
    status BookingStatus
    totalPrice Int

    // ✅ CORRECT - Covers dashboard query pattern
    @@index([tenantId, createdAt, status])
    @@index([tenantId, confirmedAt])  // For confirmation flow
  }
  ```

- [ ] **Test with EXPLAIN to verify index usage**

  ```sql
  -- Verify index is used
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT SUM(total_price)
  FROM booking
  WHERE tenant_id = 'tenant-123'
    AND created_at >= '2025-12-01'
    AND created_at < '2026-01-01'
    AND status IN ('PAID', 'CONFIRMED');

  -- Look for "Seq Scan" (bad) or "Index Scan" (good)
  ```

- [ ] **Index creation migration uses manual SQL (Pattern B)**

  ```bash
  # Create idempotent SQL migration
  # server/prisma/migrations/NN_add_booking_tenant_created_status_index.sql

  CREATE INDEX IF NOT EXISTS idx_booking_tenant_created_status
    ON booking(tenant_id, created_at, status);
  ```

- [ ] **New query benchmarks documented**
  ```typescript
  // Test: Revenue calculation with 10k bookings
  // Without index: ~2000ms
  // With index: ~50ms (40x faster)
  ```

### Code Patterns

#### Pattern 1: Query Requiring Index

```typescript
// This query needs proper indexing
async function getMonthlyRevenue(tenantId: string, year: number, month: number): Promise<number> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const result = await prisma.booking.aggregate({
    where: {
      tenantId,
      createdAt: {
        gte: monthStart,
        lt: monthEnd,
      },
      status: {
        in: ['PAID', 'CONFIRMED', 'FULFILLED'],
      },
    },
    _sum: {
      totalPrice: true,
    },
  });

  return result._sum.totalPrice ?? 0;
}

// Requires index: @@index([tenantId, createdAt, status])
```

#### Pattern 2: Checking Query Plan

```typescript
// Before implementing tool, verify index plan
async function analyzeQueryPlan(tenantId: string, fromDate: Date, toDate: Date): Promise<void> {
  // Run EXPLAIN ANALYZE on the query
  const plan = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, date, status, total_price
    FROM booking
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${fromDate}
      AND created_at < ${toDate}
      AND status IN ('PAID', 'CONFIRMED')
    ORDER BY created_at DESC
    LIMIT 50;
  `;

  console.log('Query Plan:', plan);

  // Check for "Seq Scan" - means missing index
  // Check for "Index Scan" - means index is used
}
```

#### Pattern 3: Migration with Idempotent SQL

```sql
-- server/prisma/migrations/20251228_add_booking_tenant_created_status_index.sql

-- Add composite index for agent dashboard queries
-- Covers: tenantId + createdAt + status filtering pattern
CREATE INDEX IF NOT EXISTS idx_booking_tenant_created_status
  ON "Booking"(tenant_id, created_at, status);

-- Verify index was created
SELECT indexname FROM pg_indexes
  WHERE tablename = 'Booking'
    AND indexname = 'idx_booking_tenant_created_status';
```

#### Pattern 4: Index Design Patterns

```prisma
model Booking {
  id String @id @default(cuid())
  tenantId String
  date DateTime
  createdAt DateTime @default(now())
  confirmedAt DateTime?
  status BookingStatus
  totalPrice Int

  // Tenant-specific queries (most common)
  // Pattern: agent dashboard revenue, availability checks
  @@index([tenantId, createdAt, status])

  // Confirmation workflow
  // Pattern: "bookings confirmed this week?"
  @@index([tenantId, confirmedAt])

  // Historical queries
  // Pattern: "show bookings from 2025"
  @@index([tenantId, date])

  // Combined for complex reporting
  // Pattern: "revenue by status this month"
  @@index([tenantId, status, createdAt])

  // Unique constraint acts as index
  @@unique([tenantId, date])
}
```

### Code Review Checklist

When reviewing agent tool PRs:

- [ ] New queries have supporting indexes
- [ ] Composite indexes use correct field order (tenantId first)
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] Migration file uses idempotent SQL
- [ ] Index covers all WHERE clause filters
- [ ] No full table scans in query plans
- [ ] Performance baseline documented

---

## 7. Query Parallelization Prevention

### Problem

Sequential queries in `check_availability` wait unnecessarily:

```typescript
// Query 1: Check for booking (wait)
const existingBooking = await prisma.booking.findFirst(...);

// Query 2: Check for blackout (wait for Query 1 to complete)
const blackout = await prisma.blackoutDate.findFirst(...);
```

Each query takes ~10ms, total ~20ms. Could be 10ms if parallel.

### Root Cause

Independent queries written sequentially without considering `Promise.all`.

### Prevention Checklist

When writing agent tools:

- [ ] **Identify independent queries**

  ```typescript
  // ✅ Independent - can run in parallel
  const booking = fetchBooking(date);
  const blackout = fetchBlackout(date);

  // ❌ Dependent - must run sequentially
  const tenant = await fetchTenant(tenantId);
  const bookings = await fetchBookings(tenant.id);
  ```

- [ ] **Use Promise.all for independent operations**

  ```typescript
  // ✅ CORRECT - Parallel
  const [booking, blackout] = await Promise.all([
    prisma.booking.findFirst(...),
    prisma.blackoutDate.findFirst(...),
  ]);

  // ❌ WRONG - Sequential
  const booking = await prisma.booking.findFirst(...);
  const blackout = await prisma.blackoutDate.findFirst(...);
  ```

- [ ] **Group related queries**

  ```typescript
  // ✅ CORRECT - Group by data type
  const [bookings, customers, packages] = await Promise.all([
    prisma.booking.findMany(...),
    prisma.customer.findMany(...),
    prisma.package.findMany(...),
  ]);
  ```

- [ ] **Test with many concurrent queries**

  ```typescript
  test('parallel queries are actually parallel', async () => {
    const start = Date.now();
    const [a, b, c] = await Promise.all([
      prisma.model1.findFirst(...),
      prisma.model2.findFirst(...),
      prisma.model3.findFirst(...),
    ]);
    const elapsed = Date.now() - start;

    // Should be ~10ms (one query), not ~30ms (three sequential)
    expect(elapsed).toBeLessThan(20);
  });
  ```

### Code Patterns

#### Pattern 1: Basic Parallelization

```typescript
const checkAvailabilityTool = {
  name: 'check_availability',
  description: 'Check if a date is available for booking',
  inputSchema: {
    type: 'object',
    required: ['date'],
    properties: {
      date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
    },
  },
  async execute(input, { tenantId, prisma }) {
    try {
      const checkDate = new Date(input.date);

      // ✅ CORRECT - Parallel queries
      const [existingBooking, blackout] = await Promise.all([
        // Check for existing booking
        prisma.booking.findFirst({
          where: {
            tenantId,
            date: checkDate,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
          select: { id: true, status: true },
        }),
        // Check for blackout
        prisma.blackoutDate.findFirst({
          where: { tenantId, date: checkDate },
          select: { reason: true },
        }),
      ]);

      // Analyze results
      if (existingBooking) {
        return {
          success: true,
          available: false,
          reason: `Already booked (${existingBooking.status})`,
        };
      }

      if (blackout) {
        return {
          success: true,
          available: false,
          reason: blackout.reason || 'Date is blocked',
        };
      }

      return {
        success: true,
        available: true,
        message: 'Date is available',
      };
    } catch (error) {
      return handleToolError(error, 'check_availability', tenantId);
    }
  },
};
```

#### Pattern 2: Multi-Step Queries

```typescript
const getDashboardTool = {
  async execute(input, { tenantId, prisma }) {
    try {
      // Step 1: Fetch independent data (parallel)
      const [customers, bookings, packages] = await Promise.all([
        prisma.customer.findMany({
          where: { tenantId },
          take: 50,
        }),
        prisma.booking.findMany({
          where: { tenantId },
          take: 50,
        }),
        prisma.package.findMany({
          where: { tenantId },
          take: 50,
        }),
      ]);

      // Step 2: Aggregate based on Step 1 results (sequential, dependent)
      const revenue = await calculateRevenue(tenantId, bookings);
      const occupancy = calculateOccupancy(bookings);

      return {
        success: true,
        customers: customers.length,
        bookings: bookings.length,
        packages: packages.length,
        revenue,
        occupancy,
      };
    } catch (error) {
      return handleToolError(error, 'get_dashboard', tenantId);
    }
  },
};
```

#### Pattern 3: Conditional Parallel

```typescript
const getRevenueBreakdownTool = {
  async execute(input, { tenantId, prisma }) {
    try {
      // Always get monthly revenue (base query)
      const monthlyRevenue = await prisma.booking.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: getMonthStart(),
            lt: getMonthEnd(),
          },
          status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
        },
        _sum: { totalPrice: true },
      });

      // Conditionally parallel based on user request
      const promises = [
        // Always include monthly
        Promise.resolve(monthlyRevenue),
      ];

      // Optional: yearly revenue if requested
      if (input.includeYearly) {
        promises.push(
          prisma.booking.aggregate({
            where: {
              tenantId,
              createdAt: {
                gte: getYearStart(),
                lt: getYearEnd(),
              },
              status: { in: ['PAID', 'CONFIRMED', 'FULFILLED'] },
            },
            _sum: { totalPrice: true },
          })
        );
      }

      // Optional: by-package breakdown if requested
      if (input.includeByPackage) {
        promises.push(
          prisma.booking.groupBy({
            by: ['packageId'],
            where: { tenantId },
            _sum: { totalPrice: true },
          })
        );
      }

      const [monthly, yearly, byPackage] = await Promise.all(promises);

      return {
        success: true,
        monthly: monthly._sum.totalPrice ?? 0,
        yearly: yearly?._sum.totalPrice ?? 0,
        byPackage: byPackage ?? [],
      };
    } catch (error) {
      return handleToolError(error, 'get_revenue_breakdown', tenantId);
    }
  },
};
```

### Code Review Checklist

When reviewing agent tool queries:

- [ ] Independent queries use `Promise.all`
- [ ] Dependent queries run sequentially
- [ ] No unnecessary sequential waits
- [ ] Tests verify parallel execution
- [ ] Error handling covers partial failures
- [ ] Performance baseline measured

---

## Implementation Timeline

### Phase 1: Critical (Week 1)

1. **Unbounded Queries (P1)** - Add `take` limits to all read tools
   - Time: 1-2 hours
   - Tools: get_packages, get_addons, get_segments, get_blackouts, get_blackout_dates

2. **Duplicate Tools (P2)** - Consolidate blackout tools
   - Time: 2-3 hours
   - Remove: get_blackouts, manage_blackout
   - Keep: get_blackout_dates, add_blackout_date, remove_blackout_date

### Phase 2: High Priority (Week 1-2)

3. **Type Safety (P2)** - Add validation for enums
   - Time: 2-3 hours
   - Add type guards for BookingStatus and other enums
   - Remove unsafe `as any` casts

4. **Error Handling DRY (P2)** - Extract helpers
   - Time: 2-3 hours
   - Create utils.ts with error handler, formatters, helpers
   - Refactor all tools to use utilities

5. **Database Index (P2)** - Add composite index
   - Time: 30 minutes
   - Add @@index([tenantId, createdAt, status]) to Booking
   - Verify with EXPLAIN ANALYZE

### Phase 3: Important (Week 2)

6. **Soft-Confirm Timing (P2)** - Add expiration
   - Time: 1-2 hours
   - Add `expiresAt` field to proposals
   - Check expiration before auto-confirm

7. **Parallel Queries (P3)** - Optimize performance
   - Time: 15 minutes
   - Use Promise.all in check_availability and similar tools

---

## Testing Strategy

### Unit Tests

```typescript
// Test unbounded queries
test('get_packages has pagination limit', async () => {
  // Create 200+ packages
  const response = await getPackagesTool.execute({}, context);
  expect(response.items.length).toBeLessThanOrEqual(50);
});

// Test type safety
test('invalid status rejected at runtime', async () => {
  const response = await getBookingsTool.execute({ status: 'INVALID_STATUS' }, context);
  expect(response.success).toBe(false);
  expect(response.error).toContain('Invalid status');
});

// Test error handling
test('error handling uses helper', async () => {
  // Mock prisma to throw
  const response = await getBookingsTool.execute({}, context);
  expect(response.success).toBe(false);
  expect(response.code).toBe(ToolErrorCode.DATABASE_ERROR);
});

// Test soft-confirm timing
test('expired proposals not auto-confirmed', async () => {
  const oldProposal = createProposal({
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  });
  const result = await softConfirmPendingT2(tenantId, 'okay');
  expect(result.confirmed).toBe(false);
});

// Test parallelization
test('parallel queries are faster', async () => {
  const start = Date.now();
  await checkAvailabilityTool.execute({ date: '2025-12-28' }, context);
  const elapsed = Date.now() - start;

  // Should be ~10ms (parallel), not ~20ms (sequential)
  expect(elapsed).toBeLessThan(20);
});
```

### Integration Tests

```typescript
// Test with real database
test('unbounded tools with 10k records', async () => {
  // Seed 10k+ records
  const response = await getPackagesTool.execute({}, context);

  // Should still return quickly despite large dataset
  expect(responseTime).toBeLessThan(100);
  expect(response.items.length).toBeLessThanOrEqual(50);
});

// Test index usage
test('dashboard query uses index', async () => {
  const plan = await EXPLAIN_ANALYZE(dashboardQuery);
  expect(plan).toContain('Index Scan');
  expect(plan).not.toContain('Seq Scan');
});
```

---

## Enforcement

### ESLint Rules

```javascript
// .eslintrc.json - Agent tools section
{
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": [
      "error",
      {
        "ignoreRestArgs": true,
        "fixToUnknown": false
      }
    ]
  },
  "overrides": [
    {
      "files": ["server/src/agent/tools/**/*.ts"],
      "rules": {
        "custom/require-take-limit": "error",
        "custom/require-error-handler": "error",
        "custom/no-duplicate-tools": "error"
      }
    }
  ]
}
```

### Pre-Commit Validation

```bash
#!/bin/bash
# .claude/hooks/validate-agent-tools.sh

echo "Validating agent tools..."

# Check for unbounded queries
if grep -r "findMany(" server/src/agent/tools --include="*.ts" | grep -v "take:" ; then
  echo "ERROR: Found unbounded findMany() queries"
  exit 1
fi

# Check for `as any` casts
if grep -r " as any" server/src/agent/tools --include="*.ts" ; then
  echo "WARNING: Found as any casts (verify necessity)"
fi

# Check for duplicate tools
if [ $(grep -r "^const get_" server/src/agent/tools | wc -l) -gt 20 ] ; then
  echo "WARNING: >20 get_ tools (check for duplicates)"
fi

echo "Agent tools validation passed"
```

---

## References

### Related Issues

- **Issue 451:** Unbounded queries in agent tools (P1)
- **Issue 452:** Duplicate blackout tools (P2)
- **Issue 453:** Type safety bypasses with `as any` (P2)
- **Issue 454:** Soft-confirm timing issues (P2)
- **Issue 455:** Duplicated error handling (P2)
- **Issue 456:** Missing database index (P2)
- **Issue 457:** Sequential queries that should be parallel (P3)

### Code Review Date

2025-12-28 - Comprehensive multi-agent code review of agent tools architecture

---

## Quick Reference Summary

| Issue               | Prevention                                | Implementation                           |
| ------------------- | ----------------------------------------- | ---------------------------------------- |
| Unbounded Queries   | Add `take` limits to all read tools       | `take: Math.min(limit, 100)`             |
| Duplicate Tools     | Clear naming, distinct purposes           | Keep 3 tools, remove 2 duplicates        |
| Type Safety         | Type guards and Zod validation            | `isValidStatus()` + Zod schemas          |
| Soft-Confirm Timing | Add `expiresAt`, check context            | 2-minute expiry window                   |
| Error Handling DRY  | Extract helpers to utils.ts               | `handleToolError()`, formatters          |
| Missing Index       | Composite index on WHERE fields           | `@@index([tenantId, createdAt, status])` |
| Sequential Queries  | Use `Promise.all` for independent queries | Parallel execution for ~2x faster        |

---

**Document Status:** Ready for implementation
**Last Updated:** 2025-12-28
**Next Review:** After Issues 451-457 implementation
