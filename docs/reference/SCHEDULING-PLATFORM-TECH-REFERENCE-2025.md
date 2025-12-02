# Scheduling Platform Technical Reference 2025
## MAIS Stack Optimization Guide

Generated: 2025-11-27
Target Stack: Prisma 6, ts-rest, Express, TypeScript, React, TanStack Query, Stripe Connect

---

## Table of Contents

1. [Prisma 6 Patterns for Scheduling Systems](#1-prisma-6-patterns-for-scheduling-systems)
2. [ts-rest + Zod Contract Patterns](#2-ts-rest--zod-contract-patterns)
3. [Express + TypeScript Multi-tenant Patterns](#3-express--typescript-multi-tenant-patterns)
4. [React + TanStack Query for Real-time UIs](#4-react--tanstack-query-for-real-time-uis)
5. [Stripe Connect Multi-tenant Patterns](#5-stripe-connect-multi-tenant-patterns)
6. [Google Calendar API with TypeScript](#6-google-calendar-api-with-typescript)
7. [Testing Strategies for Scheduling Systems](#7-testing-strategies-for-scheduling-systems)
8. [NPM Packages Summary](#8-npm-packages-summary)

---

## 1. Prisma 6 Patterns for Scheduling Systems

### 1.1 Concurrency Control Strategies

#### Optimistic Concurrency Control (Recommended for High Traffic)

**When to use**: High-concurrency booking systems where conflicts are rare and avoiding locks improves scalability.

**Pattern**: Version field tracking
```typescript
// Schema definition
model Booking {
  id        String   @id @default(cuid())
  tenantId  String
  date      DateTime
  version   Int      @default(0)

  @@unique([tenantId, date])
  @@index([tenantId, date])
}

// Service implementation
async function createBooking(tenantId: string, date: Date) {
  // Read with current version
  const existing = await prisma.booking.findFirst({
    where: { tenantId, date }
  });

  if (existing) {
    throw new BookingConflictError(date);
  }

  // Create with initial version
  return await prisma.booking.create({
    data: { tenantId, date, version: 1 }
  });
}

// Update with version check
async function updateBooking(id: string, tenantId: string, data: UpdateData, expectedVersion: number) {
  const result = await prisma.booking.updateMany({
    where: {
      id,
      tenantId,
      version: expectedVersion // Only update if version matches
    },
    data: {
      ...data,
      version: { increment: 1 }
    }
  });

  if (result.count === 0) {
    throw new OptimisticLockError('Booking was modified by another request');
  }
}
```

**Performance**: Testing with 1,200 concurrent users on 1,000 seats showed 376 graceful failures vs. data corruption in naive approaches.

**Trade-offs**: Some requests fail gracefully, but prevents data corruption and overbooking.

#### Pessimistic Locking (For Critical Operations)

**When to use**: Payment processing, high-value bookings, or when conflicts are likely.

**Pattern**: Database-level row locking with `FOR UPDATE`
```typescript
// Interactive transaction with pessimistic lock
async function createBookingWithLock(tenantId: string, date: Date, data: BookingData) {
  return await prisma.$transaction(async (tx) => {
    // Lock the date row (or create if doesn't exist)
    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM bookings
      WHERE "tenantId" = ${tenantId} AND date = ${date}
      FOR UPDATE
    `;

    if (existing.length > 0) {
      throw new BookingConflictError(date);
    }

    // Create booking within same transaction
    return await tx.booking.create({
      data: { tenantId, date, ...data }
    });
  }, {
    maxWait: 2000,  // 2 seconds to acquire transaction
    timeout: 5000,  // 5 seconds max transaction duration
    isolationLevel: 'Serializable' // Strictest isolation
  });
}
```

**Critical Warning**: "Keeping transactions open for a long time hurts database performance and can even cause deadlocks. Try to avoid performing network requests and executing slow queries inside your transaction functions."

**Best Practices**:
- Keep transactions under 5 seconds
- Avoid external API calls inside transactions
- Use for read-modify-write patterns only
- Configure appropriate timeout values

### 1.2 Date/Time Query Optimization

#### Indexing Strategies

**B-Tree Indexes (Default, Recommended for Date Ranges)**
```prisma
model Booking {
  id        String   @id @default(cuid())
  tenantId  String
  date      DateTime
  startTime DateTime
  endTime   DateTime

  // Composite index for tenant + date range queries
  @@index([tenantId, date])
  @@index([tenantId, startTime, endTime])

  // Unique constraint for double-booking prevention
  @@unique([tenantId, date])
}
```

**Why B-Tree**: Supports equality (=) and range operators (<, <=, >, >=), ideal for:
- Finding bookings between dates
- Availability checks for date ranges
- Chronological sorting

**Performance Impact**: Without indexing, queries become exponentially slower as data grows. With proper indexing, query time remains nearly constant even with 1 million records.

**When to Use Hash Indexes**: Only if querying by exact date match (equality only), but B-Tree handles this efficiently too.

#### Efficient Date Range Queries
```typescript
// Find available slots for a date range (tenant-scoped)
async function findAvailableSlots(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  return await prisma.booking.findMany({
    where: {
      tenantId, // CRITICAL: Always filter by tenantId
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: {
      date: 'asc'
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true
    }
  });
}

// Check availability for specific time slot
async function isSlotAvailable(
  tenantId: string,
  date: Date,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const conflict = await prisma.booking.findFirst({
    where: {
      tenantId,
      date,
      OR: [
        {
          // New booking starts during existing booking
          startTime: { lte: startTime },
          endTime: { gt: startTime }
        },
        {
          // New booking ends during existing booking
          startTime: { lt: endTime },
          endTime: { gte: endTime }
        },
        {
          // New booking completely contains existing booking
          startTime: { gte: startTime },
          endTime: { lte: endTime }
        }
      ]
    }
  });

  return conflict === null;
}
```

### 1.3 Soft Delete Patterns

**Recommended Approach**: Use Prisma Client Extensions (middleware is deprecated)

#### Installation
```bash
npm install prisma-extension-soft-delete
```

#### Schema Setup
```prisma
model Booking {
  id        String    @id @default(cuid())
  tenantId  String
  date      DateTime
  deletedAt DateTime? // Nullable timestamp for soft delete

  @@index([tenantId, deletedAt]) // Index for filtering deleted records
}
```

#### Implementation
```typescript
import { PrismaClient } from '@prisma/client';
import { softDelete } from 'prisma-extension-soft-delete';

const prisma = new PrismaClient().$extends(
  softDelete({
    models: {
      Booking: {
        field: 'deletedAt',
        createValue: (deleted) => deleted ? new Date() : null,
      },
    },
    defaultConfig: {
      field: 'deletedAt',
      createValue: (deleted) => deleted ? new Date() : null,
    }
  })
);

// Usage - automatically excludes soft-deleted records
const activeBookings = await prisma.booking.findMany({
  where: { tenantId }
  // No need to manually add deletedAt: null
});

// Soft delete a booking
await prisma.booking.delete({
  where: { id: bookingId }
  // Sets deletedAt to current timestamp
});

// Include soft-deleted records explicitly
const allBookings = await prisma.booking.findMany({
  where: {
    tenantId,
    deletedAt: { not: null } // Explicitly query deleted records
  }
});

// Restore a soft-deleted booking
await prisma.booking.update({
  where: { id: bookingId },
  data: { deletedAt: null }
});
```

**Benefits**:
- Preserves booking history for compliance
- Easy data recovery
- Audit trail maintenance
- No need to manually add `deletedAt: null` to every query

**Costs**:
- Additional storage for deleted records
- Slightly more complex queries if accessing deleted records
- Need to periodically archive truly old records

### 1.4 Transaction Best Practices

**Configuration Options**:
```typescript
await prisma.$transaction(
  async (tx) => {
    // Transaction logic here
  },
  {
    maxWait: 2000,  // Time to acquire transaction (default: 2s)
    timeout: 5000,  // Max transaction duration (default: 5s)
    isolationLevel: 'Serializable' // Strictest isolation
  }
);
```

**Isolation Levels**:
- `ReadUncommitted`: Fastest, but allows dirty reads
- `ReadCommitted`: Prevents dirty reads (PostgreSQL default)
- `RepeatableRead`: Consistent snapshot within transaction
- `Serializable`: Strictest, prevents all anomalies (use for booking)

**Do's**:
- Keep transactions short (< 5 seconds)
- Use for read-modify-write patterns
- Group related operations together
- Handle rollbacks with try-catch

**Don'ts**:
- Avoid network requests inside transactions
- Don't run slow queries
- Don't hold locks longer than necessary
- Don't nest transactions unnecessarily

---

## 2. ts-rest + Zod Contract Patterns

### 2.1 Date/Time Handling in Contracts

**Problem**: JavaScript Date objects don't serialize well in JSON. Zod provides datetime string validation.

#### Date String Validation
```typescript
import { z } from 'zod';

// ISO 8601 datetime string
const BookingSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string(),
  date: z.string().datetime(), // "2025-11-27T10:00:00Z"
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  createdAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable()
});

// Date-only validation (no time component)
const DateOnlySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // "2025-11-27"
});

// Custom date validation with business rules
const BookingRequestSchema = z.object({
  date: z.string().datetime().refine(
    (date) => new Date(date) > new Date(),
    { message: "Booking date must be in the future" }
  ),
  startTime: z.string().datetime(),
  endTime: z.string().datetime()
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "End time must be after start time" }
);
```

#### Contract Definition with Nested Validation
```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const bookingContract = c.router({
  // Get available slots
  getAvailableSlots: {
    method: 'GET',
    path: '/bookings/available',
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      duration: z.number().min(15).max(480) // 15 min to 8 hours
    }),
    responses: {
      200: z.array(z.object({
        date: z.string().datetime(),
        available: z.boolean(),
        slots: z.array(z.object({
          startTime: z.string().datetime(),
          endTime: z.string().datetime()
        }))
      }))
    }
  },

  // Create booking
  createBooking: {
    method: 'POST',
    path: '/bookings',
    body: BookingRequestSchema,
    responses: {
      201: BookingSchema,
      409: z.object({
        error: z.string(),
        conflictingDate: z.string().datetime()
      })
    }
  },

  // Update booking
  updateBooking: {
    method: 'PATCH',
    path: '/bookings/:id',
    pathParams: z.object({
      id: z.string().cuid()
    }),
    body: BookingRequestSchema.partial(),
    responses: {
      200: BookingSchema,
      404: z.object({ error: z.string() }),
      409: z.object({
        error: z.string(),
        expectedVersion: z.number(),
        actualVersion: z.number()
      })
    }
  }
});
```

### 2.2 Webhook Payload Validation

**Use Case**: Validate incoming webhook payloads from Stripe, Google Calendar, etc.

```typescript
// Stripe webhook contract
const StripeWebhookSchema = z.object({
  id: z.string(),
  type: z.enum([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'account.updated',
    'account.application.deauthorized'
  ]),
  data: z.object({
    object: z.record(z.any()) // Stripe's dynamic object
  }),
  created: z.number(), // Unix timestamp
  livemode: z.boolean()
});

