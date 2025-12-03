# CRUD Route Quick Reference

30-second checklist for implementing new CRUD routes.

## Before You Code

- [ ] Contract defined in `packages/contracts/src/api.v1.ts`
- [ ] Rate limiter defined in `server/src/middleware/rateLimiter.ts`
- [ ] DTO mapper function planned

## Implementation Checklist

```
1. [ ] Define API contract with all response codes (200/201, 400, 401, 403, 404, 500)
2. [ ] Create rate limiters (read: 100/min, write: 20/min per tenant)
3. [ ] Import rate limiters in routes file
4. [ ] Apply rate limiter to every route
5. [ ] Extract getTenantId() helper
6. [ ] Extract mapEntityToDto() function
7. [ ] Add explicit NotFoundError catch blocks
```

## Pattern Snippets

### Rate Limiter
```typescript
export const entityReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTestEnvironment ? 500 : 100,
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
  validate: false,
  handler: (_req, res) => res.status(429).json({ error: 'too_many_requests' }),
});
```

### Tenant Auth Helper
```typescript
const getTenantId = (res: Response): string | null => {
  return res.locals.tenantAuth?.tenantId ?? null;
};
```

### DTO Mapper
```typescript
const mapEntityToDto = (entity) => ({
  id: entity.id,
  // ... other fields
});
```

### Error Handler
```typescript
} catch (error) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.issues });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}
```

### Numeric Validation
```typescript
// In Zod schema
priceCents: z.number().int().min(0).max(99999999)

// In validation.ts
if (value > MAX_VALUE) throw new ValidationError('Exceeds maximum');
```

## Code Review Red Flags

| Red Flag | Fix |
|----------|-----|
| Route without rate limiter | Add appropriate limiter |
| Inline DTO mapping | Extract to function |
| Missing contract | Define in api.v1.ts |
| `catch (error) { next(error) }` only | Add explicit error type checks |
| Numeric field without `.max()` | Add upper bound |

## HTTP Status Reference

| Code | When to Use |
|------|-------------|
| 200 | GET success, PUT success |
| 201 | POST success (created) |
| 204 | DELETE success (no content) |
| 400 | Validation error (ZodError) |
| 401 | No tenant authentication |
| 403 | Not authorized for resource |
| 404 | Entity not found |
| 429 | Rate limit exceeded |
| 500 | Unexpected error |

## Related

- Full guide: `docs/solutions/security-issues/PREVENT-CRUD-ROUTE-VULNERABILITIES.md`
- Pattern reference: `CLAUDE.md` (Error Handling Pattern section)
