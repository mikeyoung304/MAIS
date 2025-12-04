# Server-Side Implementation Checklist

This checklist guides the server-side implementation needed to complete the role-based dashboard system.

## Phase 1: Database Migration

### 1.1 Run Prisma Migration

```bash
cd server
npx prisma migrate dev --name add_user_roles_and_tenant_link
```

**Expected changes**:

- [ ] UserRole enum includes PLATFORM_ADMIN and TENANT_ADMIN
- [ ] User table includes tenantId column (nullable)
- [ ] User table includes tenant foreign key
- [ ] Tenant table includes users relation
- [ ] Index created on User.tenantId

### 1.2 Generate Prisma Client

```bash
npx prisma generate
```

**Verify**:

- [ ] Generated types include new UserRole values
- [ ] User type includes tenantId and tenant relation
- [ ] Tenant type includes users array

### 1.3 Create Initial Users

```bash
npx prisma studio
# Or create a seed script
```

**Create**:

- [ ] At least one PLATFORM_ADMIN user
- [ ] At least one TENANT_ADMIN user with tenantId set
- [ ] Test credentials documented

**Example seed script**:

```typescript
// server/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create platform admin
  const platformAdmin = await prisma.user.create({
    data: {
      email: 'admin@elope.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Platform Admin',
      role: 'PLATFORM_ADMIN',
    },
  });

  // Create tenant admin
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.user.create({
      data: {
        email: `admin@${tenant.slug}.com`,
        passwordHash: await bcrypt.hash('tenant123', 10),
        name: `${tenant.name} Admin`,
        role: 'TENANT_ADMIN',
        tenantId: tenant.id,
      },
    });
  }
}

main();
```

## Phase 2: Authentication Updates

### 2.1 Update Token Payload Interface

**File**: `server/src/lib/ports.ts` (or similar)

```typescript
export interface TokenPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId?: string; // Only present for TENANT_ADMIN
}
```

**Tasks**:

- [ ] Update TokenPayload type definition
- [ ] Update JWT signing to include role and tenantId
- [ ] Update JWT verification to extract all fields

### 2.2 Create Unified Login Endpoint

**File**: `server/src/routes/auth.routes.ts`

```typescript
import { initServer } from '@ts-rest/express';

// Add to contracts
const authContract = c.router({
  unifiedLogin: {
    method: 'POST',
    path: '/v1/auth/login',
    body: z.object({
      email: z.string().email(),
      password: z.string(),
    }),
    responses: {
      200: z.object({
        token: z.string(),
        user: z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().optional(),
          role: z.enum(['PLATFORM_ADMIN', 'TENANT_ADMIN']),
          tenantId: z.string().optional(),
          tenantName: z.string().optional(),
          tenantSlug: z.string().optional(),
        }),
      }),
      401: z.object({ message: z.string() }),
    },
  },
});
```

**Implementation**:

```typescript
async unifiedLogin(req, res) {
  const { email, password } = req.body;

  // Find user (including tenant relation)
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true }
  });

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Only allow PLATFORM_ADMIN and TENANT_ADMIN
  if (!['PLATFORM_ADMIN', 'TENANT_ADMIN'].includes(user.role)) {
    return res.status(401).json({ message: 'Unauthorized role' });
  }

  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Return user data
  return res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name,
      tenantSlug: user.tenant?.slug
    }
  });
}
```

**Tasks**:

- [ ] Add unifiedLogin to contracts
- [ ] Implement login handler
- [ ] Include tenant relation in query
- [ ] Generate JWT with all required fields
- [ ] Return properly shaped user object
- [ ] Add error handling
- [ ] Add rate limiting
- [ ] Test with both roles

## Phase 3: Authorization Middleware

### 3.1 Create Role-Based Middleware

**File**: `server/src/middleware/authorization.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { TokenPayload } from '../lib/ports';

type UserRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as TokenPayload;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      return res.status(403).json({
        message: 'Forbidden',
        requiredRole: allowedRoles,
      });
    }

    next();
  };
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as TokenPayload;

  if (user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ message: 'Platform admin access required' });
  }

  next();
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as TokenPayload;

  if (user?.role !== 'TENANT_ADMIN') {
    return res.status(403).json({ message: 'Tenant admin access required' });
  }

  if (!user.tenantId) {
    return res.status(403).json({ message: 'Tenant ID missing' });
  }

  next();
}
```