// Google Calendar webhook contract
const GoogleCalendarWebhookSchema = z.object({
  kind: z.literal('api#channel'),
  id: z.string().uuid(),
  resourceId: z.string(),
  resourceUri: z.string().url(),
  channelToken: z.string().optional(),
  expiration: z.string().datetime().optional()
});

export const webhookContract = c.router({
  stripeWebhook: {
    method: 'POST',
    path: '/webhooks/stripe',
    body: StripeWebhookSchema,
    responses: {
      200: z.object({ received: z.boolean() }),
      400: z.object({ error: z.string() })
    }
  },

  googleCalendarWebhook: {
    method: 'POST',
    path: '/webhooks/google-calendar',
    headers: z.object({
      'x-goog-channel-id': z.string(),
      'x-goog-resource-id': z.string(),
      'x-goog-resource-state': z.enum(['sync', 'exists', 'not_exists'])
    }),
    body: z.object({}).optional(), // Calendar webhooks have no body
    responses: {
      200: z.object({ processed: z.boolean() })
    }
  }
});
```

### 2.3 API Versioning Strategies

**Recommended for MAIS**: URL Path Versioning (current: `/v1`)

#### URL Path Versioning Pattern
```typescript
// packages/contracts/src/api.v1.ts
export const apiV1 = c.router({
  bookings: bookingContract,
  packages: packageContract,
  // ...
}, {
  pathPrefix: '/v1'
});

// packages/contracts/src/api.v2.ts (future)
export const apiV2 = c.router({
  bookings: bookingContractV2, // Updated schema
  packages: packageContractV2,
  // ...
}, {
  pathPrefix: '/v2'
});
```

#### Migration Strategy
```typescript
// Shared schema for backward compatibility
const BookingV1Schema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  status: z.enum(['pending', 'confirmed', 'cancelled'])
});

// V2 adds new fields but supports V1 responses
const BookingV2Schema = BookingV1Schema.extend({
  version: z.number(), // OCC support
  metadata: z.record(z.string()).optional(), // Extensibility
  cancelledBy: z.string().optional(),
  cancellationReason: z.string().optional()
});

// Transformation layer in service
function toV1Response(booking: BookingV2): BookingV1 {
  const { version, metadata, cancelledBy, cancellationReason, ...v1Fields } = booking;
  return v1Fields;
}
```

#### Deprecation Headers
```typescript
// Express middleware for deprecation warnings
function deprecationMiddleware(version: string, sunsetDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Link', '<https://docs.mais.com/api/migration-v2>; rel="deprecation"');
    res.setHeader('X-API-Warn', `API ${version} will be sunset on ${sunsetDate}`);
    next();
  };
}

// Apply to V1 routes
app.use('/v1', deprecationMiddleware('v1', 'Wed, 05 Mar 2026 00:00:00 GMT'));
```

**Best Practices**:
1. **Support window**: 12-18 months for old versions
2. **Communication**: Announce deprecation 6+ months in advance
3. **Monitoring**: Track version usage via analytics
4. **Migration guide**: Provide comprehensive documentation
5. **Gradual rollout**: Run multiple versions simultaneously

---

## 3. Express + TypeScript Multi-tenant Patterns

### 3.1 Request Context Propagation

**Current MAIS Pattern**: Tenant middleware injects `tenantId` into `req.tenantId`

#### Enhanced Context with AsyncLocalStorage
```typescript
import { AsyncLocalStorage } from 'async_hooks';

// Define request context
interface RequestContext {
  tenantId: string;
  userId?: string;
  requestId: string;
  correlationId: string;
  startTime: number;
}

