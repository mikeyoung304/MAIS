# DTO DRY Principle - Enforce @macon/contracts Usage

**Status:** Complete Prevention Pattern
**Severity:** P2 (Code Quality - Type Safety)
**Last Updated:** 2026-01-05
**Related:** P2 Fix #640, ADR-016

## Problem Statement

Frontend code often duplicates Zod schemas and TypeScript interfaces already defined in `@macon/contracts`:

```tsx
// ❌ WRONG - Duplicates definition from contracts
interface ServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

// ✓ CORRECT - Import from contracts
import type { ServiceDto } from '@macon/contracts';
```

**Consequences of duplication:**

- Type drift when contracts change (UI types become stale)
- Single source of truth violated
- Harder to maintain (changes in 2+ places)
- Risk of field name mismatches (e.g., `priceCents` vs `price_cents`)
- ADR-016 violation (canonical names from contracts package)

## Prevention Strategies

### 1. Contracts Package as Source of Truth

**Import pattern (REQUIRED):**

```typescript
// ✓ CORRECT - Always import from contracts
import type { ServiceDto, AvailabilityRuleDto, CustomerDto } from '@macon/contracts';

// ❌ WRONG - Define locally
interface Service {
  id: string;
  name: string;
  // ... duplicated fields
}
```

**What's available in @macon/contracts:**

```typescript
// packages/contracts/src/dto.ts - All DTO types

export type ServiceDto              // Appointment types
export type AvailabilityRuleDto     // Availability rules
export type CustomerDto             // Customers/bookings
export type AppointmentDto          // Booked appointments
export type BookingDto              // Booking information
export type SegmentDto              // Service categories
export type BrandingDto             // Tenant branding
export type BookingLinkDto          // Public booking links
export type PackageDto              // Service packages
// ... and many more

// All have corresponding Zod schemas:
export const ServiceDtoSchema        // For validation
export const AvailabilityRuleDtoSchema
export const CustomerDtoSchema
// etc.
```

### 2. Code Review Checklist

When reviewing UI code:

```markdown
Frontend/React changes
├─ [ ] Check for new interface/type definitions
│ └─ If they match database models, import from @macon/contracts instead
│
├─ [ ] Check for Zod schema duplicates
│ └─ If defining validation, check if exists in contracts first
│
├─ [ ] Check field names
│ └─ Ensure they match canonical names from contracts (e.g., priceCents, not price_cents)
│
└─ [ ] Check component props
└─ Props should use DTO types, not local interfaces
```

**Finding duplication - Grep patterns:**

```bash
# Find interface definitions in UI code
grep -r "^interface.*Dto" apps/web/src/

# Find duplicate Zod schemas
grep -r "z.object\|z.array\|z.string\|z.number" apps/web/src/ | grep -v node_modules

# Find hardcoded field names that should use DTOs
grep -r "const.*=.*{" apps/web/src/ | grep -E "(id|name|slug|priceCents)"
```

### 3. Import Organization Pattern

**Correct import structure:**

```typescript
// File: apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx

import type { ServiceDto } from '@macon/contracts'; // ← From contracts first
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-client';

// ✓ Type alias OK (for UI terminology)
export type AppointmentTypeDto = ServiceDto;

// ✓ Form data OK (UI-specific fields, not duplicating contract types)
export interface AppointmentTypeFormData {
  slug: string;
  name: string;
  durationMinutes: string; // String for form input
  priceCents: string; // String for form input
}
```

**What you CAN define locally:**

- Form data (strings for input fields)
- UI-specific state (isLoading, formError, etc.)
- UI-specific props for components

**What you MUST import from contracts:**

- API response/request DTOs
- Database model types
- Domain entity types
- Field names (always use canonical names)

### 4. Field Name Canonicalization

**Always use field names from contracts:**

Reference: `docs/adrs/ADR-016-field-naming-conventions.md`

```typescript
// From contracts (canonical)
export type ServiceDto = {
  priceCents: number; // Canonical
  basePrice: number; // Canonical
  durationMinutes: number; // Canonical
};

// ✓ CORRECT - Use canonical names
const service: ServiceDto = {
  priceCents: 1000,
  durationMinutes: 60,
};

// ❌ WRONG - Don't invent alternative names
interface LocalService {
  priceInCents: number; // Local variant
  price_cents: number; // Snake case variant
  duration: number; // Shortened name
}
```

**Common field name mappings:**

| Canonical (Contracts) | Frontend | Database           | Notes                          |
| --------------------- | -------- | ------------------ | ------------------------------ |
| `priceCents`          | Use same | `price_cents`      | Always in cents on backend     |
| `durationMinutes`     | Use same | `duration_minutes` | Always in minutes              |
| `tenantId`            | Use same | `tenant_id`        | Always `tenantId` in app layer |
| `createdAt`           | Use same | `created_at`       | ISO date strings               |
| `emailVerified`       | Use same | `email_verified`   | Boolean                        |