**Tasks**:

- [ ] Create authorization middleware file
- [ ] Implement requireRole function
- [ ] Implement requirePlatformAdmin helper
- [ ] Implement requireTenantAdmin helper
- [ ] Add to route handlers
- [ ] Test role enforcement

### 3.2 Update Auth Middleware

**File**: `server/src/middleware/auth.ts`

Update to extract all token fields:

```typescript
const payload: TokenPayload = identityService.verifyToken(token);

res.locals.user = {
  userId: payload.userId,
  email: payload.email,
  role: payload.role,
  tenantId: payload.tenantId, // Include for TENANT_ADMIN
};
```

**Tasks**:

- [ ] Update to extract role from token
- [ ] Update to extract tenantId from token
- [ ] Store in res.locals.user
- [ ] Update type definitions

## Phase 4: Platform Admin Endpoints

### 4.1 Get All Tenants

**Endpoint**: `GET /v1/platform/tenants`

```typescript
async getAllTenants(req, res) {
  // Already verified as PLATFORM_ADMIN by middleware

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          packages: true,
          bookings: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return res.status(200).json(tenants);
}
```

**Tasks**:

- [ ] Create route with requirePlatformAdmin middleware
- [ ] Include package and booking counts
- [ ] Return all tenant fields
- [ ] Test response format

### 4.2 Get System Statistics

**Endpoint**: `GET /v1/platform/stats`

```typescript
async getSystemStats(req, res) {
  const [
    totalTenants,
    activeTenants,
    totalBookings,
    bookingAggregates
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      _sum: {
        totalPrice: true,
        commissionAmount: true
      }
    })
  ]);

  return res.status(200).json({
    totalTenants,
    activeTenants,
    totalBookings,
    totalRevenue: bookingAggregates._sum.totalPrice || 0,
    platformCommission: bookingAggregates._sum.commissionAmount || 0
  });
}
```

**Tasks**:

- [ ] Create route with requirePlatformAdmin
- [ ] Calculate system metrics
- [ ] Return in correct format
- [ ] Test performance with large datasets

### 4.3 Create Tenant

**Endpoint**: `POST /v1/platform/tenants`

```typescript
async createTenant(req, res) {
  const { name, slug, email, commissionPercent } = req.body;

  // Generate API keys
  const apiKeyPublic = generateApiKey('pk_live');
  const apiKeySecret = await hashApiKey(generateApiKey('sk_live'));

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      email,
      apiKeyPublic,
      apiKeySecret,
      commissionPercent: commissionPercent || 10.0
    }
  });

  return res.status(201).json(tenant);
}
```

**Tasks**:

- [ ] Create route with requirePlatformAdmin
- [ ] Validate input data
- [ ] Generate API keys
- [ ] Create tenant record
- [ ] Handle slug uniqueness errors
- [ ] Test creation flow

### 4.4 Update Tenant

**Endpoint**: `PUT /v1/platform/tenants/:id`

```typescript
async updateTenant(req, res) {
  const { id } = req.params;
  const updates = req.body;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: updates
  });

  return res.status(200).json(tenant);
}
```

**Tasks**:

- [ ] Create route with requirePlatformAdmin
- [ ] Validate tenant exists
- [ ] Validate update fields
- [ ] Update tenant record
- [ ] Test update flow

## Phase 5: Tenant Admin Endpoints

### 5.1 Add Tenant Scoping Middleware

**File**: `server/src/middleware/tenant-scope.ts`

```typescript
export function tenantScopeMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as TokenPayload;

  if (user.role === 'TENANT_ADMIN' && user.tenantId) {
    // Inject tenantId into request for easy access
    res.locals.tenantId = user.tenantId;
  }

  next();
}
```

**Tasks**:

- [ ] Create tenant scope middleware
- [ ] Add to tenant routes
- [ ] Inject tenantId into res.locals

### 5.2 Get Tenant Info

**Endpoint**: `GET /v1/tenant/info`