// Create context storage
const requestContext = new AsyncLocalStorage<RequestContext>();

// Middleware to create context
export function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const context: RequestContext = {
    tenantId: req.tenantId, // From tenant middleware
    userId: res.locals.tenantAuth?.userId,
    requestId: uuidv4(),
    correlationId: req.headers['x-correlation-id'] as string || uuidv4(),
    startTime: Date.now()
  };

  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', context.correlationId);
  res.setHeader('X-Request-ID', context.requestId);

  // Run request in context
  requestContext.run(context, () => next());
}

// Helper to access context anywhere
export function getContext(): RequestContext {
  const context = requestContext.getStore();
  if (!context) {
    throw new Error('Request context not available');
  }
  return context;
}

// Usage in services (no need to pass tenantId explicitly)
class BookingService {
  async create(data: BookingData) {
    const { tenantId } = getContext(); // Automatically tenant-scoped
    return await prisma.booking.create({
      data: { ...data, tenantId }
    });
  }
}
```

**Benefits**:
- No need to pass `tenantId` to every service method
- Automatic correlation ID tracking
- Simplified service signatures
- Easier to add request metadata (user, IP, etc.)

**Caution**: Only use within request handlers. Background jobs need explicit context.

### 3.2 Tenant-Scoped Database Connections

**MAIS Current**: Single connection pool with `tenantId` filtering
**Alternative for Scale**: Connection pooling per tenant

#### Single Pool with Tenant Filtering (Current, Recommended)
```typescript
// ✅ MAIS current approach - simple and effective for most use cases
const prisma = new PrismaClient();

async function getBookings(tenantId: string) {
  return await prisma.booking.findMany({
    where: { tenantId } // Always filter by tenantId
  });
}
```

**Pros**:
- Simple connection management
- Works well for hundreds of tenants
- Lower memory footprint
- Easier to maintain

**Cons**:
- All tenants share connection pool
- No per-tenant connection limits
- Potential for one tenant to exhaust connections

#### Connection Per Tenant (For Large Scale)
```typescript
import { PrismaClient } from '@prisma/client';

// Connection cache with TTL
const tenantConnections = new Map<string, {
  client: PrismaClient;
  lastAccessed: number;
}>();

const CONNECTION_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CONNECTIONS = 100; // Limit per tenant

// Get or create tenant-scoped connection
function getTenantClient(tenantId: string): PrismaClient {
  const cached = tenantConnections.get(tenantId);

  if (cached) {
    cached.lastAccessed = Date.now();
    return cached.client;
  }

  // Create new connection with tenant-specific config
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    log: [
      { emit: 'event', level: 'query' }
    ]
  });

  // Add tenant ID to all queries via middleware
  client.$use(async (params, next) => {
    // Automatically inject tenantId into all queries
    if (params.args?.where) {
      params.args.where = { ...params.args.where, tenantId };
    }
    return next(params);
  });

  tenantConnections.set(tenantId, {
    client,
    lastAccessed: Date.now()
  });

  return client;
}

