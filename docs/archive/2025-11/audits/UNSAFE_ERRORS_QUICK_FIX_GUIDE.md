# Quick Fix Guide for Remaining Unsafe Errors

## Copy-Paste Patterns

### 1. Add Imports (Top of File)

```typescript
import { hasStatusCode, isApiError, getErrorMessage, isRecord } from '@elope/shared';
```

### 2. Fix API Calls (Array Response)

**BEFORE:**

```typescript
const result = await api.getBookings();
if (result.status === 200) {
  setBookings(result.body); // ❌ unsafe-assignment
}
```

**AFTER:**

```typescript
const result = await api.getBookings();
if (result.status === 200 && Array.isArray(result.body)) {
  setBookings(result.body as BookingDto[]); // ✅ safe
}
```

### 3. Fix API Calls (Object Response)

**BEFORE:**

```typescript
const result = await api.getTenant();
if (result.status === 200) {
  const { name } = result.body; // ❌ unsafe-member-access
}
```

**AFTER:**

```typescript
const result = await api.getTenant();
if (result.status === 200 && isRecord(result.body)) {
  const tenant = result.body as TenantDto;
  const { name } = tenant; // ✅ safe
}
```

### 4. Fix Error Handlers

**BEFORE:**

```typescript
} catch (error) {
  console.error('Failed:', error);  // ❌ no-unsafe-assignment
  alert(error.message);              // ❌ no-unsafe-member-access
}
```

**AFTER:**

```typescript
} catch (error: unknown) {
  console.error('Failed:', getErrorMessage(error));  // ✅ safe
  alert(getErrorMessage(error));                     // ✅ safe
}
```

### 5. Fix Error Status Checks

**BEFORE:**

```typescript
} catch (error) {
  if (error.status === 401) {  // ❌ no-unsafe-member-access
    // handle auth error
  }
}
```

**AFTER:**

```typescript
} catch (error: unknown) {
  if (hasStatusCode(error) && error.status === 401) {  // ✅ safe
    // handle auth error
  }
}
```

### 6. Fix React Query Hooks

**BEFORE:**

```typescript
const { data } = useQuery({
  queryKey: ['packages'],
  queryFn: async () => {
    const response = await api.getPackages();
    return response.body; // ❌ unsafe-return
  },
});
```

**AFTER:**

```typescript
const { data } = useQuery({
  queryKey: ['packages'],
  queryFn: async () => {
    const response = await api.getPackages();
    if (response.status === 200) {
      return response.body as PackageDto[]; // ✅ safe
    }
    throw new Error('Failed to fetch packages');
  },
});
```

### 7. Replace `any` with `unknown`

**BEFORE:**

```typescript
function handleData(data: any) {
  // ❌ no-explicit-any
  // ...
}
```

**AFTER:**

```typescript
function handleData(data: unknown) {
  // ✅ safe
  if (isRecord(data)) {
    // now you can use data safely
  }
}
```

### 8. Fix JSON Parsing

**BEFORE:**

```typescript
const data = await response.json(); // ❌ no-unsafe-assignment
```

**AFTER:**

```typescript
const data = (await response.json()) as YourType; // ✅ safe
// or
const data: YourType = (await response.json()) as YourType; // ✅ safe
```

## File-Specific Fixes

### For TenantPackagesManager.tsx (43 errors)

Apply these fixes in order:

1. Add imports at top
2. Fix all `catch (error)` → `catch (error: unknown)`
3. Fix all `console.error('...', error)` → `console.error('...', getErrorMessage(error))`
4. Fix all API calls:
   - `api.tenantGetPackages()` → add `as PackageDto[]`
   - `api.tenantCreatePackage()` → check status and type guard
   - `api.tenantUpdatePackage()` → check status and type guard
   - `api.tenantDeletePackage()` → check status

### For TenantDashboard.tsx (35 errors)

Same pattern as admin/Dashboard.tsx:

1. Add imports
2. Fix loadBookings(), loadPackages(), loadBlackouts()
3. Add Array.isArray() checks
4. Fix all error handlers

### For Success.tsx (19 errors)

Handle Stripe-specific types:

```typescript
// Stripe payment intent
if (isRecord(paymentIntent) && 'id' in paymentIntent) {
  const intent = paymentIntent as { id: string; status: string };
  // use intent safely
}
```

## Batch Replace Commands

Use these sed commands to fix common patterns:

```bash
# Fix catch blocks
find client/src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/catch (error) {/catch (error: unknown) {/g'
find client/src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/catch (err) {/catch (err: unknown) {/g'

# Fix console.error with error
find client/src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' "s/console\.error(\(.*\), error);/console.error(\1, getErrorMessage(error));/g"
```

## Type Imports Reference

### Common DTOs from @elope/contracts

```typescript
import type {
  PackageDto,
  AddOnDto,
  BookingDto,
  TenantDto,
  TenantBrandingDto,
  CreatePackageDto,
  UpdatePackageDto,
  CreateAddOnDto,
  UpdateAddOnDto,
  CreateBookingDto,
} from '@elope/contracts';
```

### Error Guards from @elope/shared

```typescript
import {
  isApiError, // Check if error is ApiError
  hasStatusCode, // Check if has .status property
  hasMessage, // Check if has .message property
  isError, // Check if is Error instance
  getErrorMessage, // Extract message safely
  getErrorStatus, // Extract status safely
  isRecord, // Check if is object/record
} from '@elope/shared';
```

## Testing After Fix

1. **Verify TypeScript compiles:**

   ```bash
   npm run type-check
   ```

2. **Verify lint passes:**

   ```bash
   npm run lint --no-cache
   ```

3. **Count remaining errors:**

   ```bash
   npm run lint 2>&1 | grep "client/" | grep -E "no-unsafe|no-explicit-any" | wc -l
   ```

4. **Test in browser:**
   - Login flow
   - Package management
   - Booking flow
   - Error scenarios (network failures, validation errors)

## Common Mistakes to Avoid

❌ **Don't do this:**

```typescript
catch (error: any) {  // Still uses 'any'
  console.error(error);  // Still unsafe
}
```

❌ **Don't do this:**

```typescript
const result = await api.getPackages();
setPackages(result.body as PackageDto[]); // Missing status check!
```

❌ **Don't do this:**

```typescript
if (error.status === 401) {
  // Missing type guard!
  // ...
}
```

✅ **Do this:**

```typescript
catch (error: unknown) {
  console.error(getErrorMessage(error));
  if (hasStatusCode(error) && error.status === 401) {
    // ...
  }
}
```

## Priority Order

Fix files in this order for maximum impact:

1. **Tenant Admin Features** (highest user impact)
   - TenantPackagesManager.tsx
   - TenantDashboard.tsx

2. **Payment Flow** (critical path)
   - Success.tsx

3. **Widget** (external-facing)
   - WidgetApp.tsx
   - WidgetPackagePage.tsx

4. **Utilities** (used everywhere)
   - package-photo-api.ts

5. **Remaining Pages**
   - All other files with <10 errors

---

**Tip:** Fix one file at a time, test it, then move to the next. Don't try to fix everything at once.