### 5. Detect Duplicates - Automated Check

**Add to TypeScript linting:**

```typescript
// .eslintrc.js

module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSInterfaceDeclaration[id.name=/Dto$/]',
        message: 'DTO types should be imported from @macon/contracts, not defined locally',
      },
      {
        selector: 'TSTypeAliasDeclaration[id.name=/Dto$/]',
        message: 'DTO types should be imported from @macon/contracts, not defined locally',
      },
    ],
  },
};
```

**Or use a custom script:**

```typescript
// scripts/check-duplicate-dtos.ts

import { readFileSync } from 'fs';
import { glob } from 'glob';

async function checkDuplicateDtos() {
  const files = await glob('apps/web/src/**/*.{ts,tsx}');
  const duplicates: string[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');

    // Check for interface/type definitions ending in Dto
    const dtoMatch = content.match(/(?:interface|type)\s+(\w*Dto\w*)/);
    if (dtoMatch) {
      const dtoName = dtoMatch[1];

      // Check if it's imported from contracts
      if (!content.includes(`from '@macon/contracts'`)) {
        duplicates.push(`${file}: ${dtoName} (not imported from @macon/contracts)`);
      }
    }
  }

  if (duplicates.length > 0) {
    console.error('Found DTO definitions not imported from contracts:');
    duplicates.forEach((d) => console.error(`  ${d}`));
    process.exit(1);
  }
}

checkDuplicateDtos();
```

### 6. When to Define Local Types

**ALLOWED - Local type definitions:**

```typescript
// Form data (different from DTO - strings for inputs)
interface ServiceFormData {
  slug: string; // String form input
  name: string;
  durationMinutes: string; // String, parsed to number on submit
  priceCents: string; // String, parsed to number on submit
}

// UI component props
interface ServiceCardProps {
  service: ServiceDto; // ← Uses imported DTO
  isLoading?: boolean;
  onEdit?: (id: string) => void;
}

// Local state
interface ServiceListState {
  selectedId: string | null;
  sortBy: 'name' | 'price';
  filterActive: boolean;
}
```

**NOT ALLOWED - Local DTO definitions:**

```typescript
// ❌ WRONG - Duplicates ServiceDto from contracts
interface ServiceData {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

// Use ServiceDto from contracts instead:
import type { ServiceDto } from '@macon/contracts';
```

## Related Files

**Source implementations:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx` - Shows correct pattern (imports ServiceDto)
- `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/dto.ts` - Master source (all DTOs)

**Architecture docs:**

- `docs/adrs/ADR-016-field-naming-conventions.md` - Canonical field names
- `docs/ARCHITECTURE.md` - Type-safe API contracts section

**Related prevention strategies:**

- `docs/solutions/patterns/cascading-entity-type-errors-MAIS-20251204.md` - How type mismatches cascade

## Code Review Checklist

```markdown
When reviewing frontend code:

1. New interfaces/types defined?
   ├─ Do they represent database models? → Import from @macon/contracts
   ├─ Do they represent API DTOs? → Import from @macon/contracts
   └─ Are they UI-specific (form data, state)? → OK to define locally

2. Zod schemas defined?
   └─ Check if they duplicate contracts validation

3. Field names used?
   └─ Verify they match canonical names from contracts (ADR-016)

4. Props for components?
   └─ Props referencing DTOs should use imported types
```

## Key Takeaways

1. **Never define DTO types locally** - Always import from @macon/contracts
2. **Use canonical field names** - priceCents, durationMinutes, tenantId (see ADR-016)
3. **Form data is OK locally** - UI-specific types like AppointmentTypeFormData
4. **Type alias for terminology** - `export type AppointmentTypeDto = ServiceDto;` for clarity
5. **Import before define** - Check contracts first, ask "why am I duplicating?"

## FAQ

**Q: But I need a slightly different type for my component?**
A: Use a type union or intersection, don't duplicate fields.

```typescript
// ✓ CORRECT
type ServiceWithUiState = ServiceDto & { isLoading: boolean };

// ❌ WRONG
interface LocalService extends ServiceDto {
  // Duplicates all fields
}
```

**Q: The contracts are outdated?**
A: Update contracts first, then use them. Don't create local variants.

**Q: Can I extend the DTO with extra fields?**
A: Yes, use intersection:

```typescript
// ✓ CORRECT
type ServiceWithMeta = ServiceDto & { fetchedAt: Date };
```

**Q: What if the DTO has fields I don't need?**
A: Still import it - TypeScript will only care about fields you use. Don't strip fields via local types.

**Q: Form values are strings but DTOs are numbers?**
A: That's correct! Form data ≠ DTO. Use different types:

```typescript
// ✓ CORRECT
interface ServiceFormData {
  priceCents: string; // From form input
}

// Server-side:
const dto: ServiceDto = {
  priceCents: parseInt(formData.priceCents), // Parsed
};
```