// Cleanup stale connections
setInterval(() => {
  const now = Date.now();
  for (const [tenantId, { client, lastAccessed }] of tenantConnections) {
    if (now - lastAccessed > CONNECTION_TTL) {
      client.$disconnect();
      tenantConnections.delete(tenantId);
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes
```

**When to use**: 1000+ tenants, per-tenant SLAs, or need connection isolation

### 3.3 Rate Limiting Per Tenant

#### Global Rate Limiting (Current MAIS)
```typescript
import rateLimit from 'express-rate-limit';

// Current: IP-based rate limiting
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP
  message: 'Too many signup attempts'
});
```

#### Tenant-Aware Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Per-tenant rate limiter
const tenantRateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:tenant:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: async (req) => {
    // Different limits per tenant tier
    const tenant = await getTenant(req.tenantId);
    switch (tenant.tier) {
      case 'enterprise': return 1000;
      case 'professional': return 500;
      case 'basic': return 100;
      default: return 50;
    }
  },
  keyGenerator: (req) => req.tenantId, // Rate limit by tenantId, not IP
  message: (req) => `Rate limit exceeded for tenant ${req.tenantId}`,
  skip: (req) => req.tenantId === 'internal' // Skip internal tools
});

// Apply to tenant-authenticated routes
app.use('/v1/tenant-admin', tenantMiddleware, tenantRateLimiter);
```

#### Endpoint-Specific Rate Limits
```typescript
// Stricter limits for resource-intensive operations
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 bookings per minute per tenant
  keyGenerator: (req) => `${req.tenantId}:bookings`
});

const webhookLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 100, // 100 webhook calls per 10 seconds
  keyGenerator: (req) => `${req.tenantId}:webhooks`,
  skipFailedRequests: true // Don't count failed requests
});

app.post('/v1/bookings', tenantMiddleware, bookingLimiter, createBooking);
app.post('/v1/webhooks/stripe', webhookLimiter, handleStripeWebhook);
```

### 3.4 Audit Logging Patterns

#### Audit Log Schema
```prisma
model AuditLog {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String?
  action        String   // 'booking.created', 'package.updated'
  resourceType  String   // 'Booking', 'Package'
  resourceId    String
  changes       Json?    // Before/after state
  metadata      Json?    // Request context
  ipAddress     String?
  userAgent     String?
  correlationId String?
  createdAt     DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([tenantId, resourceType, resourceId])
  @@index([correlationId])
}
```

#### Audit Middleware
```typescript
import { AuditLog } from '@prisma/client';

// Audit logger
class AuditLogger {
  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    changes?: { before: any; after: any };
    req: Request;
  }) {
    const { tenantId, userId, action, resourceType, resourceId, changes, req } = params;
    const context = getContext();

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        changes: changes ? JSON.stringify(changes) : null,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: context.correlationId
      }
    });
  }
}

export const auditLogger = new AuditLogger();

// Usage in services
async function updateBooking(id: string, tenantId: string, updates: BookingUpdate, req: Request) {
  const before = await prisma.booking.findUnique({
    where: { id, tenantId }
  });

  const after = await prisma.booking.update({
    where: { id, tenantId },
    data: updates
  });

  await auditLogger.log({
    tenantId,
    userId: res.locals.tenantAuth?.userId,
    action: 'booking.updated',
    resourceType: 'Booking',
    resourceId: id,
    changes: { before, after },
    req
  });

  return after;
}
```

#### Audit Log Querying
```typescript
// Get audit trail for a resource
async function getResourceAuditTrail(
  tenantId: string,
  resourceType: string,
  resourceId: string
) {
  return await prisma.auditLog.findMany({
    where: {
      tenantId,
      resourceType,
      resourceId
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
}

// Get tenant activity summary
async function getTenantActivity(
  tenantId: string,
  startDate: Date,
  endDate: Date
) {
  return await prisma.auditLog.groupBy({
    by: ['action'],
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true,
    orderBy: {
      _count: {
        action: 'desc'
      }
    }
  });
}
```

**Best Practices**:
1. **Async logging**: Use background jobs for writes
2. **Partitioning**: Use PostgreSQL partitioning for large datasets
3. **Retention**: Archive old logs after 90 days
4. **Correlation IDs**: Track requests across services
5. **Sensitive data**: Hash PII, avoid logging passwords/tokens

---

## 4. React + TanStack Query for Real-time UIs

### 4.1 Optimistic Updates for Booking Forms

#### UI-Level Optimistic Updates (Simple)
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function BookingForm() {
  const queryClient = useQueryClient();

  const createBookingMutation = useMutation({
    mutationFn: (booking: BookingRequest) =>
      apiClient.bookings.createBooking({ body: booking }),

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  });

  const { isPending, variables } = createBookingMutation;

  return (
    <div>
      {/* Show pending booking with reduced opacity */}
      {isPending && variables && (
        <div className="opacity-50 animate-pulse">
          <BookingCard booking={variables} pending />
        </div>
      )}

      <form onSubmit={(e) => {
        e.preventDefault();
        createBookingMutation.mutate(formData);
      }}>
        {/* Form fields */}
      </form>
    </div>
  );
}
```

**When to use**: Single display location (e.g., confirmation screen)

#### Cache-Level Optimistic Updates (Multi-Location)
```typescript
function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (booking: BookingRequest) =>
      apiClient.bookings.createBooking({ body: booking }),

    // Optimistically update cache
    onMutate: async (newBooking) => {
      // Cancel outgoing refetches (prevent overwrite)
      await queryClient.cancelQueries({ queryKey: ['bookings'] });

      // Snapshot previous value for rollback
      const previousBookings = queryClient.getQueryData<Booking[]>(['bookings']);

      // Optimistically update cache
      queryClient.setQueryData<Booking[]>(['bookings'], (old = []) => [
        ...old,
        {
          id: 'temp-' + Date.now(),
          ...newBooking,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ]);

      // Return context for rollback
      return { previousBookings };
    },

    // Rollback on error
    onError: (err, newBooking, context) => {
      if (context?.previousBookings) {
        queryClient.setQueryData(['bookings'], context.previousBookings);
      }

      // Show error toast
      toast.error('Failed to create booking: ' + err.message);
    },

    // Always refetch to sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  });
}
```

**When to use**: Multiple UI locations showing bookings (dashboard + modal + notifications)

#### Tracking Multiple Mutations
```typescript
import { useMutationState } from '@tanstack/react-query';

function BookingDashboard() {
  // Track all pending booking mutations
  const pendingBookings = useMutationState({
    filters: {
      mutationKey: ['bookings', 'create'],
      status: 'pending'
    },
    select: (mutation) => mutation.state.variables
  });

  return (
    <div>
      {/* Show all pending bookings */}
      {pendingBookings.map((booking, i) => (
        <BookingCard key={i} booking={booking} pending />
      ))}

      {/* Show confirmed bookings */}
      <BookingList />
    </div>
  );
}
```

### 4.2 Real-time Availability Polling

#### Basic Polling with refetchInterval
```typescript
function useAvailability(date: string) {
  return useQuery({
    queryKey: ['availability', date],
    queryFn: () => apiClient.bookings.getAvailableSlots({ query: { date } }),

    // Poll every 30 seconds
    refetchInterval: 30 * 1000,

    // Stop polling when window loses focus
    refetchIntervalInBackground: false,

    // Refetch when window regains focus
    refetchOnWindowFocus: true,

    // Keep showing stale data while refetching
    staleTime: 0
  });
}
```

#### Dynamic Polling Based on Activity
```typescript
function useSmartAvailabilityPolling(date: string) {
  const [userActive, setUserActive] = useState(true);

  useEffect(() => {
    // Track user activity
    const handleActivity = () => {
      setUserActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setUserActive(false), 5 * 60 * 1000); // 5 min
    };

    let timer: NodeJS.Timeout;
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timer);
    };
  }, []);

  return useQuery({
    queryKey: ['availability', date],
    queryFn: () => apiClient.bookings.getAvailableSlots({ query: { date } }),

    // Poll faster when user is active
    refetchInterval: userActive ? 10 * 1000 : 60 * 1000, // 10s vs 60s

    // Continue polling in background for dashboards
    refetchIntervalInBackground: true,

    staleTime: 0
  });
}
```

#### Conditional Polling
```typescript
function useConditionalPolling(date: string) {
  const { data } = useQuery({
    queryKey: ['availability', date],
    queryFn: async () => {
      const result = await apiClient.bookings.getAvailableSlots({ query: { date } });

      // Stop polling if date is fully booked
      if (result.body.availableSlots === 0) {
        queryClient.setQueryDefaults(['availability', date], {
          refetchInterval: false
        });
      }

      return result;
    },

    // Initial polling interval
    refetchInterval: (data) => {
      // Stop polling if no slots available
      if (data?.body?.availableSlots === 0) {
        return false;
      }

      // Poll faster when slots are limited
      if (data?.body?.availableSlots < 3) {
        return 5 * 1000; // 5 seconds
      }

      return 30 * 1000; // 30 seconds
    }
  });

  return data;
}
```

**Best Practices**:
- Use `refetchInterval` for real-time updates
- Set `refetchIntervalInBackground: false` for most cases (saves resources)
- Use `staleTime: 0` to always show fresh data
- Implement exponential backoff on errors
- Stop polling when data becomes static (e.g., past dates)

### 4.3 Calendar Component Libraries

#### Recommended: react-big-calendar

**Why react-big-calendar**:
- Free and open-source (MIT license)
- React-only, optimized for React ecosystem
- Good for event management and scheduling interfaces
- Lightweight compared to FullCalendar (no 250kb bundle)
- 8,500+ GitHub stars, 500k+ weekly downloads

**When to avoid**:
- Need drag-and-drop (requires manual implementation)
- Need resource views (FullCalendar Premium has better support)
- Need extensive built-in editing features

#### Installation
```bash
npm install react-big-calendar moment
# Or use date-fns, dayjs, or globalize as localizer
```

#### Basic Integration with TanStack Query
```typescript
import { Calendar, momentLocalizer, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

interface BookingEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: {
    packageId: string;
    clientName: string;
    status: 'pending' | 'confirmed' | 'cancelled';
  };
}