```typescript
async getTenantInfo(req, res) {
  const tenantId = res.locals.tenantId;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    return res.status(404).json({ message: 'Tenant not found' });
  }

  return res.status(200).json(tenant);
}
```

**Tasks**:

- [ ] Create route with requireTenantAdmin
- [ ] Use tenantId from JWT
- [ ] Return tenant info
- [ ] Test response format

### 5.3 Update Existing Tenant Endpoints

**Files**: All files in `server/src/routes/tenant-*.ts`

For each endpoint, ensure it:

```typescript
// Before (old system)
const packages = await prisma.package.findMany();

// After (tenant-scoped)
const tenantId = res.locals.tenantId;
const packages = await prisma.package.findMany({
  where: { tenantId },
});
```

**Endpoints to update**:

- [ ] GET /v1/tenant/packages - Filter by tenantId
- [ ] POST /v1/tenant/packages - Include tenantId
- [ ] PUT /v1/tenant/packages/:id - Verify tenantId
- [ ] DELETE /v1/tenant/packages/:id - Verify tenantId
- [ ] GET /v1/tenant/bookings - Filter by tenantId
- [ ] GET /v1/tenant/blackouts - Filter by tenantId
- [ ] POST /v1/tenant/blackouts - Include tenantId
- [ ] DELETE /v1/tenant/blackouts/:id - Verify tenantId
- [ ] GET /v1/tenant/branding - Filter by tenantId
- [ ] PUT /v1/tenant/branding - Include tenantId

**Security checks for updates/deletes**:

```typescript
// Verify ownership before update/delete
const package = await prisma.package.findFirst({
  where: {
    id: packageId,
    tenantId: res.locals.tenantId,
  },
});

if (!package) {
  return res.status(404).json({ message: 'Package not found' });
}

// Proceed with update/delete
```

## Phase 6: Update Contracts

### 6.1 Add Platform Admin Contracts

**File**: `packages/contracts/src/api.v1.ts`

```typescript
export const platformAdminContract = c.router({
  getAllTenants: {
    method: 'GET',
    path: '/v1/platform/tenants',
    responses: {
      200: z.array(TenantWithStatsSchema),
    },
  },
  getSystemStats: {
    method: 'GET',
    path: '/v1/platform/stats',
    responses: {
      200: SystemStatsSchema,
    },
  },
  // ... other endpoints
});
```

**Tasks**:

- [ ] Add platform admin routes to contract
- [ ] Create DTOs for responses
- [ ] Build contracts package
- [ ] Update client types

### 6.2 Add DTOs

**File**: `packages/contracts/src/dto.ts`

```typescript
export const SystemStatsSchema = z.object({
  totalTenants: z.number(),
  activeTenants: z.number(),
  totalBookings: z.number(),
  totalRevenue: z.number(),
  platformCommission: z.number(),
});

export const TenantWithStatsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  email: z.string().optional(),
  isActive: z.boolean(),
  stripeOnboarded: z.boolean(),
  commissionPercent: z.number(),
  createdAt: z.string(),
  _count: z.object({
    packages: z.number(),
    bookings: z.number(),
  }),
});
```

**Tasks**:

- [ ] Create all necessary DTOs
- [ ] Export types
- [ ] Rebuild contracts
- [ ] Test type safety

## Phase 7: Testing

### 7.1 Unit Tests

```typescript
describe('Authorization Middleware', () => {
  it('allows PLATFORM_ADMIN to access platform routes', async () => {
    // Test implementation
  });

  it('blocks TENANT_ADMIN from platform routes', async () => {
    // Test implementation
  });

  it('filters data by tenantId for TENANT_ADMIN', async () => {
    // Test implementation
  });
});
```

**Tasks**:

- [ ] Test unified login endpoint
- [ ] Test role-based middleware
- [ ] Test platform admin endpoints
- [ ] Test tenant admin scoping
- [ ] Test unauthorized access attempts

### 7.2 Integration Tests

