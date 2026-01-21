# Project Hub: Backend, Frontend & Deployment Completion

**Created:** 2026-01-21
**Updated:** 2026-01-21 (Implementation Complete)
**Status:** ✅ COMPLETE
**Complexity:** MORE (5-day vertical slice approach)
**ADR:** ADR-018-hub-and-spoke-agent-architecture (linked)

> **Architecture Decision (Confirmed):**
>
> - **Tenant access:** Via Concierge orchestrator (hub-and-spoke pattern)
> - **Customer access:** Direct to Project Hub agent
> - **Pattern:** Matches existing Marketing/Storefront/Research specialists

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PROJECT HUB ARCHITECTURE (CONFIRMED)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║                    TENANT-SIDE (via Concierge Hub)                     ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                         ║ │
│  ║  ┌──────────────┐                     ┌──────────────────────┐         ║ │
│  ║  │   Tenant     │◄───────────────────►│    CONCIERGE         │         ║ │
│  ║  │  Dashboard   │                     │    (HUB AGENT)       │         ║ │
│  ║  │  /projects/* │                     │    Cloud Run         │         ║ │
│  ║  └──────────────┘                     └──────────┬───────────┘         ║ │
│  ║                                                   │                     ║ │
│  ║                           ┌───────────────────────┼───────────────┐    ║ │
│  ║                           │                       │               │    ║ │
│  ║                           ▼                       ▼               ▼    ║ │
│  ║            ┌──────────────────┐   ┌────────────────────┐   ┌────────┐ ║ │
│  ║            │    Marketing     │   │   Project Hub      │   │Research│ ║ │
│  ║            │    Specialist    │   │   Specialist       │   │Speciali│ ║ │
│  ║            │    (existing)    │   │   (NEW - Day 4)    │   │   st   │ ║ │
│  ║            └──────────────────┘   └────────────────────┘   └────────┘ ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║                    CUSTOMER-SIDE (Direct Entry)                        ║ │
│  ╠═══════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                         ║ │
│  ║  ┌──────────────┐         ┌──────────────────────────┐                 ║ │
│  ║  │   Customer   │◄───────►│  Project Hub Agent       │                 ║ │
│  ║  │  /project/   │         │  (contextType=customer)  │                 ║ │
│  ║  │    [id]      │         │  Direct entry            │                 ║ │
│  ║  └──────────────┘         └──────────────────────────┘                 ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│                    Both use SAME backend (9 endpoints)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture

| Principle                    | How We Follow It                                           |
| ---------------------------- | ---------------------------------------------------------- |
| **Google ADK Best Practice** | Orchestrator (Concierge) + Specialists pattern             |
| **Internal Pattern**         | Marketing, Storefront, Research already work this way      |
| **Session Isolation**        | Each specialist gets own session (`{agentUrl}:{tenantId}`) |
| **Dual-Context Security**    | `requireContext()` guards already in Project Hub           |
| **4-Tier getTenantId**       | Map.get() → state object → userId parsing → fallback       |

---

## Problem Statement

The Project Hub agent (11 tools, dual-context) is fully implemented but has no backend infrastructure to call. Customers and tenants have no UI to interact with projects.

**Current State:**

- ✅ Agent code complete (`server/src/agent-v2/deploy/project-hub/src/agent.ts`)
- ✅ Prisma models defined (Project, ProjectEvent, ProjectFile, ProjectRequest)
- ✅ Security patterns established (context guards, T3 confirmation, ownership verification)
- ✅ Backend endpoints implemented (9 endpoints in internal-agent.routes.ts)
- ✅ Customer UI created (`/t/_domain/project/[projectId]/page.tsx`)
- ✅ Tenant UI created (`/tenant/projects/page.tsx`)
- ✅ CI/CD workflow updated (`deploy-agents.yml` includes project-hub)
- ✅ SERVICE_REGISTRY.md updated (project-hub-agent pending deployment)
- ✅ Concierge has `delegate_to_project_hub` tool

---

## Implementation Timeline

| Day | Focus                                 | Deliverables                            |
| --- | ------------------------------------- | --------------------------------------- |
| 1   | Migration + Core endpoints            | Agent can bootstrap & fetch projects    |
| 2   | Request flow endpoints                | Customer can submit, tenant can approve |
| 3   | Customer UI                           | `/project/[id]` with chat               |
| 4   | Tenant UI + **Concierge Integration** | `/tenant/projects` + delegation tool    |
| 5   | Deploy + E2E + **CI/CD Update**       | Agent live, workflow updated            |

**Deferred to Phase 2:**

- File management (endpoints 16-18)
- 72-hour expiry cron job (monitor manually first)
- Activity summary endpoint

---

## Pre-Implementation Checklist

Before starting Day 1, complete these items:

### 1. Create Shared Contracts

**File:** `packages/contracts/src/schemas/project-hub.schema.ts`

```typescript
import { z } from 'zod';

// Request payload discriminated union (not `unknown`)
export const ProjectRequestPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RESCHEDULE'), newDate: z.string(), reason: z.string() }),
  z.object({ type: z.literal('ADD_ON'), addOnId: z.string(), notes: z.string().optional() }),
  z.object({ type: z.literal('QUESTION'), question: z.string() }),
  z.object({ type: z.literal('CHANGE_REQUEST'), description: z.string() }),
  z.object({
    type: z.literal('CANCELLATION'),
    reason: z.string(),
    confirmationReceived: z.boolean(),
  }),
  z.object({ type: z.literal('REFUND'), reason: z.string(), confirmationReceived: z.boolean() }),
  z.object({ type: z.literal('OTHER'), description: z.string() }),
]);

export const ProjectStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD']);
export const RequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'DENIED',
  'AUTO_HANDLED',
  'EXPIRED',
]);

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
  completedAt: z.date().optional(),
  category: z.enum(['prep', 'documents', 'logistics']).optional(),
});

export const ProjectBootstrapSchema = z.object({
  project: z.object({
    id: z.string(),
    status: ProjectStatusSchema,
    bookingDate: z.string(),
    serviceName: z.string(),
  }),
  hasPendingRequests: z.boolean(),
  pendingRequestCount: z.number(),
  greeting: z.string(),
});

export type ProjectRequestPayload = z.infer<typeof ProjectRequestPayloadSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type ProjectBootstrap = z.infer<typeof ProjectBootstrapSchema>;
```

### 2. Add ConcurrentModificationError

**File:** `server/src/lib/errors/business.ts` (add to existing)

```typescript
export class ConcurrentModificationError extends BusinessRuleError {
  constructor(message = 'Resource was modified by another user. Please refresh and try again.') {
    super(message, 'CONCURRENT_MODIFICATION', 409);
  }
}
```

### 3. Add `version` Field to ProjectRequest

**File:** `server/prisma/schema.prisma` (modification)

```prisma
model ProjectRequest {
  // ... existing fields
  version Int @default(1) // ADD THIS for optimistic locking
  // ...
}
```

### 4. Register Service in DI Container

**File:** `server/src/di.ts` (add to container registration)

```typescript
container.register('projectHubService', () => {
  return createProjectHubService({
    prisma: container.resolve('prisma'),
    bookingRepo: container.resolve('bookingRepo'),
    emailService: container.resolve('emailService'),
  });
});
```

---

## Day 1: Migration + Core Endpoints

### 1.1 Run Prisma Migration

The models exist in schema.prisma (lines 1076-1293). Run migration:

```bash
cd server && npx prisma migrate dev --name add_project_hub_models
```

**Note:** Add `version Int @default(1)` to `ProjectRequest` before migrating.

### 1.2 Project Hub Service

**File:** `server/src/services/project-hub.service.ts`

```typescript
import { PrismaClient, ProjectStatus, RequestStatus } from '@prisma/client';
import { ProjectRequestPayload, ChecklistItem } from '@macon/contracts';
import { logger } from '../lib/logger';
import { NotFoundError, ConcurrentModificationError } from '../lib/errors';

export interface ProjectHubServiceDeps {
  prisma: PrismaClient;
  bookingRepo: BookingRepository;
  emailService: EmailService;
}

export function createProjectHubService(deps: ProjectHubServiceDeps) {
  const { prisma, bookingRepo, emailService } = deps;

  return {
    // ═══════════════════════════════════════════════════════════════════
    // BOOTSTRAP (Day 1)
    // ═══════════════════════════════════════════════════════════════════

    async getCustomerBootstrap(projectId: string, customerId: string) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, customerId }, // Ownership verification
        include: {
          booking: { include: { package: true } },
          requests: { where: { status: 'PENDING' } },
        },
      });

      if (!project) throw new NotFoundError('Project not found');

      return {
        project: {
          id: project.id,
          status: project.status,
          bookingDate: project.booking.eventDate.toISOString(),
          serviceName: project.booking.package.name,
        },
        hasPendingRequests: project.requests.length > 0,
        pendingRequestCount: project.requests.length,
        greeting: `Welcome back! Your ${project.booking.package.name} is coming up.`,
      };
    },

    async getTenantBootstrap(tenantId: string) {
      const [pendingCount, activeCount] = await Promise.all([
        prisma.projectRequest.count({ where: { tenantId, status: 'PENDING' } }),
        prisma.project.count({ where: { tenantId, status: 'ACTIVE' } }),
      ]);

      return {
        pendingRequestCount: pendingCount,
        activeProjectCount: activeCount,
        greeting:
          pendingCount > 0
            ? `You have ${pendingCount} pending request${pendingCount > 1 ? 's' : ''} to review.`
            : 'All caught up! No pending requests.',
      };
    },

    // ═══════════════════════════════════════════════════════════════════
    // PROJECT OPERATIONS (Day 1)
    // ═══════════════════════════════════════════════════════════════════

    async getProject(projectId: string, tenantId: string) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId }, // CRITICAL: tenant scoping
        include: {
          booking: {
            include: {
              package: true,
              customer: { select: { id: true, name: true, email: true } },
            },
          },
          requests: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!project) throw new NotFoundError('Project not found');
      return project;
    },

    async getChecklist(projectId: string, tenantId: string): Promise<ChecklistItem[]> {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
        include: { booking: { include: { package: true } } },
      });

      if (!project) throw new NotFoundError('Project not found');

      // TODO: Make configurable per package via onboarding agent
      return [
        { id: '1', text: 'Confirm your attendance', completed: true, category: 'prep' },
        { id: '2', text: 'Review what to bring', completed: false, category: 'prep' },
        { id: '3', text: 'Check location details', completed: false, category: 'logistics' },
      ];
    },

    // ═══════════════════════════════════════════════════════════════════
    // REQUEST OPERATIONS (Day 2)
    // ═══════════════════════════════════════════════════════════════════

    async createRequest(projectId: string, tenantId: string, payload: ProjectRequestPayload) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
      });
      if (!project) throw new NotFoundError('Project not found');

      // T3 confirmation for sensitive requests
      if (payload.type === 'CANCELLATION' || payload.type === 'REFUND') {
        if (!payload.confirmationReceived) {
          return {
            requiresConfirmation: true,
            message: `Please confirm you want to submit a ${payload.type.toLowerCase()} request.`,
          };
        }
      }

      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      const request = await prisma.projectRequest.create({
        data: {
          tenantId,
          projectId,
          type: payload.type,
          status: 'PENDING',
          requestData: payload,
          expiresAt,
        },
      });

      await this.logEvent(projectId, tenantId, 'REQUEST_SUBMITTED', 'CUSTOMER', {
        requestId: request.id,
        requestType: payload.type,
      });

      logger.info({ projectId, requestId: request.id, type: payload.type }, 'Request created');

      return { request, expiresAt };
    },

    async getPendingRequests(tenantId: string, limit = 10) {
      return prisma.projectRequest.findMany({
        where: { tenantId, status: 'PENDING' },
        include: {
          project: {
            include: {
              booking: { include: { customer: true, package: true } },
            },
          },
        },
        orderBy: { expiresAt: 'asc' }, // Urgent first
        take: limit,
      });
    },

    async approveRequest(
      requestId: string,
      tenantId: string,
      response: string | undefined,
      expectedVersion: number
    ) {
      return prisma.$transaction(async (tx) => {
        const request = await tx.projectRequest.findFirst({
          where: { id: requestId, tenantId, status: 'PENDING' },
        });

        if (!request) throw new NotFoundError('Request not found or already handled');

        // Optimistic locking
        if (request.version !== expectedVersion) {
          throw new ConcurrentModificationError();
        }

        const updated = await tx.projectRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            responseData: response ? { message: response } : undefined,
            handledBy: 'TENANT',
            resolvedAt: new Date(),
            version: { increment: 1 },
          },
        });

        const nextVersion = await this.getNextEventVersion(tx, request.projectId);
        await tx.projectEvent.create({
          data: {
            tenantId,
            projectId: request.projectId,
            version: nextVersion,
            type: 'REQUEST_APPROVED',
            actor: 'TENANT',
            payload: { requestId, response },
            visibleToCustomer: true,
            visibleToTenant: true,
          },
        });

        return updated;
      });
    },

    async denyRequest(
      requestId: string,
      tenantId: string,
      reason: string,
      expectedVersion: number
    ) {
      return prisma.$transaction(async (tx) => {
        const request = await tx.projectRequest.findFirst({
          where: { id: requestId, tenantId, status: 'PENDING' },
        });

        if (!request) throw new NotFoundError('Request not found or already handled');

        if (request.version !== expectedVersion) {
          throw new ConcurrentModificationError();
        }

        const updated = await tx.projectRequest.update({
          where: { id: requestId },
          data: {
            status: 'DENIED',
            responseData: { reason },
            handledBy: 'TENANT',
            resolvedAt: new Date(),
            version: { increment: 1 },
          },
        });

        const nextVersion = await this.getNextEventVersion(tx, request.projectId);
        await tx.projectEvent.create({
          data: {
            tenantId,
            projectId: request.projectId,
            version: nextVersion,
            type: 'REQUEST_DENIED',
            actor: 'TENANT',
            payload: { requestId, reason },
            visibleToCustomer: true,
            visibleToTenant: true,
          },
        });

        return updated;
      });
    },

    // ═══════════════════════════════════════════════════════════════════
    // TIMELINE (Day 1-2)
    // ═══════════════════════════════════════════════════════════════════

    async getTimeline(projectId: string, tenantId: string, visibleToCustomer?: boolean) {
      const where: any = { projectId, project: { tenantId } };
      if (visibleToCustomer !== undefined) {
        where.visibleToCustomer = visibleToCustomer;
      }

      return prisma.projectEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    },

    async logEvent(
      projectId: string,
      tenantId: string,
      type: string,
      actor: string,
      payload: unknown,
      visibleToCustomer = true
    ) {
      const nextVersion = await this.getNextEventVersion(prisma, projectId);
      return prisma.projectEvent.create({
        data: {
          tenantId,
          projectId,
          version: nextVersion,
          type: type as any,
          actor: actor as any,
          payload: payload as any,
          visibleToCustomer,
          visibleToTenant: true,
        },
      });
    },

    // ═══════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════

    async getNextEventVersion(tx: any, projectId: string): Promise<number> {
      const lastEvent = await tx.projectEvent.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return (lastEvent?.version ?? 0) + 1;
    },
  };
}

export type ProjectHubService = ReturnType<typeof createProjectHubService>;
```

### 1.3 Add Endpoints to Existing Routes

**File:** `server/src/routes/internal-agent.routes.ts` (add to existing file)

**Core Endpoints (9 total):**

| #   | Path                                                   | Purpose                      |
| --- | ------------------------------------------------------ | ---------------------------- |
| 1   | `POST /project-hub/bootstrap/customer`                 | Customer session bootstrap   |
| 2   | `POST /project-hub/bootstrap/tenant`                   | Tenant session bootstrap     |
| 3   | `POST /project-hub/projects/:projectId`                | Get project details          |
| 4   | `POST /project-hub/projects/:projectId/checklist`      | Get prep checklist           |
| 5   | `POST /project-hub/projects/:projectId/events`         | Get timeline                 |
| 6   | `POST /project-hub/projects/:projectId/requests`       | Create customer request      |
| 7   | `POST /project-hub/tenants/:tenantId/pending-requests` | Get pending requests         |
| 8   | `POST /project-hub/requests/:requestId/approve`        | Approve with optimistic lock |
| 9   | `POST /project-hub/requests/:requestId/deny`           | Deny with optimistic lock    |

### 1.4 Project Creation via Event Emitter

**File:** `server/src/services/project-hub.service.ts` (add initialization)

```typescript
import { BookingEvents, bookingEventEmitter } from './booking.service';

export function initProjectHubListeners(projectHubService: ProjectHubService) {
  bookingEventEmitter.on(BookingEvents.CONFIRMED, async (booking) => {
    try {
      await projectHubService.createProjectForBooking(booking);
    } catch (error) {
      logger.error({ bookingId: booking.id, error }, 'Failed to create project for booking');
    }
  });
}
```

---

## Day 2: Request Flow Completion

**Tasks:**

- [ ] Test all 9 endpoints with Postman/curl
- [ ] Verify optimistic locking works (concurrent approval test)
- [ ] Verify T3 confirmation required for cancellation/refund
- [ ] Add rate limiting middleware to chat-related endpoints

---

## Day 3: Customer Frontend

### 3.1 Customer Project View

**File:** `apps/web/src/app/project/[id]/page.tsx`

- Status card with booking details
- Pending request banner
- Preparation checklist
- Activity timeline
- Chat widget with `agentType="project-hub"` and `contextType="customer"`

### 3.2 Extend Existing Chat Widget

**File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`

Add `agentType` and `projectId` props to support Project Hub agent.

---

## Day 4: Tenant Frontend + Concierge Integration (UPDATED)

### 4.1 Projects Dashboard

**File:** `apps/web/src/app/(protected)/tenant/projects/page.tsx`

- Pending requests section with urgency indicators
- Projects table with status and last activity
- Click-through to project detail

### 4.2 Project Detail

**File:** `apps/web/src/app/(protected)/tenant/projects/[id]/page.tsx`

- Customer info card
- Request management (approve/deny with optimistic locking)
- Full timeline (internal visibility)
- Chat sidebar for messaging customer

### 4.3 Concierge Integration (NEW)

**Why:** Tenants interact with the concierge for all dashboard operations. The concierge needs to route project-related requests to the Project Hub specialist.

#### 4.3.1 Update Concierge Environment Variables

**File:** `.github/workflows/deploy-agents.yml` (Cloud Run env vars)

Add to concierge service:

```yaml
PROJECT_HUB_AGENT_URL: https://project-hub-agent-506923455711.us-central1.run.app
```

#### 4.3.2 Add Specialist URL

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
const SPECIALIST_URLS = {
  marketing: requireEnv('MARKETING_AGENT_URL'),
  storefront: requireEnv('STOREFRONT_AGENT_URL'),
  research: requireEnv('RESEARCH_AGENT_URL'),
  projectHub: requireEnv('PROJECT_HUB_AGENT_URL'), // ADD
};
```

#### 4.3.3 Add Delegation Tool

**File:** `server/src/agent-v2/deploy/concierge/src/agent.ts`

```typescript
const DelegateToProjectHubParams = z.object({
  task: z
    .string()
    .describe(
      'What to do: "check_pending", "view_project", "approve_request", "deny_request", "send_message"'
    ),
  projectId: z.string().optional().describe('Project ID if viewing/messaging specific project'),
  requestId: z.string().optional().describe('Request ID for approve/deny operations'),
  message: z.string().optional().describe('Message content for send_message'),
});

const delegateToProjectHubTool = new FunctionTool({
  name: 'delegate_to_project_hub',
  description:
    'Delegate project/customer management to Project Hub. Use for viewing projects, handling requests, messaging customers.',
  parameters: DelegateToProjectHubParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const sessionId = context?.invocationId || `session-${Date.now()}`;
    const taskKey = `projectHub:${tenantId}:${params.task}`;

    logger.info({}, `[Concierge] Delegating to Project Hub: ${params.task}`);

    let message = `Task: ${params.task}`;
    if (params.projectId) message += `\nProject ID: ${params.projectId}`;
    if (params.requestId) message += `\nRequest ID: ${params.requestId}`;
    if (params.message) message += `\nMessage: ${params.message}`;

    const result = await callSpecialistAgent(
      SPECIALIST_URLS.projectHub,
      'agent',
      message,
      tenantId,
      sessionId
    );

    if (!result.ok) {
      if (shouldRetry(taskKey)) {
        const retryResult = await callSpecialistAgent(
          SPECIALIST_URLS.projectHub,
          'agent',
          `Simple ${params.task}`,
          tenantId,
          sessionId
        );
        if (retryResult.ok) {
          clearRetry(taskKey);
          return {
            success: true,
            specialist: 'project-hub',
            task: params.task,
            result: retryResult.response,
          };
        }
      }
      clearRetry(taskKey);
      return {
        success: false,
        error: result.error,
        suggestion: 'Try again or view the project directly in the dashboard.',
      };
    }

    clearRetry(taskKey);
    return {
      success: true,
      specialist: 'project-hub',
      task: params.task,
      result: result.response,
    };
  },
});
```

#### 4.3.4 Update System Prompt Decision Tree

Add to `CONCIERGE_SYSTEM_PROMPT`:

```
├─ Does this involve CUSTOMER PROJECTS or REQUESTS?
│  → Delegate to PROJECT_HUB_SPECIALIST
│  → Examples: "check pending requests", "message customer", "approve that request"
│  → Examples: "show my projects", "what requests need attention"
```

#### 4.3.5 Add Tool to Agent

```typescript
tools: [
  // ... existing tools
  delegateToProjectHubTool,  // ADD
],
```

---

## Day 5: Deploy + E2E + CI/CD Update (UPDATED)

### 5.1 Update CI/CD Workflow

**File:** `.github/workflows/deploy-agents.yml`

Add `project-hub` to workflow options:

```yaml
options:
  - all
  - concierge
  - marketing
  - storefront
  - research
  - booking
  - project-hub # ADD
```

Update detection loop:

```bash
for AGENT in concierge marketing storefront research booking project-hub; do
```

Update summary table:

```bash
echo "| project-hub | https://project-hub-agent-506923455711.us-central1.run.app |" >> $GITHUB_STEP_SUMMARY
```

### 5.2 Update SERVICE_REGISTRY.md

**File:** `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

Add row:

```markdown
| project-hub | `project-hub-agent` | https://project-hub-agent-506923455711.us-central1.run.app | Pending | 2026-01-XX |
```

### 5.3 Deploy Agent to Cloud Run

```bash
cd server/src/agent-v2/deploy/project-hub
npm ci && npm run deploy
```

After successful deployment:

```bash
gcloud run services describe project-hub-agent --region=us-central1
```

### 5.4 Deploy Updated Concierge

```bash
cd server/src/agent-v2/deploy/concierge
npm ci && npm run deploy
```

### 5.5 E2E Test Checklist

**Customer Flow:**

- [ ] Customer can view project at /project/[id]
- [ ] Customer can send message, agent responds
- [ ] Customer can submit reschedule request
- [ ] T3 confirmation required for cancellation

**Tenant Flow (via Concierge):**

- [ ] "Check my pending requests" routes to Project Hub
- [ ] Request appears in tenant dashboard
- [ ] Tenant can approve request (check version handling)
- [ ] Tenant can deny request with reason
- [ ] Customer sees approval/denial in timeline

**Direct Tenant Flow:**

- [ ] Tenant can view projects at /tenant/projects
- [ ] Tenant can view project detail
- [ ] Tenant can message customer via chat widget

---

## Acceptance Criteria

### Functional Requirements (MVP)

- [ ] Customer can view project status at `/project/[id]`
- [ ] Customer can see preparation checklist
- [ ] Customer can chat with agent and ask questions
- [ ] Customer can submit requests (reschedule, add-on, etc.)
- [ ] Tenant can view all projects at `/tenant/projects`
- [ ] Tenant can see pending requests with urgency indicator
- [ ] Tenant can approve/deny requests with optional response
- [ ] Tenant can ask Concierge about projects and it routes correctly
- [ ] Optimistic locking prevents race conditions

### Infrastructure Requirements

- [ ] Project Hub agent deployed to Cloud Run
- [ ] CI/CD workflow includes project-hub
- [ ] SERVICE_REGISTRY.md updated
- [ ] Concierge has `delegate_to_project_hub` tool
- [ ] Concierge has `PROJECT_HUB_AGENT_URL` env var

### Deferred to Phase 2

- [ ] File management (upload, view, delete)
- [ ] 72-hour expiry cron job
- [ ] Activity summary endpoint
- [ ] Tenant notes editing
- [ ] Real-time updates (WebSocket/SSE)

---

## Risk Analysis

| Risk                           | Mitigation                                        |
| ------------------------------ | ------------------------------------------------- |
| Race condition on approval     | Optimistic locking with version field             |
| Customer accesses tenant tools | Context guards in agent (already implemented)     |
| Missing 72-hour expiry         | Monitor manually for 2 weeks, then add cron       |
| Chat widget integration issues | Extend existing widget, don't create new          |
| Concierge fails to route       | Retry logic + fallback to direct dashboard access |
| CI/CD workflow not triggered   | Manual deploy via workflow_dispatch               |

---

## References

### Internal Files

- Agent: `server/src/agent-v2/deploy/project-hub/src/agent.ts`
- Concierge: `server/src/agent-v2/deploy/concierge/src/agent.ts`
- Schema: `server/prisma/schema.prisma:1076-1293`
- Routes: `server/src/routes/internal-agent.routes.ts`
- Chat widget: `apps/web/src/components/chat/CustomerChatWidget.tsx`
- CI/CD: `.github/workflows/deploy-agents.yml`
- Registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

### Architecture Decision

- ADR-018: Hub-and-Spoke Agent Architecture (`docs/adrs/ADR-018-hub-and-spoke-agent-architecture.md`)

### Patterns to Follow

- DI registration: `server/src/di.ts`
- Event emitter: `server/src/services/booking.service.ts` (BookingEvents)
- Error classes: `server/src/lib/errors/business.ts`
- A2A protocol: `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md`
- Session isolation: `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md`

### Prevention Docs

- Dual-context isolation: `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md`
- Zod validation: `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
- Tool state returns: `docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md`

---

## Review Feedback Applied

- **DHH:** Reduced endpoints 18→9, vertical slice approach, defer file management
- **Kieran:** Added shared contracts, DI registration, optimistic locking version field
- **Simplicity:** Reuse existing chat widget, inline simple UI, defer cron job
- **Architecture Review (2026-01-21):** Confirmed hub-and-spoke via Concierge for tenants, direct entry for customers