function BookingCalendar() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'calendar'],
    queryFn: async () => {
      const result = await apiClient.bookings.getBookings();
      return result.body;
    }
  });

  // Transform bookings to calendar events
  const events: BookingEvent[] = useMemo(() => {
    return bookings?.map(booking => ({
      id: booking.id,
      title: `${booking.packageName} - ${booking.clientName}`,
      start: new Date(booking.startTime),
      end: new Date(booking.endTime),
      resource: {
        packageId: booking.packageId,
        clientName: booking.clientName,
        status: booking.status
      }
    })) || [];
  }, [bookings]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: BookingEvent) => {
    // Show booking details modal
    showBookingModal(event.id);
  }, []);

  // Handle slot selection (create new booking)
  const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date }) => {
    // Check availability first
    checkAvailability(slotInfo.start, slotInfo.end).then(available => {
      if (available) {
        showCreateBookingModal(slotInfo);
      } else {
        toast.error('This time slot is not available');
      }
    });
  }, []);

  // Custom event styling
  const eventStyleGetter = useCallback((event: BookingEvent) => {
    const style = {
      backgroundColor: event.resource?.status === 'confirmed' ? '#10b981' : '#6b7280',
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    return { style };
  }, []);

  if (isLoading) return <CalendarSkeleton />;

  return (
    <div style={{ height: '700px' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        selectable
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day', 'agenda']}
        defaultView="week"
        step={30} // 30-minute intervals
        timeslots={2} // 2 slots per step (15-minute grid)
      />
    </div>
  );
}
```

#### FullCalendar Alternative (Premium Features)

**When to use FullCalendar**:
- Need drag-and-drop out of the box
- Resource scheduling (multiple calendars side-by-side)
- Timeline views
- Budget allows for Premium license ($395/year)

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

```typescript
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

function FullCalendarBooking() {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      editable={true}
      selectable={true}
      events={events}
      eventDrop={handleEventDrop}
      eventResize={handleEventResize}
      select={handleDateSelect}
    />
  );
}
```

**Cost comparison**: react-big-calendar (free) vs FullCalendar Premium ($395/year). Hidden cost: react-big-calendar requires more custom development time.

---

## 5. Stripe Connect Multi-tenant Patterns

### 5.1 Account Types and Charge Patterns

#### Direct Charges (Recommended for MAIS)

**Use case**: SaaS platforms where customers transact directly with connected accounts (clubs/businesses).

**Characteristics**:
- Payment appears on connected account, not platform
- Connected account's balance increases
- Platform collects application fees
- Customers often unaware of platform

**Implementation**:
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create direct charge on connected account
async function createDirectCharge(
  tenantId: string,
  connectedAccountId: string,
  amount: number,
  paymentMethodId: string
) {
  // Create PaymentIntent on connected account
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    application_fee_amount: Math.floor(amount * 0.05), // 5% platform fee

    // Optional: Description for customer statement
    statement_descriptor: 'MAIS Booking',

    // Optional: Metadata for tracking
    metadata: {
      tenantId,
      bookingId: 'booking_123'
    }
  }, {
    stripeAccount: connectedAccountId // Route to connected account
  });

  return paymentIntent;
}
```

**Fee Structure**:
- Connected account pays standard Stripe fees (2.9% + $0.30)
- Platform receives application fee (e.g., 5% of transaction)
- Platform can optionally pay Stripe fees for connected accounts

#### Platform Fee Configuration
```typescript
// Platform pays Stripe fees for connected account
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100.00
  currency: 'usd',
  application_fee_amount: 500, // $5.00 platform fee
  on_behalf_of: connectedAccountId, // Optional: Platform pays fees
}, {
  stripeAccount: connectedAccountId
});
```

### 5.2 Connected Account Onboarding

#### Stripe-Hosted Onboarding (Recommended)

**Best for**: Quick integration, automatic requirement updates

```typescript
// Create connected account
async function createConnectedAccount(tenantId: string, email: string) {
  const account = await stripe.accounts.create({
    type: 'express', // or 'standard', 'custom'
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    business_type: 'individual', // or 'company'
    metadata: {
      tenantId
    }
  });

  // Store in database
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending'
    }
  });

  return account;
}

// Generate onboarding link
async function createAccountLink(
  stripeAccountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });

  return accountLink.url; // Redirect user here
}

// Check onboarding status
async function checkAccountStatus(stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId);

  return {
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirementsDue: account.requirements?.currently_due || [],
    requirementsEventuallyDue: account.requirements?.eventually_due || [],
    disabled: account.requirements?.disabled_reason
  };
}
```

#### Webhook Handling for Account Updates
```typescript
import { Request, Response } from 'express';

// Handle account.updated webhook
async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  // Update tenant record
  await prisma.tenant.update({
    where: { stripeAccountId: account.id },
    data: {
      stripeAccountStatus: account.charges_enabled ? 'active' : 'pending',
      stripeAccountDetails: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsDue: account.requirements?.currently_due,
        disabledReason: account.requirements?.disabled_reason
      }
    }
  });

  // Notify tenant if action required
  if (account.requirements?.currently_due?.length > 0) {
    await sendEmail({
      to: account.email,
      subject: 'Action Required: Complete Stripe Verification',
      body: `Please complete the following requirements: ${account.requirements.currently_due.join(', ')}`
    });
  }
}

// Webhook endpoint with signature verification
async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle event types
  switch (event.type) {
    case 'account.updated':
      await handleAccountUpdated(event);
      break;
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event);
      break;
  }

  res.json({ received: true });
}
```

### 5.3 Payment Method Cloning

**Use case**: Save customer payment method on platform, use across multiple connected accounts

```typescript
// Save payment method on platform
async function savePaymentMethod(
  customerId: string,
  paymentMethodId: string
) {
  // Attach to platform customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId
  });

  return paymentMethodId;
}

// Clone to connected account
async function clonePaymentMethod(
  paymentMethodId: string,
  connectedAccountId: string
) {
  const clonedPaymentMethod = await stripe.paymentMethods.create({
    payment_method: paymentMethodId // Reference to platform payment method
  }, {
    stripeAccount: connectedAccountId
  });

  return clonedPaymentMethod.id;
}

// Create charge with cloned payment method
async function chargeConnectedAccount(
  connectedAccountId: string,
  platformPaymentMethodId: string,
  amount: number
) {
  // Clone payment method to connected account
  const clonedPM = await clonePaymentMethod(platformPaymentMethodId, connectedAccountId);

  // Create PaymentIntent on connected account
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method: clonedPM,
    confirm: true,
    application_fee_amount: Math.floor(amount * 0.05)
  }, {
    stripeAccount: connectedAccountId
  });

  return paymentIntent;
}
```

**Limitations**:
- Only works for `card` and `us_bank_account` types
- Cannot clone between connected accounts (only platform → connected)
- Cloned payment methods are independent (not synced)

### 5.4 Refunds and Disputes

```typescript
// Refund direct charge (application fee returned by default)
async function refundDirectCharge(
  chargeId: string,
  connectedAccountId: string,
  amount?: number
) {
  const refund = await stripe.refunds.create({
    charge: chargeId,
    amount, // Optional: partial refund
    reverse_transfer: false, // Don't reverse application fee
    refund_application_fee: true // Refund application fee
  }, {
    stripeAccount: connectedAccountId
  });

  return refund;
}

// Handle dispute webhook
async function handleDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;

  // Notify connected account (tenant)
  const charge = await stripe.charges.retrieve(
    dispute.charge as string,
    { stripeAccount: dispute.account as string }
  );

  const tenantId = charge.metadata.tenantId;

  await sendDisputeNotification(tenantId, {
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
    evidence_due_by: dispute.evidence_details?.due_by
  });
}
```

---

## 6. Google Calendar API with TypeScript

### 6.1 Authentication Patterns

#### Service Account (Recommended for Server-Side)

**Setup**: Create service account in Google Cloud Console

```typescript
import { google } from 'googleapis';

// Initialize with service account key
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]
});

// Get auth client
const authClient = await auth.getClient();

// Create calendar client
const calendar = google.calendar({ version: 'v3', auth: authClient });
```

#### JWT Client Pattern
```typescript
const { google } = require('googleapis');

const jwtClient = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/calendar']
);

// Authorize
await jwtClient.authorize();

const calendar = google.calendar({ version: 'v3', auth: jwtClient });
```

**Environment Variables**:
```bash
GOOGLE_CLIENT_EMAIL=service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=primary # or specific calendar ID
```

### 6.2 CRUD Operations

#### Create Event
```typescript
async function createCalendarEvent(booking: Booking) {
  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `${booking.packageName} - ${booking.clientName}`,
      description: booking.notes,
      start: {
        dateTime: booking.startTime.toISOString(),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: booking.endTime.toISOString(),
        timeZone: 'America/New_York'
      },
      attendees: [
        { email: booking.clientEmail }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }
        ]
      },
      // Store booking ID for synchronization
      extendedProperties: {
        private: {
          bookingId: booking.id,
          tenantId: booking.tenantId
        }
      }
    }
  });

  return event.data;
}
```

#### List Events
```typescript
async function listEvents(startDate: Date, endDate: Date) {
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true, // Expand recurring events
    orderBy: 'startTime',
    maxResults: 100
  });

  return response.data.items || [];
}
```

#### Update Event
```typescript
async function updateCalendarEvent(eventId: string, updates: Partial<Booking>) {
  const event = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: updates.packageName ? `${updates.packageName} - ${updates.clientName}` : undefined,
      start: updates.startTime ? {
        dateTime: updates.startTime.toISOString(),
        timeZone: 'America/New_York'
      } : undefined,
      end: updates.endTime ? {
        dateTime: updates.endTime.toISOString(),
        timeZone: 'America/New_York'
      } : undefined
    }
  });

  return event.data;
}
```

#### Delete Event
```typescript
async function deleteCalendarEvent(eventId: string) {
  await calendar.events.delete({
    calendarId: 'primary',
    eventId
  });
}
```

### 6.3 Watch/Push Notifications (Webhooks)

**Setup**: Register webhook endpoint to receive calendar change notifications

```typescript
import { v4 as uuidv4 } from 'uuid';

// Create watch channel
async function watchCalendar(webhookUrl: string, calendarId: string = 'primary') {
  const channelId = uuidv4();
  const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId, // Unique channel ID
      type: 'web_hook',
      address: webhookUrl, // Must be HTTPS
      expiration: expiration.toString()
    }
  });

  // Store channel info for renewal/stopping
  await prisma.calendarWatchChannel.create({
    data: {
      channelId,
      resourceId: response.data.resourceId!,
      calendarId,
      expiration: new Date(expiration)
    }
  });

  return response.data;
}

// Handle webhook notifications
async function handleCalendarWebhook(req: Request, res: Response) {
  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceId = req.headers['x-goog-resource-id'] as string;
  const resourceState = req.headers['x-goog-resource-state'] as string;

  // Acknowledge sync message
  if (resourceState === 'sync') {
    return res.status(200).send('OK');
  }

  // Handle calendar changes
  if (resourceState === 'exists') {
    // Fetch updated events
    const channel = await prisma.calendarWatchChannel.findUnique({
      where: { channelId }
    });

    if (channel) {
      await syncCalendarEvents(channel.calendarId);
    }
  }

  res.status(200).send('OK');
}

// Sync events after change notification
async function syncCalendarEvents(calendarId: string) {
  const events = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 100,
    singleEvents: true
  });

  // Update local database with changes
  for (const event of events.data.items || []) {
    const bookingId = event.extendedProperties?.private?.bookingId;
    if (bookingId) {
      await updateBookingFromCalendar(bookingId, event);
    }
  }
}

// Stop watching calendar
async function stopWatchingCalendar(channelId: string, resourceId: string) {
  await calendar.channels.stop({
    requestBody: {
      id: channelId,
      resourceId
    }
  });

  await prisma.calendarWatchChannel.delete({
    where: { channelId }
  });
}
```

**Best Practices**:
- Webhook URL must be HTTPS with valid SSL certificate
- Acknowledge all webhook requests with 200 status
- Renew watch channels before they expire (7-day max)
- Handle sync message on initial watch creation
- Use `extendedProperties` to link calendar events to bookings

### 6.4 Batch Requests

**Optimization**: Reduce API calls by batching operations

```typescript
// Not directly supported in googleapis client
// Use HTTP API directly for batch requests

import axios from 'axios';

async function batchCreateEvents(bookings: Booking[], accessToken: string) {
  const boundary = 'batch_boundary';

  const batchBody = bookings.map((booking, i) => `
--${boundary}
Content-Type: application/http
Content-ID: <item${i}>

POST /calendar/v3/calendars/primary/events
Content-Type: application/json

${JSON.stringify({
  summary: `${booking.packageName} - ${booking.clientName}`,
  start: { dateTime: booking.startTime.toISOString() },
  end: { dateTime: booking.endTime.toISOString() }
})}
  `.trim()).join('\n') + `\n--${boundary}--`;

  const response = await axios.post(
    'https://www.googleapis.com/batch/calendar/v3',
    batchBody,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/mixed; boundary=${boundary}`
      }
    }
  );

  return response.data;
}
```

---

## 7. Testing Strategies for Scheduling Systems

### 7.1 Time Mocking with Vitest

#### Basic Time Mocking
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Booking Service', () => {
  beforeEach(() => {
    // Enable fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it('should not allow bookings in the past', async () => {
    // Set system time to specific date
    const now = new Date('2025-11-27T10:00:00Z');
    vi.setSystemTime(now);

    const pastDate = new Date('2025-11-26T10:00:00Z');

    await expect(
      bookingService.create({
        tenantId: 'test',
        date: pastDate,
        startTime: pastDate,
        endTime: new Date('2025-11-26T11:00:00Z')
      })
    ).rejects.toThrow('Booking date must be in the future');
  });

  it('should allow bookings within business hours', async () => {
    // Set time to 10 AM on a weekday
    vi.setSystemTime(new Date('2025-11-27T10:00:00Z'));

    const booking = await bookingService.create({
      tenantId: 'test',
      date: new Date('2025-11-28T14:00:00Z'), // Next day at 2 PM
      startTime: new Date('2025-11-28T14:00:00Z'),
      endTime: new Date('2025-11-28T15:00:00Z')
    });

    expect(booking).toBeDefined();
    expect(booking.status).toBe('confirmed');
  });

  it('should advance time with timers', async () => {
    const callback = vi.fn();

    // Schedule callback for 1 hour
    setTimeout(callback, 60 * 60 * 1000);

    // Advance time by 1 hour
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

#### Testing Expiration Logic
```typescript
describe('Booking Expiration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should expire pending bookings after 15 minutes', async () => {
    const now = new Date('2025-11-27T10:00:00Z');
    vi.setSystemTime(now);

    // Create pending booking
    const booking = await bookingService.create({
      tenantId: 'test',
      date: new Date('2025-11-28T14:00:00Z'),
      status: 'pending'
    });

    expect(booking.status).toBe('pending');

    // Advance time by 15 minutes
    vi.setSystemTime(new Date('2025-11-27T10:15:00Z'));

    // Run expiration job
    await bookingService.expirePendingBookings();

    // Verify booking is expired
    const updated = await bookingService.getById('test', booking.id);
    expect(updated.status).toBe('expired');
  });
});
```

### 7.2 Testing Race Conditions

#### Concurrent Booking Simulation
```typescript
import { describe, it, expect } from 'vitest';

