# P2: No Search Debouncing in TenantsList

## Status

- **Priority:** P2 (Medium - Performance)
- **Status:** ready
- **Created:** 2025-12-30
- **Source:** `/workflows:review` - Performance Oracle

## Problem

The TenantsList search input triggers filtering on every keystroke without debouncing.

**File:** `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx`

```typescript
<Input
  type="text"
  placeholder="Search by name, slug, or email..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}  // No debounce
  className="pl-10 bg-surface border-neutral-700"
/>
```

**Performance impact by tenant count:**
| Count | Filter Time | Experience |
|-------|-------------|------------|
| 10-100 | <1ms | Excellent |
| 500-1000 | 5-15ms | Acceptable |
| 1000+ | 15ms+ | Noticeable lag |

## Impact

At scale (500+ tenants), users may experience input lag on slower devices. Each keystroke triggers three `toLowerCase()` calls per tenant.

## Solution

Add 150-200ms debounce:

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const [searchQuery, setSearchQuery] = useState('');
const debouncedQuery = useDebouncedValue(searchQuery, 150);

const filteredTenants = useMemo(() => {
  // Use debouncedQuery instead of searchQuery
}, [tenants, debouncedQuery, filterMode]);
```

## Tags

`performance`, `search`, `debounce`
