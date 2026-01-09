# Quick Reference: E2E Tests After Next.js Migration

**Print and pin this.** 2-minute read.

---

## The 5 Killers

| Issue         | Symptom                      | Fix                           |
| ------------- | ---------------------------- | ----------------------------- |
| Rate limiters | HTTP 429 after few tests     | Add `isTestEnvironment` check |
| Store access  | "undefined" in page.evaluate | Expose on `window`            |
| Effect order  | Child crashes on null data   | Add `if (!data) return;`      |
| Hydration     | Form values disappear        | Add 500ms wait after selector |
| Session leak  | Wrong user in test           | Use `browser.newContext()`    |

---

## Rate Limiter Pattern

```typescript
// TOP of rateLimiter.ts
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === '1';

// EVERY limiter
max: isTestEnvironment ? 100 : 5;
```

**Playwright config must have:**

```
E2E_TEST=1 npm run dev:e2e
```

---

## Store Exposure

```typescript
// BOTTOM of store file
if (typeof window !== 'undefined') {
  (window as any).useMyStore = useMyStore;
}
```

---

## Hydration Wait

```typescript
await page.goto('/path', { waitUntil: 'networkidle' });
await page.waitForSelector('#form');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(500); // <-- This is the key
```

---

## Form Fill with Verify

```typescript
await page.fill('#input', value);
// ALWAYS verify (hydration may clear)
await expect(page.locator('#input')).toHaveValue(value);
```

---

## Session Isolation

```typescript
// DON'T: page.context().clearCookies()

// DO: Fresh context
const ctx = await browser.newContext();
const newPage = await ctx.newPage();
try {
  // test here
} finally {
  await ctx.close();
}
```

---

## Effect Guard Pattern

```typescript
useEffect(() => {
  if (!data) return; // Parent not ready
  processData(data);
}, [data]);
```

---

## Decision Tree

```
429 Error?
  └─> Check isTestEnvironment in rate limiter

Store not found?
  └─> Add window.store = store at file bottom

Null/undefined in effect?
  └─> Add if (!prop) return guard

Form values cleared?
  └─> Add waitForTimeout(500) after selector

Session bleeding?
  └─> Use browser.newContext()
```

---

**Full doc:** `docs/solutions/patterns/E2E_NEXTJS_MIGRATION_PREVENTION_STRATEGIES.md`