describe('Double-Booking Prevention', () => {
  it('should prevent double-booking with concurrent requests', async () => {
    const date = new Date('2025-11-28T14:00:00Z');

    // Simulate 10 concurrent booking attempts for same slot
    const bookingPromises = Array.from({ length: 10 }, (_, i) =>
      bookingService.create({
        tenantId: 'test',
        clientName: `Client ${i}`,
        date,
        startTime: date,
        endTime: new Date('2025-11-28T15:00:00Z')
      }).catch(err => err) // Catch errors to count failures
    );

    const results = await Promise.all(bookingPromises);

    // Only one should succeed
    const successes = results.filter(r => !(r instanceof Error));
    const failures = results.filter(r => r instanceof Error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);
    expect(failures[0].message).toContain('already booked');
  });

  it('should handle optimistic lock conflicts', async () => {
    // Create booking
    const booking = await bookingService.create({
      tenantId: 'test',
      date: new Date('2025-11-28T14:00:00Z')
    });

    // Simulate two concurrent updates
    const update1 = bookingService.update(
      booking.id,
      'test',
      { clientName: 'Client A' },
      booking.version // Expected version
    );

    const update2 = bookingService.update(
      booking.id,
      'test',
      { clientName: 'Client B' },
      booking.version // Same expected version
    );

    const results = await Promise.allSettled([update1, update2]);

    // One should succeed, one should fail
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });
});
```

#### Property-Based Testing with fast-check
```typescript
import { test } from 'vitest';
import * as fc from 'fast-check';

