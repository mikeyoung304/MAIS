# Prisma JSON Type Prevention Strategies

**Status:** Active Prevention Strategy
**Severity:** Medium (runtime type errors, data corruption risk)
**Created:** 2026-01-02
**Last Updated:** 2026-01-02

---

## Overview

Prisma's JSON field handling has subtle type compatibility issues that can cause runtime errors, failed migrations, and data validation failures. This guide documents proven prevention strategies for handling JSON fields correctly.

### Key Issues to Prevent

1. **Type assertion cascade**: Using `as SomeType[]` on JSON fields creates non-nullable assumptions
2. **Null handling mismatch**: Assigning `null` directly to JSON fields instead of using `Prisma.DbNull`
3. **Undefined vs null confusion**: JSON fields treat `undefined` and `null` differently
4. **Extension type extraction**: Attempting to extract `$extends` return types defeats type safety
5. **Post-upgrade regressions**: Schema changes can invalidate cached casts

---

## Pattern 1: JSON Field Reads (Always Two-Step Cast)

### DO: Use `unknown` as intermediate bridge

```typescript
// ✅ CORRECT - Safe casting through unknown
const photos = event.payload as unknown as { url: string }[];
const brandingConfig = tenant.branding as unknown as BrandingConfig;
const landingPageConfig = tenant.landingPageConfig as unknown as LandingPageSchema;
```

**Why this works:**

- TypeScript requires intermediate type before casting to incompatible type
- `unknown` is assignment-compatible with all types
- `as unknown as TargetType` prevents silent type errors
- Maintains type safety at compile-time

### DON'T: Direct casting

```typescript
// ❌ WRONG - TypeScript may silently accept invalid casts
const photos = event.payload as unknown[];

// ❌ WRONG - Assumes all properties exist (no guard)
const config = tenant.branding as BrandingConfig;
```

### Implementation Guide

**For array JSON fields:**

```typescript
// Schema: photos Json @default("[]")
const photos = pkg.photos as unknown as Array<{
  url: string;
  filename: string;
  size: number;
  order: number;
}>;

// With safe defaults
const photosArray = Array.isArray(pkg.photos) ? (pkg.photos as unknown as PhotoType[]) : [];
```

**For object JSON fields:**

```typescript
// Schema: branding Json @default("{}")
const branding = (tenant.branding as unknown as BrandingConfig) ?? {};

// With validation
const validated = BrandingConfigSchema.safeParse(tenant.branding);
if (!validated.success) {
  logger.warn({ error: validated.error }, 'Invalid branding config');
  return defaultBranding;
}
```

**For optional JSON fields:**

```typescript
// Schema: landingPageConfig Json? (nullable)
if (tenant.landingPageConfig) {
  const config = tenant.landingPageConfig as unknown as LandingPageConfig;
  // Safe to use config
}
```

---

## Pattern 2: JSON Field Writes (InputJsonValue Casting)

### DO: Use `Prisma.InputJsonValue` for writes

```typescript
// ✅ CORRECT - Prisma-compatible input type
await prisma.package.update({
  where: { id: packageId },
  data: {
    photos: validatedPhotos as Prisma.InputJsonValue,
  },
});

// ✅ CORRECT - Through unknown for complex types
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    landingPageConfig: normalizedConfig as unknown as Prisma.InputJsonValue,
  },
});
```

**Why this works:**

- `Prisma.InputJsonValue` is the correct type for JSON field input
- Prisma accepts any JSON-serializable value
- Intermediate `unknown` cast handles type mismatches
- Runtime serialization validates actual JSON compatibility

### Implementation Pattern

```typescript
// Import at top
import type { Prisma } from '@/generated/prisma';

// In service method
export async function updatePackagePhotos(
  prisma: PrismaClient,
  tenantId: string,
  packageId: string,
  photos: Array<{ url: string; filename: string }>
): Promise<void> {
  // Validate structure before write
  const validated = z.array(PhotoSchema).parse(photos);

  // Write with proper casting
  await prisma.package.update({
    where: { id: packageId, tenantId }, // Tenant scoping!
    data: {
      photos: validated as unknown as Prisma.InputJsonValue,
    },
  });
}
```

### DON'T: Use incorrect types

```typescript
// ❌ WRONG - Missing Prisma prefix
data: {
  photos: validated as InputJsonValue;
}

// ❌ WRONG - Direct cast without unknown
data: {
  photos: validated as { url: string }[];
}

// ❌ WRONG - Stringify first (creates string, not JSON object)
data: {
  photos: JSON.stringify(validated);
}
```

---

## Pattern 3: Null vs Undefined for Optional JSON Fields

### Schema Pattern