```typescript
describe('Role-based access control', () => {
  let platformAdminToken: string;
  let tenantAdminToken: string;

  beforeAll(async () => {
    // Login as both roles
    platformAdminToken = await loginAsPlatformAdmin();
    tenantAdminToken = await loginAsTenantAdmin();
  });

  it('platform admin can see all tenants', async () => {
    const response = await request(app)
      .get('/v1/platform/tenants')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(1);
  });

  it('tenant admin cannot access platform endpoints', async () => {
    const response = await request(app)
      .get('/v1/platform/tenants')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('tenant admin only sees their data', async () => {
    const response = await request(app)
      .get('/v1/tenant/packages')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(response.status).toBe(200);
    // All packages should belong to same tenant
    const tenantIds = new Set(response.body.map((p) => p.tenantId));
    expect(tenantIds.size).toBe(1);
  });
});
```

**Tasks**:

- [ ] Test complete auth flow
- [ ] Test cross-tenant isolation
- [ ] Test role permissions
- [ ] Test error cases
- [ ] Load test with multiple tenants

## Phase 8: Deployment

### 8.1 Environment Variables

```bash
# .env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
```

**Tasks**:

- [ ] Document all environment variables
- [ ] Update .env.example
- [ ] Set production JWT secret
- [ ] Configure token expiration

### 8.2 Database Migration

```bash
# Production migration
DATABASE_URL="production-url" npx prisma migrate deploy
```

**Tasks**:

- [ ] Backup production database
- [ ] Run migration on staging
- [ ] Verify migration success
- [ ] Run migration on production
- [ ] Verify no data loss

### 8.3 Deploy Server

**Tasks**:

- [ ] Build server code
- [ ] Build contracts package
- [ ] Deploy to staging
- [ ] Test all endpoints
- [ ] Deploy to production
- [ ] Monitor logs

## Verification Checklist

### Authentication

- [ ] Can login as PLATFORM_ADMIN
- [ ] Can login as TENANT_ADMIN
- [ ] Cannot login with wrong credentials
- [ ] JWT includes all required fields
- [ ] Token expires appropriately

### Authorization

- [ ] PLATFORM_ADMIN can access `/v1/platform/*`
- [ ] TENANT_ADMIN cannot access `/v1/platform/*`
- [ ] TENANT_ADMIN can access `/v1/tenant/*`
- [ ] PLATFORM_ADMIN cannot access `/v1/tenant/*` (no tenantId)
- [ ] Unauthorized access returns 403

### Tenant Isolation

- [ ] TENANT_ADMIN A cannot see TENANT_ADMIN B's packages
- [ ] TENANT_ADMIN A cannot see TENANT_ADMIN B's bookings
- [ ] TENANT_ADMIN A cannot update TENANT_ADMIN B's data
- [ ] All tenant queries include WHERE tenantId filter
- [ ] No cross-tenant data leaks

### Platform Admin Features

- [ ] Can view all tenants
- [ ] Can see system statistics
- [ ] Can create new tenants
- [ ] Can update tenant settings
- [ ] Tenant list includes counts

### Performance

- [ ] Login response < 500ms
- [ ] Platform dashboard loads < 2s
- [ ] Tenant dashboard loads < 2s
- [ ] Database queries are optimized
- [ ] Indexes are in place

## Rollback Plan

If issues occur:

1. **Revert Server Deployment**

   ```bash
   # Revert to previous version
   git revert HEAD
   # Redeploy
   ```

2. **Revert Database Migration**

   ```bash
   # Only if necessary
   npx prisma migrate reset
   # Restore from backup
   ```

3. **Communicate with Users**
   - Notify platform admins
   - Notify tenant admins
   - Provide ETA for fix

## Success Criteria

The server-side implementation is complete when:

- [x] All checkboxes above are marked
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Code is reviewed
- [ ] Deployed to staging
- [ ] QA approved
- [ ] Deployed to production
- [ ] No critical issues in first 24 hours

## Notes

- Keep JWT secret secure and rotate regularly
- Monitor for suspicious login attempts
- Log all platform admin actions
- Regular security audits
- Performance monitoring on tenant queries

## Support

Questions? Check:

1. This checklist
2. ROLE_BASED_ARCHITECTURE.md
3. ROLE_QUICK_REFERENCE.md
4. ARCHITECTURE_DIAGRAM.md
