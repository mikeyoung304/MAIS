---
status: complete
priority: p2
issue_id: '432'
tags: [agent, feature, action-parity]
dependencies: []
---

# Agent Missing Action Parity for Key Features

## Problem Statement

The AI Business Growth Agent cannot perform several actions that users can do through the tenant-admin UI. This violates the agent-native principle: "Whatever the user can do, the agent can do."

## Severity: P2 - MEDIUM

Feature gap, not blocking. Agent is functional but incomplete.

## Findings

- Location: `server/src/agent/tools/read-tools.ts`, `write-tools.ts`
- Current tools: 9 read tools, 7 write tools
- Missing capabilities identified

## Missing Agent Tools

### Priority 1: High Impact Gaps

| Missing Action                             | User Route                                        | Impact                           |
| ------------------------------------------ | ------------------------------------------------- | -------------------------------- |
| **Manage Add-ons**                         | CRUD `/tenant-admin/addons`                       | HIGH - Core catalog feature      |
| **Create Booking** (on behalf of customer) | POST `/bookings`                                  | HIGH - Manual booking entry      |
| **Upload files directly**                  | POST `/tenant-admin/logo`, `/packages/:id/photos` | HIGH - File upload orchestration |

### Priority 2: Medium Impact Gaps

| Missing Action                   | User Route                              | Impact                     |
| -------------------------------- | --------------------------------------- | -------------------------- |
| **Manage Services** (scheduling) | CRUD `/tenant-admin/services`           | MEDIUM - Timeslot booking  |
| **Manage Availability Rules**    | CRUD `/tenant-admin/availability-rules` | MEDIUM - Scheduling config |
| **View/Manage Appointments**     | GET `/tenant-admin/appointments`        | MEDIUM - Timeslot bookings |

### Priority 3: Lower Impact Gaps

| Missing Action              | User Route                | Impact                    |
| --------------------------- | ------------------------- | ------------------------- |
| **Manage Segments**         | via segment.service       | LOW - Visual organization |
| **Manage Custom Domains**   | `/tenant-admin/domains`   | LOW - Advanced setup      |
| **Configure Calendar**      | `/tenant-admin/calendar`  | LOW - Google Calendar     |
| **Manage Deposit Settings** | `/tenant-admin/deposits`  | LOW - Payment config      |
| **Manage Email Reminders**  | `/tenant-admin/reminders` | LOW - Communication       |

## Proposed Solution

### Phase 1: Add-on Management (Priority 1)

```typescript
// New tools to add:
get_addons; // Read all add-ons for tenant
upsert_addon; // Create/update add-on (T2)
delete_addon; // Remove add-on (T2)
```

### Phase 2: Manual Booking (Priority 1)

```typescript
create_booking; // Create booking on behalf of customer (T3 - requires confirmation)
```

### Phase 3: Service/Scheduling (Priority 2)

```typescript
get_services; // Read all services
upsert_service; // Create/update service (T2)
manage_availability; // CRUD availability rules (T2)
get_appointments; // Read appointments
```

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts`
  - `server/src/agent/tools/write-tools.ts`
  - `server/src/agent/executors/index.ts`
- **Existing Pattern**: Follow current tool structure with trust tiers
- **Effort**: ~4 hours per tool category

## Acceptance Criteria

- [ ] Add-on CRUD tools implemented (get_addons, upsert_addon, delete_addon)
- [ ] create_booking tool implemented with T3 confirmation
- [ ] Tools follow existing patterns (tenant isolation, proposal mechanism)
- [ ] Agent can say "I've added an add-on called 'Second Photographer'"

## Review Sources

- Agent-Native Reviewer: 8/10 overall, needs action parity
- Assessment: "Main improvement opportunity is action parity"

## Notes

Source: Parallel code review session on 2025-12-26
The underlying architecture is solid and extensible.
Adding these capabilities follows existing patterns.
