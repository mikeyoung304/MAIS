---
title: ADK Agent-to-Backend Integration Pattern
category: patterns
component: agent-v2, routes
tags: [google-adk, vertex-ai, backend-integration, authentication, multi-tenant, internal-api]
created: 2026-01-18
related:
  - adk-agent-deployment-pattern.md
  - ../integration-issues/adk-cloud-run-bundler-transitive-imports.md
---

# ADK Agent-to-Backend Integration Pattern

How deployed Vertex AI agents (ADK) communicate securely with the MAIS backend to access tenant data.

## The Pattern

Deployed ADK agents call **internal backend endpoints** that:

1. Authenticate with a shared secret header
2. Accept tenant context in every request body
3. Return data scoped to that specific tenant
4. Never expose internal endpoints publicly

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cloud Run     │     │   MAIS API      │     │   Database      │
│  (ADK Agent)    │────▶│  /v1/internal/  │────▶│  (Prisma)       │
│                 │     │     agent/*     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │ X-Internal-Secret     │ tenantId scoping
        │ header                │ on ALL queries
        ▼                       ▼
   Shared secret           Multi-tenant
   authentication          data isolation
```

## Authentication: X-Internal-Secret

### Why Not JWT?

- ADK agents run as **stateless services** without user sessions
- Agents need to call backend on behalf of multiple tenants
- Shared secret is simpler and appropriate for service-to-service auth

### Backend Implementation

```typescript
// server/src/routes/internal-agent.routes.ts

const verifyInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
  const secret = req.headers['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  // Fail-safe: reject if secret not configured
  if (!expectedSecret) {
    logger.warn('Internal API secret not configured - rejecting request');
    res.status(503).json({ error: 'Internal API not configured' });
    return;
  }

  // Verify secret matches
  if (!secret || secret !== expectedSecret) {
    logger.warn({ ip: req.ip }, 'Invalid internal API secret');
    res.status(403).json({ error: 'Invalid API secret' });
    return;
  }

  next();
};

// Apply to all internal routes
router.use(verifyInternalSecret);
```

### Agent-Side Implementation

```typescript
// In deployed agent (agent.ts)

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

async function callMaisApi(endpoint: string, tenantId: string, params = {}) {
  const response = await fetch(`${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_API_SECRET, // <-- Shared secret
    },
    body: JSON.stringify({ tenantId, ...params }), // <-- Tenant in EVERY request
  });

  if (!response.ok) {
    return { ok: false, error: `API error: ${response.status}` };
  }
  return { ok: true, data: await response.json() };
}
```

## Multi-Tenant Isolation

### CRITICAL: Every Request Includes tenantId

Agents extract tenant context from session state and include it in every API call:

```typescript
// Agent tool extracting tenant context
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  return context.state?.get<string>('tenantId') ?? null;
}

// Every tool uses it
const myTool = new FunctionTool({
  name: 'get_services',
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { error: 'No tenant context' };

    return await callMaisApi('/services', tenantId); // <-- Always pass tenantId
  },
});
```

### Backend Scopes ALL Queries

```typescript
// Backend endpoint - note tenantId from request body
router.post('/services', async (req: Request, res: Response) => {
  const { tenantId } = GetServicesSchema.parse(req.body);

  // CRITICAL: Query is scoped by tenantId
  const packages = await catalogService.getAllPackages(tenantId);

  res.json({ services: packages.map(mapToAgentFormat) });
});
```

### Request Schema Pattern

Every request body schema extends `TenantIdSchema`:

```typescript
const TenantIdSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
});

const GetServicesSchema = TenantIdSchema.extend({
  category: z.string().optional(),
  activeOnly: z.boolean().default(true),
});

const CheckAvailabilitySchema = TenantIdSchema.extend({
  serviceId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});
```

## API Design Guidelines

### Use POST for All Endpoints

Even for read operations, use POST to:

- Include `tenantId` consistently in body (not query params)
- Avoid logging sensitive data in URLs
- Keep a uniform request format

```typescript
// ✅ CORRECT - POST with body
router.post('/services', async (req, res) => {
  const { tenantId, activeOnly } = GetServicesSchema.parse(req.body);
  // ...
});

// ❌ WRONG - GET with query params
router.get('/services', async (req, res) => {
  const tenantId = req.query.tenantId; // Logged in URLs, inconsistent
  // ...
});
```

### Return Agent-Friendly Formats

Map internal domain models to simpler formats agents can work with:

```typescript
// Internal model (complex)
interface PackageWithAddOns {
  id: string;
  slug: string;
  title: string; // Domain uses "title"
  description: string | null;
  priceCents: number;
  photoUrl: string | null;
  bookingType: BookingType;
  addOns: AddOn[];
}

// Agent format (simple, consistent naming)
const agentService = {
  id: pkg.id,
  slug: pkg.slug,
  name: pkg.title, // Agents use "name"
  description: pkg.description,
  priceCents: pkg.priceCents,
  bookingType: pkg.bookingType || 'DATE',
  addOns: pkg.addOns?.map((a) => ({
    id: a.id,
    name: a.title,
    priceCents: a.priceCents,
  })),
};
```

### Handle Entity Type Variations

MAIS has two entity types for bookable items:

- **Package**: DATE bookings (weddings, events) - from `CatalogService`
- **Service**: TIMESLOT bookings (appointments) - from `ServiceRepository`

Handle both in availability checking:

```typescript
router.post('/availability', async (req, res) => {
  const { tenantId, serviceId, startDate, endDate } = CheckAvailabilitySchema.parse(req.body);

  // Check if it's a TIMESLOT service
  if (serviceRepo) {
    const service = await serviceRepo.getById(tenantId, serviceId);
    if (service) {
      // Return time slots
      const slots = await schedulingService.getAvailableSlots({ tenantId, serviceId, ... });
      return res.json({ bookingType: 'TIMESLOT', slots });
    }
  }

  // Default to DATE availability
  const dates = generateDateRange(startDate, endDate);
  res.json({ bookingType: 'DATE', dates });
});
```

## Endpoint Reference

| Endpoint                | Purpose              | Key Parameters                                  |
| ----------------------- | -------------------- | ----------------------------------------------- |
| `POST /services`        | List all services    | `tenantId`, `activeOnly?`                       |
| `POST /service-details` | Get service by ID    | `tenantId`, `serviceId`                         |
| `POST /availability`    | Check availability   | `tenantId`, `serviceId`, `startDate`, `endDate` |
| `POST /business-info`   | Get business details | `tenantId`                                      |
| `POST /faq`             | Answer FAQ question  | `tenantId`, `question`                          |
| `POST /recommend`       | Get recommendations  | `tenantId`, `preferences`                       |
| `POST /create-booking`  | Create booking       | `tenantId`, `serviceId`, `customerEmail`, ...   |

## Environment Configuration

### Backend (.env)

```bash
INTERNAL_API_SECRET=your-secret-here-at-least-32-chars
```

### Cloud Run Agent

```bash
# Set via gcloud CLI
gcloud run services update booking-agent \
  --set-env-vars="MAIS_API_URL=https://api.gethandled.ai" \
  --set-env-vars="INTERNAL_API_SECRET=your-secret-here" \
  --set-env-vars="AGENT_API_PATH=/v1/internal/agent"
```

## Testing Internal Endpoints

```bash
# Test locally (assuming server running on 3001)
INTERNAL_SECRET="your-local-secret"
TENANT_ID="your-test-tenant-id"

# Get services
curl -X POST http://localhost:3001/v1/internal/agent/services \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  -d "{\"tenantId\": \"$TENANT_ID\"}"

# Check availability
curl -X POST http://localhost:3001/v1/internal/agent/availability \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $INTERNAL_SECRET" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"serviceId\": \"pkg-123\",
    \"startDate\": \"2026-06-01\",
    \"endDate\": \"2026-06-07\"
  }"
```

## Critical Rules

### DO

- Include `tenantId` in **every** request body
- Use X-Internal-Secret header for authentication
- Return 503 if secret not configured (fail-safe)
- Map internal models to agent-friendly formats
- Log endpoint calls for debugging (without sensitive data)

### DON'T

- Expose internal endpoints publicly (no `/api/internal/*` in public routes)
- Trust tenantId from anywhere except the request body
- Return raw Prisma models (map to simple objects)
- Use GET methods with query params for tenant-scoped data
- Log the X-Internal-Secret value

## Security Checklist

- [ ] `INTERNAL_API_SECRET` is set in both backend and Cloud Run
- [ ] Secret is at least 32 characters
- [ ] Internal routes are NOT registered under public router
- [ ] All endpoints validate `tenantId` presence
- [ ] All database queries filter by `tenantId`
- [ ] Error responses don't leak internal details

## Related Documentation

- [ADK Agent Deployment Pattern](./adk-agent-deployment-pattern.md) - How to deploy agents
- [ADK Bundler Issues](../integration-issues/adk-cloud-run-bundler-transitive-imports.md) - Solving import issues
- [Multi-Tenant Quick Start](../../../../docs/multi-tenant/MULTI_TENANT_QUICK_START.md) - MAIS tenant model

## Deployed Endpoints

| Environment | Base URL                    | Path                 |
| ----------- | --------------------------- | -------------------- |
| Production  | `https://api.gethandled.ai` | `/v1/internal/agent` |
| Local Dev   | `http://localhost:3001`     | `/v1/internal/agent` |