```prisma
// Optional JSON field (can be null or object)
model Tenant {
  landingPageConfig Json?        @default("{}")  // Defaults to empty object
  tierDisplayNames  Json?        @default("{}")  // Defaults to empty object
  draftPhotos       Json?                        // Nullable (null = no draft)
}
```

### DO: Use `undefined` to skip fields, `Prisma.DbNull` for explicit NULL

```typescript
// ✅ CORRECT - Skip field (don't update it)
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    onboardingPhase: 'COMPLETED',
    // landingPageConfig not included = field unchanged
  },
});

// ✅ CORRECT - Set to explicit NULL for nullable fields
await prisma.package.update({
  where: { id: packageId },
  data: {
    hasDraft: false,
    draftPhotos: Prisma.DbNull, // Explicitly NULL
    draftUpdatedAt: Prisma.DbNull,
  },
});
```

### DON'T: Assign null directly

```typescript
// ❌ WRONG - null might be serialized as JSON string "null"
data: {
  draftPhotos: null,  // Ambiguous
}

// ❌ WRONG - undefined breaks Prisma update behavior
data: {
  draftPhotos: undefined,  // Prisma may ignore this
}
```

### Decision Tree

```
Do you want to update this JSON field?
├─ Yes → Use `validated as unknown as Prisma.InputJsonValue`
└─ No → Don't include field in data object

Is this field nullable (Json?)?
├─ Yes →
│  ├─ Clearing it? Use `Prisma.DbNull`
│  └─ Setting value? Use `validated as unknown as Prisma.InputJsonValue`
└─ No → Always provide a value
```

---

## Pattern 4: Event Sourcing with JSON Payloads

### From MAIS Codebase: Onboarding Events

```typescript
/**
 * ✅ CORRECT PATTERN - From event-sourcing.ts
 */
export async function appendEvent<T extends OnboardingEventType>(
  prisma: PrismaClient,
  tenantId: string,
  eventType: T,
  payload: OnboardingEventPayloads[T],
  expectedVersion: number
): Promise<AppendEventResult> {
  try {
    // Step 1: Validate at runtime using Zod
    const validationResult = safeValidateEventPayload(eventType, payload);
    if (!validationResult.success) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationResult.error,
      };
    }

    // Step 2: Write with proper JSON casting
    const event = await tx.onboardingEvent.create({
      data: {
        tenantId,
        eventType,
        payload: validationResult.data as Prisma.InputJsonValue, // ← Safe cast
        version: nextVersion,
      },
    });

    return { success: true, eventId: event.id, version: nextVersion };
  } catch (error) {
    // Proper error handling
    return { success: false, error: 'DATABASE_ERROR', message: errorMsg };
  }
}
```

### Reading Event Payloads

```typescript
/**
 * ✅ CORRECT - Reading JSON payload with Zod validation
 */
async function projectFromEvents(tenantId: string) {
  const events = await prisma.onboardingEvent.findMany({
    where: { tenantId },
    orderBy: { version: 'asc' },
  });

  for (const event of events) {
    // Cast to unknown first
    const payload = event.payload as unknown as Record<string, unknown>;

    // Validate with Zod before using
    switch (event.eventType) {
      case 'DISCOVERY_COMPLETED': {
        const parsed = DiscoveryDataSchema.safeParse(payload);
        if (parsed.success) {
          memory.discoveryData = {
            businessType: parsed.data.businessType,
            businessName: parsed.data.businessName,
            // Only use properties that passed validation
            ...
          };
        } else {
          logger.warn(
            { eventId: event.id, error: parsed.error },
            'Failed to parse event payload'
          );
        }
        break;
      }
    }
  }
}
```

**Key principles:**

1. Always validate JSON payloads with Zod after reading
2. Use `Record<string, unknown>` as intermediate type for objects
3. Log parse failures instead of throwing
4. Only use properties that passed schema validation

---

## Pattern 5: Prisma Extensions (DO NOT extract types)

### DON'T: Try to extract `$extends` return type

```typescript
// ❌ WRONG - Cannot reliably extract extended client type
import type { PrismaClient } from '@prisma/client';

const extendedPrisma = prisma.$extends({
  model: {
    user: {
      findActive: async ({ findMany }) => {
        return await findMany({ where: { active: true } });
      },
    },
  },
});

// ❌ WRONG - ReturnType doesn't work reliably with $extends
type ExtendedClient = ReturnType<typeof createExtendedPrisma>;
```

### DO: Use simplified type alias

