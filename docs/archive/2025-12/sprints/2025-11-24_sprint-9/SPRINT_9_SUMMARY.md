# Sprint 9: Package Catalog & Discovery - Quick Reference

**Status:** Ready to execute
**Priority:** P0 (Critical - Final blocker)
**Effort:** 30 hours (2 weeks)
**Branch:** main

---

## 🎯 Mission

Build `/packages` catalog page to enable package discovery - the final P0 critical feature blocking the primary user journey.

---

## 📦 Deliverables

### New Components (3)
1. `client/src/pages/PackageCatalog.tsx` - Main catalog page
2. `client/src/features/catalog/PackageCard.tsx` - Package card component
3. `client/src/features/catalog/CatalogFilters.tsx` - Search/filter/sort UI

### Modified Files (3)
1. `client/src/App.tsx` - Add `/packages` route
2. `client/src/components/AppShell.tsx` - Add navigation link
3. `client/src/pages/Homepage.tsx` - Link CTAs to catalog

---

## ✅ Success Criteria

**Must Have:**
- [ ] `/packages` route works
- [ ] Package grid displays all active packages
- [ ] Package cards link to detail pages
- [ ] Search by name/description
- [ ] Filter by price range
- [ ] Sort by price (asc/desc)
- [ ] Mobile responsive (1/2/3/4 column grid)
- [ ] Navigation links from homepage + header

**Quality:**
- [ ] TypeScript: 0 errors
- [ ] Test pass rate: ≥99.6%
- [ ] WCAG AA compliance maintained
- [ ] All touch targets ≥44px

---

## 📊 Expected Impact

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Package Discovery | NO | YES | NEW ✅ |
| Booking Completion | 30% | 50%+ | +67% |
| Primary Journey | 0% | 100% | COMPLETE 🎉 |
| Platform Maturity | 9.2/10 | 9.5/10 | +0.3 |

---

## 🚀 Quick Start

### Launch Sprint 9 Agent

```bash
# Use Task tool with this prompt:
"Execute Sprint 9: Build package catalog page with search, filtering, and sorting. Read SPRINT_9_EXECUTION_PROMPT.md for full details."
```

### Manual Execution

```bash
# 1. Create components
touch client/src/pages/PackageCatalog.tsx
touch client/src/features/catalog/PackageCard.tsx
touch client/src/features/catalog/CatalogFilters.tsx

# 2. Edit files
# - Add route to App.tsx
# - Add nav link to AppShell.tsx
# - Update CTAs in Homepage.tsx

# 3. Test
npm run typecheck
npm test
npm run dev:client  # Manual testing

# 4. Commit
git add .
git commit -m "feat(catalog): Sprint 9 - Package Catalog & Discovery"
```

---

## 📋 Task Checklist

### Week 1: Core Components
- [ ] Day 1-2: Create PackageCatalog.tsx (6h)
- [ ] Day 2-3: Create PackageCard.tsx (4h)
- [ ] Day 3-4: Create CatalogFilters.tsx (8h)

### Week 2: Integration & Testing
- [ ] Day 1: Add routes + navigation (3h)
- [ ] Day 2: Implement search/filter/sort (6h)
- [ ] Day 3: Testing + documentation (3h)

---

## 🎨 Key Design Patterns

### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {packages.map(pkg => <PackageCard key={pkg.id} package={pkg} />)}
</div>
```

### Package Card
```tsx
<Card className="hover:shadow-lg transition-shadow">
  <img src={pkg.photoUrl} alt={pkg.name} loading="lazy" />
  <h3>{pkg.name}</h3>
  <p>{truncate(pkg.description, 120)}</p>
  <span>${pkg.price}</span>
  <Button>View Details</Button>
</Card>
```

### Search with Debounce
```tsx
const [localSearch, setLocalSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => onSearchChange(localSearch), 300);
  return () => clearTimeout(timer);
}, [localSearch]);
```

---

## 🔗 API Usage

```typescript
// Use existing contract (NO backend changes needed)
import { apiClient } from '@/lib/api-client';

const { data: packages } = useQuery({
  queryKey: ['packages'],
  queryFn: () => apiClient.packages.getPackages(),
});

// Returns: Package[]
// - Automatically filtered by tenant (multi-tenant isolation)
// - Only returns active packages
```

---

## ⚠️ Important Constraints

1. **Frontend Only** - No backend/API changes
2. **Reuse Components** - Button, Card, Input from Sprint 8
3. **Maintain Standards** - Touch targets ≥44px, WCAG AA
4. **Test Stability** - Keep 99.6% pass rate
5. **Use Existing API** - `getPackages()` already exists

---

## 📖 Full Documentation

See `SPRINT_9_EXECUTION_PROMPT.md` for:
- Detailed task breakdown (10 tasks)
- Complete component code examples
- Testing strategy
- Edge case handling
- Common pitfalls
- Success metrics

---

## 🎉 Sprint 9 = Platform Complete!

After Sprint 9, all P0 critical issues are resolved:

✅ Sprint 7: WCAG compliance + logo + mobile nav
✅ Sprint 8: Touch targets + responsive + forms
✅ Sprint 9: Package catalog + discovery

**Result:** Fully functional platform with complete user journey! 🚀

---

**Ready to launch Sprint 9?** Use the execution prompt and let's finish the platform!