test('booking date ranges should never overlap', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Generate random bookings
      fc.array(
        fc.record({
          startTime: fc.date({ min: new Date('2025-01-01') }),
          duration: fc.integer({ min: 15, max: 480 }) // 15 min to 8 hours
        }),
        { minLength: 2, maxLength: 10 }
      ),
      async (bookingRequests) => {
        const tenantId = 'test-' + Math.random();

        // Attempt to create all bookings
        const results = await Promise.allSettled(
          bookingRequests.map(req =>
            bookingService.create({
              tenantId,
              date: req.startTime,
              startTime: req.startTime,
              endTime: new Date(req.startTime.getTime() + req.duration * 60000)
            })
          )
        );

        // Get successful bookings
        const bookings = results
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<any>).value);

        // Verify no overlaps
        for (let i = 0; i < bookings.length; i++) {
          for (let j = i + 1; j < bookings.length; j++) {
            const a = bookings[i];
            const b = bookings[j];

            const aStart = new Date(a.startTime).getTime();
            const aEnd = new Date(a.endTime).getTime();
            const bStart = new Date(b.startTime).getTime();
            const bEnd = new Date(b.endTime).getTime();

            // Assert no overlap
            expect(
              aEnd <= bStart || bEnd <= aStart
            ).toBe(true);
          }
        }
      }
    ),
    { numRuns: 100 } // Run 100 random test cases
  );
});
```

### 7.3 E2E Testing with Playwright

#### Booking Flow Test
```typescript
import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as tenant
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/tenant/dashboard');
  });

  test('should create booking successfully', async ({ page }) => {
    // Navigate to bookings
    await page.goto('/tenant/bookings');

    // Click "New Booking" button
    await page.click('button:has-text("New Booking")');

    // Fill booking form
    await page.fill('input[name="clientName"]', 'John Doe');
    await page.fill('input[name="clientEmail"]', 'john@example.com');

    // Select date (2 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    await page.fill('input[name="date"]', futureDate.toISOString().split('T')[0]);

    // Select time slot
    await page.selectOption('select[name="startTime"]', '14:00');

    // Select package
    await page.selectOption('select[name="packageId"]', { label: 'Premium Package' });

    // Submit form
    await page.click('button:has-text("Create Booking")');

    // Wait for success message
    await expect(page.locator('.toast-success')).toContainText('Booking created successfully');

    // Verify booking appears in list
    await expect(page.locator('table tbody tr')).toContainText('John Doe');
    await expect(page.locator('table tbody tr')).toContainText('Premium Package');
  });

  test('should show error for conflicting booking', async ({ page }) => {
    // Create initial booking
    await createBooking(page, {
      date: '2025-11-28',
      startTime: '14:00',
      clientName: 'Client 1'
    });

    // Attempt to create conflicting booking
    await page.click('button:has-text("New Booking")');
    await page.fill('input[name="clientName"]', 'Client 2');
    await page.fill('input[name="date"]', '2025-11-28');
    await page.selectOption('select[name="startTime"]', '14:00'); // Same time
    await page.click('button:has-text("Create Booking")');

    // Verify error message
    await expect(page.locator('.toast-error')).toContainText('Time slot already booked');
  });

  test('should update booking optimistically', async ({ page }) => {
    // Navigate to bookings
    await page.goto('/tenant/bookings');

    // Click edit on first booking
    await page.click('table tbody tr:first-child button:has-text("Edit")');

    // Update client name
    await page.fill('input[name="clientName"]', 'Updated Name');

    // Submit
    await page.click('button:has-text("Save")');

    // Verify optimistic update (should show immediately)
    await expect(page.locator('table tbody tr:first-child')).toContainText('Updated Name');

    // Wait for confirmation
    await expect(page.locator('.toast-success')).toContainText('Booking updated');
  });
});