```typescript
// ✅ CORRECT - Simple alias to PrismaClient
type PrismaExt = PrismaClient;

const extendedPrisma = prisma.$extends({
  model: {
    user: {
      findActive: async ({ findMany }) => {
        return await findMany({ where: { active: true } });
      },
    },
  },
});

// Safe to use
async function getActiveUsers(client: PrismaExt) {
  // TypeScript understands this
  return await client.user.findMany({ where: { active: true } });
}
```

**Why this works:**

- Extensions maintain interface compatibility with base PrismaClient
- Type extraction via `ReturnType<typeof...>` is unreliable
- Simple alias documents intent without runtime overhead
- Actual extension methods are available at runtime

---

## Checklist: Before Upgrading Prisma

Before upgrading Prisma to a new major version, run this checklist:

### 1. Find All JSON Field Casts

```bash
# Find direct casts (may be problematic)
grep -r "as.*\[\]" server/src --include="*.ts" | grep -v "unknown as"

# Find InputJsonValue usage (check for patterns)
grep -r "InputJsonValue" server/src --include="*.ts"
```

**What to check:**

- [ ] All read casts go through `unknown` first
- [ ] All write casts use `Prisma.InputJsonValue`
- [ ] No direct `null` assignments to optional JSON fields
- [ ] All `Prisma.DbNull` usage is for explicit NULL values

### 2. Find All Prisma Extensions

```bash
grep -r "\$extends" server/src --include="*.ts"
```

**What to check:**

- [ ] No `ReturnType<typeof...>` type extractions
- [ ] All extensions use simplified type aliases
- [ ] Extension methods properly documented

### 3. Find All Zod Validations

```bash
grep -r "safeParse\|\.parse(" server/src --include="*.ts" | grep -i json
```

**What to check:**

- [ ] All JSON reads followed by schema validation
- [ ] Parse failures logged (not silently ignored)
- [ ] Validated data only used from `.success: true` path

### 4. Test Migration

```bash
# Run migrations on fresh database
cd server
npm exec prisma migrate reset

# Verify all JSON field operations
npm test -- --grep "json|Json|json-field"
```

**What to verify:**

- [ ] All JSON fields read correctly
- [ ] All JSON field writes succeed
- [ ] Optional JSON fields handle null correctly
- [ ] Event sourcing validates payloads

### 5. Type Check and Build

```bash
npm run typecheck
npm run build
```

**What to verify:**

- [ ] No type errors in JSON field operations
- [ ] No implicit `any` types
- [ ] All Prisma types imported correctly

---

## Real-World Examples from MAIS

### Example 1: Package Photos (Catalog Repository)

```typescript
// From: server/src/adapters/prisma/catalog.repository.ts

// ✅ CORRECT - Write with two-step cast
async updatePackagePhotos(...): Promise<void> {
  await prisma.package.update({
    where: { id: packageId, tenantId },
    data: {
      // photos is validated before this call
      photos: data.photos as unknown as Prisma.InputJsonValue,
    },
  });
}

// ✅ CORRECT - Read with two-step cast
async getPackage(...) {
  const pkg = await prisma.package.findUnique({ where: { id } });

  if (pkg?.photos) {
    const photos = (pkg.photos as unknown as PhotoType[]);
    // Safe to use photos array
  }
}
```

### Example 2: Agent Session Messages

```typescript
// From: server/src/agent/orchestrator/base-orchestrator.ts

// ✅ CORRECT - Append to JSON array with validation
const updatedMessages = [
  ...session.messages,
  { role: 'assistant', content: response, timestamp: new Date() },
];

await prisma.agentSession.update({
  where: { id: sessionId, tenantId },
  data: {
    messages: updatedMessages as unknown as Prisma.InputJsonValue,
  },
});
```

### Example 3: Audit Snapshots

```typescript
// From: server/src/services/audit.service.ts

// ✅ CORRECT - Handle optional JSON with proper typing
await prisma.configChangeLog.create({
  data: {
    beforeSnapshot: input.beforeSnapshot ? (input.beforeSnapshot as Prisma.InputJsonValue) : null,
    afterSnapshot: input.afterSnapshot as Prisma.InputJsonValue,
    metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : null,
  },
});
```

---

## Runtime Testing Patterns

### Test 1: JSON Field Round-Trip

```typescript
describe('JSON field round-trip', () => {
  it('should preserve JSON structure on write/read', async () => {
    const photos = [
      { url: 'https://example.com/1.jpg', filename: '1.jpg', size: 1024, order: 1 },
      { url: 'https://example.com/2.jpg', filename: '2.jpg', size: 2048, order: 2 },
    ];

    // Write
    await prisma.package.update({
      where: { id: pkgId, tenantId },
      data: {
        photos: photos as unknown as Prisma.InputJsonValue,
      },
    });

    // Read
    const read = await prisma.package.findUnique({ where: { id: pkgId } });
    const parsed = read.photos as unknown as typeof photos;

    // Verify
    expect(parsed).toEqual(photos);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].url).toBe(photos[0].url);
  });
});
```

