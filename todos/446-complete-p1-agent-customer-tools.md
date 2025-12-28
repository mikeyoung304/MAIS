---
status: complete
priority: p1
issue_id: '446'
tags: [agent, tools, customers, action-parity]
dependencies: []
---

# Add Customer Tools for Agent (Action Parity)

## Problem Statement

Users will ask "show me my customers" or "who booked last month" - agent has no tools for this. Complete CRUD gap for customer entity.

## Severity: P1 - CRITICAL

High-value user request with no agent capability. Action parity gap.

## Findings

- Location: `server/src/agent/tools/read-tools.ts` (new tools needed)
- Customers exist in database via Booking.customerEmail, Booking.customerName
- No dedicated Customer model, but booking data has customer info
- UI shows customer list at /tenant/customers (planned)

## Problem Scenario

1. User: "Show me my clients from this month"
2. Agent: "I don't have a tool to view customer information"
3. User has to leave chat and go to UI

## Proposed Solution

Add `get_customers` read tool:

```typescript
export const getCustomersTool: AgentTool = {
  name: 'get_customers',
  description: 'Get list of customers who have booked. Can filter by date range or booking status.',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Filter bookings from this date (ISO format)' },
      endDate: { type: 'string', description: 'Filter bookings until this date (ISO format)' },
      limit: { type: 'number', description: 'Max customers to return (default 20)' },
    },
    required: [],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    // Aggregate unique customers from bookings
    const bookings = await prisma.booking.findMany({
      where: { tenantId, ...dateFilters },
      select: { customerEmail: true, customerName: true, date: true, totalPrice: true },
      orderBy: { date: 'desc' },
      take: limit,
    });
    // Dedupe by email, sum totals
    return { success: true, data: customers };
  },
};
```

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Add get_customers
  - `server/src/agent/tools/all-tools.ts` - Export
- **Related Components**: Booking model
- **Database Changes**: No (uses existing booking data)

## Acceptance Criteria

- [ ] `get_customers` tool created and exported
- [ ] Returns customer name, email, booking count, total spent
- [ ] Supports date range filtering
- [ ] Dedupes customers by email
- [ ] System prompt documents the capability
- [ ] Tests pass

## Notes

Source: Agent-Native Architecture Analysis on 2025-12-28
Estimated Effort: Medium (2-3 hours)