// Helper function
async function createBooking(page, data) {
  await page.goto('/tenant/bookings');
  await page.click('button:has-text("New Booking")');
  await page.fill('input[name="clientName"]', data.clientName);
  await page.fill('input[name="date"]', data.date);
  await page.selectOption('select[name="startTime"]', data.startTime);
  await page.click('button:has-text("Create Booking")');
  await page.waitForSelector('.toast-success');
}
```

#### Calendar Integration Test
```typescript
test('should sync booking with Google Calendar', async ({ page }) => {
  // Mock Google Calendar API
  await page.route('https://www.googleapis.com/calendar/v3/**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: 'calendar-event-123',
          summary: 'Test Booking',
          start: { dateTime: '2025-11-28T14:00:00Z' },
          end: { dateTime: '2025-11-28T15:00:00Z' }
        })
      });
    }
  });

  // Create booking
  await createBooking(page, {
    date: '2025-11-28',
    startTime: '14:00',
    clientName: 'John Doe'
  });

  // Verify calendar sync indicator
  await expect(page.locator('.calendar-synced-icon')).toBeVisible();
});
```

---

## 8. NPM Packages Summary

### Core Dependencies

#### Database & ORM
```json
{
  "prisma": "^6.0.0",
  "@prisma/client": "^6.0.0",
  "prisma-extension-soft-delete": "^1.0.0"
}
```

#### API & Validation
```json
{
  "@ts-rest/core": "^3.53.0",
  "@ts-rest/express": "^3.53.0",
  "zod": "^3.24.0",
  "express": "^4.21.0",
  "@types/express": "^4.17.21"
}
```

#### Frontend State Management
```json
{
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-query-devtools": "^5.0.0"
}
```

#### Calendar Components
```json
{
  "react-big-calendar": "^1.15.0",
  "moment": "^2.30.0",
  // Or alternative localizers:
  "date-fns": "^3.0.0",
  "dayjs": "^1.11.0"
}
```

```json
{
  // FullCalendar alternative (Premium)
  "@fullcalendar/react": "^6.1.0",
  "@fullcalendar/daygrid": "^6.1.0",
  "@fullcalendar/timegrid": "^6.1.0",
  "@fullcalendar/interaction": "^6.1.0"
}
```

#### Payment Processing
```json
{
  "stripe": "^17.0.0"
}
```

#### Google Calendar Integration
```json
{
  "googleapis": "^144.0.0"
}
```

#### Testing
```json
{
  "vitest": "^2.0.0",
  "@vitest/ui": "^2.0.0",
  "fast-check": "^3.24.0",
  "@playwright/test": "^1.48.0"
}
```

#### Multi-tenant Utilities
```json
{
  "express-rate-limit": "^7.0.0",
  "rate-limit-redis": "^4.0.0",
  "ioredis": "^5.4.0",
  "uuid": "^11.0.0",
  "@types/uuid": "^10.0.0"
}
```

#### Logging & Monitoring
```json
{
  "winston": "^3.17.0",
  "pino": "^9.5.0",
  "morgan": "^1.10.0"
}
```

### Version Compatibility Matrix

| Package | Prisma 6 | Node 20 | TypeScript 5.9 | Notes |
|---------|----------|---------|----------------|-------|
| @ts-rest/core | ✅ 3.53.0+ | ✅ | ✅ | Zod 4 support in RC |
| @tanstack/react-query | ✅ 5.0+ | ✅ | ✅ | React 18+ required |
| googleapis | ✅ | ✅ | ✅ | Built-in TypeScript types |
| stripe | ✅ 17.0+ | ✅ | ✅ | API version 2025-01-27 |
| vitest | ✅ 2.0+ | ✅ | ✅ | Native ESM support |

---

## Sources

### Prisma & Database
- [Optimistic Concurrency Control · Issue #4988 · prisma/prisma](https://github.com/prisma/prisma/issues/4988)
- [Transactions and batch queries (Reference) | Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [How To Build a High-Concurrency Ticket Booking System With Prisma](https://dev.to/zenstack/how-to-build-a-high-concurrency-ticket-booking-system-with-prisma-184n)
- [Managing Data Integrity in Node.js Apps with Prisma](https://blog.yarsalabs.com/concurrent-updates-managing-data-integrity-in-node-js-apps-with-prisma/)
- [Boosting Query Performance in Prisma ORM: The Impact of Indexing on Large Datasets](https://medium.com/@manojbicte/boosting-query-performance-in-prisma-orm-the-impact-of-indexing-on-large-datasets-a55b1972ca72)
- [Indexes | Prisma Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)
- [Middleware sample: soft delete (Reference) | Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware/soft-delete-middleware)
- [Implementing Soft Deletion in Prisma with Client Extensions](https://matranga.dev/true-soft-deletion-in-prisma-orm/)

### ts-rest & API Contracts
- [Ts-Rest](https://ts-rest.com/)
- [REST API Validation Using Zod](https://jeffsegovia.dev/blogs/rest-api-validation-using-zod)
- [Defining schemas | Zod](https://zod.dev/api)
- [REST API Versioning Strategies: Best Practices and Implementation Guide [2024]](https://jsschools.com/web_dev/rest-api-versioning-strategies-best-practices-and/)
- [Versioning REST API: Guide to Strategies & Best Practices 2025](https://www.devzery.com/post/versioning-rest-api-strategies-best-practices-2025)

### Multi-tenant Architecture
- [Designing Multi-Tenant SaaS Systems with Node.js](https://medium.com/@aliaftabk/designing-multi-tenant-saas-systems-with-node-js-4a12688dba27)
- [Schema-based multitenancy with NestJS, TypeORM and PostgresSQL](https://thomasvds.com/schema-based-multitenancy-with-nest-js-type-orm-and-postgres-sql/)
- [Building a Comprehensive Audit System in NestJS (and Express.JS)](https://medium.com/@usottah/building-a-comprehensive-audit-system-in-nestjs-and-express-js-b34af8588f58)

### TanStack Query & React
- [Optimistic Updates | TanStack Query React Docs](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [React TanStack Query Optimistic Updates Ui Example](https://tanstack.com/query/v5/docs/framework/react/examples/optimistic-updates-ui)
- [TanStack Query : Mastering Polling](https://medium.com/@soodakriti45/tanstack-query-mastering-polling-ee11dc3625cb)
- [React TanStack Query Auto Refetching Example](https://tanstack.com/query/latest/docs/framework/react/examples/auto-refetching)
- [TanStack DB Enters Beta with Reactive Queries, Optimistic Mutations, and Local-First Sync](https://www.infoq.com/news/2025/08/tanstack-db-beta/)

### Calendar Libraries
- [React FullCalendar vs Big Calendar - Bryntum](https://bryntum.com/blog/react-fullcalendar-vs-big-calendar/)
- [React calendar components: 6 best libraries for 2025](https://www.builder.io/blog/best-react-calendar-component-ai)
- [GitHub - jquense/react-big-calendar](https://github.com/jquense/react-big-calendar)

### Stripe Connect
- [Create direct charges | Stripe Documentation](https://docs.stripe.com/connect/direct-charges)
- [Share payment methods across multiple accounts for direct charges | Stripe Documentation](https://docs.stripe.com/connect/direct-charges-multiple-accounts)
- [Choose your onboarding configuration | Stripe Documentation](https://docs.stripe.com/connect/onboarding)
- [Account onboarding | Stripe Documentation](https://docs.stripe.com/connect/supported-embedded-components/account-onboarding)

### Google Calendar API
- [googleapis - npm](https://www.npmjs.com/package/googleapis)
- [GitHub - googleapis/google-api-nodejs-client](https://github.com/googleapis/google-api-nodejs-client)
- [Accessing Google Calendar API with Service Account](https://medium.com/product-monday/accessing-google-calendar-api-with-service-account-a99aa0f7f743)
- [Push notifications | Google Calendar | Google for Developers](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google Calendar Webhooks with Node.js • Stateful](https://stateful.com/blog/google-calendar-webhooks)

### Testing
- [Mocking | Guide | Vitest](https://vitest.dev/guide/mocking)
- [Vitest Mocking Time](https://www.thecandidstartup.org/2024/04/02/vitest-mocking-time.html)
- [Beyond flaky tests — Bringing Controlled Randomness to Vitest](https://fast-check.dev/blog/2025/03/28/beyond-flaky-tests-bringing-controlled-randomness-to-vitest/)
- [Mastering Time-Related Unit Tests with "vitest"](https://gabrielyotoo.medium.com/mastering-time-related-unit-tests-with-vitest-76cecec631ba)

---

## Implementation Roadmap for MAIS

Based on current MAIS architecture and this research, here are recommended priorities:

### Phase 1: Foundation (Current)
- ✅ Multi-tenant data isolation with `tenantId` filtering
- ✅ Optimistic concurrency control (version field)
- ✅ Pessimistic locking for booking creation
- ✅ ts-rest + Zod contracts with date validation
- ✅ TanStack Query for client state management

### Phase 2: Calendar Integration
1. Implement Google Calendar sync
   - Service account authentication
   - CRUD operations for bookings
   - Watch/push notifications for real-time sync
2. Add calendar UI component
   - Evaluate react-big-calendar (free) vs FullCalendar (premium)
   - Implement with TanStack Query for optimistic updates

### Phase 3: Enhanced Real-time Features
1. Smart polling for availability
   - Dynamic `refetchInterval` based on slot availability
   - User activity detection
2. Optimistic updates for booking forms
   - Cache-level updates for multi-location display
   - Rollback strategy for conflicts

### Phase 4: Stripe Connect Expansion
1. Direct charges implementation (already started)
2. Payment method cloning for repeat customers
3. Refund and dispute handling
4. Enhanced onboarding status tracking

### Phase 5: Testing & Observability
1. Expand race condition tests
2. Property-based testing with fast-check
3. Audit logging implementation
4. Request context propagation with AsyncLocalStorage

### Phase 6: Scale Optimization
1. Per-tenant rate limiting
2. Connection pooling strategy evaluation
3. Soft delete implementation with Prisma extensions
4. Audit log partitioning

---

**End of Technical Reference Document**