### Test 2: Schema Validation

```typescript
describe('JSON schema validation', () => {
  it('should validate event payload on write', async () => {
    const payload = {
      businessType: 'photographer',
      businessName: 'Bella Photography',
      location: { city: 'Austin', state: 'TX' },
    };

    // Validate before write
    const validated = DiscoveryDataSchema.parse(payload);

    // Write
    await prisma.onboardingEvent.create({
      data: {
        tenantId,
        eventType: 'DISCOVERY_COMPLETED',
        payload: validated as Prisma.InputJsonValue,
        version: 1,
      },
    });

    // Read and re-validate
    const event = await prisma.onboardingEvent.findFirst({
      where: { tenantId, eventType: 'DISCOVERY_COMPLETED' },
    });

    const reparsed = DiscoveryDataSchema.parse(event.payload);
    expect(reparsed).toEqual(validated);
  });
});
```

### Test 3: Null Handling

```typescript
describe('JSON null handling', () => {
  it('should distinguish between undefined and null', async () => {
    // Set to null
    await prisma.package.update({
      where: { id: pkgId, tenantId },
      data: { draftPhotos: Prisma.DbNull },
    });

    const pkg1 = await prisma.package.findUnique({ where: { id: pkgId } });
    expect(pkg1.draftPhotos).toBeNull();

    // Skip field (no change)
    const pkg2 = await prisma.package.findUnique({ where: { id: pkgId } });
    expect(pkg2.draftPhotos).toBeNull(); // Still null from before

    // Set to value
    await prisma.package.update({
      where: { id: pkgId, tenantId },
      data: { draftPhotos: [] as unknown as Prisma.InputJsonValue },
    });

    const pkg3 = await prisma.package.findUnique({ where: { id: pkgId } });
    expect(pkg3.draftPhotos).toEqual([]);
  });
});
```

---

## Common Errors and Fixes

### Error 1: "Cannot convert undefined to a JSON value"

```typescript
// ❌ Wrong
data: {
  photos: undefined;
}

// ✅ Fix
// Option 1: Skip field
data: {
  // photos not included
}

// Option 2: Use empty array for default
data: {
  photos: [] as unknown as Prisma.InputJsonValue;
}

// Option 3: Use DbNull for nullable fields
data: {
  draftPhotos: Prisma.DbNull;
}
```

### Error 2: Type mismatch on generic JSON

```typescript
// ❌ Wrong
const config = data.branding as BrandingConfig;

// ✅ Fix
const config = data.branding as unknown as BrandingConfig;
```

### Error 3: Array operations fail silently

```typescript
// ❌ Wrong - assumes photos is always array
const count = data.photos.length;

// ✅ Fix
const photos = Array.isArray(data.photos) ? (data.photos as unknown as PhotoType[]) : [];
const count = photos.length;
```

### Error 4: Null assignment bypassed

```typescript
// ❌ Wrong - creates JSON string "null"
data: {
  field: null;
}

// ✅ Fix
data: {
  field: Prisma.DbNull;
}
```

---

## Summary: Golden Rules

1. **Read JSON → Cast through `unknown` first**

   ```typescript
   value as unknown as TargetType;
   ```

2. **Write JSON → Always use `Prisma.InputJsonValue`**

   ```typescript
   data: {
     field: value as unknown as Prisma.InputJsonValue;
   }
   ```

3. **Validate JSON → Use Zod after reads**

   ```typescript
   const validated = Schema.safeParse(jsonValue);
   if (!validated.success) {
     /* handle error */
   }
   ```

4. **Null JSON → Use `Prisma.DbNull` for explicit NULL**

   ```typescript
   data: {
     field: Prisma.DbNull;
   }
   ```

5. **Extensions → Don't extract types, use simple aliases**

   ```typescript
   type Client = PrismaClient;
   ```

6. **Before upgrades → Run the pre-upgrade checklist**
   - [ ] Find all JSON casts
   - [ ] Verify null handling
   - [ ] Check extensions
   - [ ] Run test migrations

---

## References

- [Prisma JSON Documentation](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#json)
- [Prisma Extensions Guide](https://www.prisma.io/docs/orm/prisma-client/client-extensions/overview)
- [MAIS Event Sourcing Pattern](./event-sourcing.ts)
- [MAIS Catalog Repository](./catalog.repository.ts)
- Related: `docs/solutions/prisma-db-execute-supabase-migrations-MAIS-20251231.md`
