---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy_index
component: server/src/agent
phase: Phase 3+ AI Agent Implementation
severity: P1
---

# Agent Prevention Strategy Index

Central index for all prevention strategies, best practices, and testing patterns related to Phase 3+ AI agent implementations.

---

## Quick Navigation

### For First-Time Implementation

1. **Start here:** [Agent Tools Quick Checklist](./agent-tools-quick-checklist-MAIS-20251231.md) - Single-page reference (print and pin)
2. **Then read:** [Agent Implementation Prevention](./agent-implementation-prevention-phase-3-MAIS-20251231.md) - Full detailed patterns
3. **For testing:** [Agent Testing Patterns](./agent-testing-patterns-MAIS-20251231.md) - Comprehensive test examples

### For Code Review

1. Check [Prevention Checklist](./agent-implementation-prevention-phase-3-MAIS-20251231.md#integrated-prevention-checklist-for-agent-tools)
2. Review [Code Review Red Flags](./agent-tools-quick-checklist-MAIS-20251231.md#code-review-red-flags)
3. Verify against [Testing Recommendations](./agent-testing-patterns-MAIS-20251231.md#test-categories)

### For Debugging

1. Check [Common Anti-Patterns](./agent-implementation-prevention-phase-3-MAIS-20251231.md#common-anti-patterns-to-avoid)
2. Review [Debugging Tips](./agent-tools-quick-checklist-MAIS-20251231.md#debugging-tips)
3. See [Error Path Testing](./agent-testing-patterns-MAIS-20251231.md#pattern-6-error-path-testing)

---

## The 3 Critical P1 Issues (Fixed in Phase 3)

### Issue 1: Unsafe Type Assertions

**Problem:** Converting `unknown` types without validation using `as unknown as Type`

**Fix:** Create type guard validation functions

**Document:** [Unsafe Type Assertions](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-1-unsafe-type-assertions-on-jsonunknown-types)

**Quick Pattern:**

```typescript
// Before (UNSAFE)
messages: (data.messages as unknown as ChatMessage[]) || [];

// After (SAFE)
messages: parseChatMessages(data.messages);

// Pattern
function parseChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((msg): msg is ChatMessage => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      typeof msg.content === 'string'
    );
  });
}
```

### Issue 2: Missing Null Checks

**Problem:** Accessing optional fields without defensive guards

**Fix:** Use optional chaining and null coalescing

**Document:** [Missing Null Checks](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-2-missing-null-checks-on-optional-fields)

**Quick Pattern:**

```typescript
// Before (UNSAFE)
const city = data.location.city; // Crashes if location is null

// After (SAFE)
const city = data.location?.city ?? 'Unknown';
```

### Issue 3: Error Swallowing

**Problem:** Generic catch-all blocks that return the same error for all failures

**Fix:** Differentiate error types and classify appropriately

**Document:** [Error Swallowing](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-3-error-swallowing---generic-catch-all-handlers)

**Quick Pattern:**

```typescript
// Before (UNSAFE)
catch (error) {
  logger.error({ error }, 'Failed');
  return { success: false, error: 'Operation failed' };
}

// After (SAFE)
catch (error) {
  if (error instanceof ValidationError) {
    return { success: false, error: error.message };
  }
  logger.error({ error }, 'Unexpected error');
  throw error; // Let middleware handle
}
```

---

## Prevention Documents by Topic

### Type Safety

| Document                                                                                                                                  | Purpose                                           | Use When                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| [Type Assertions Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-1-unsafe-type-assertions-on-jsonunknown-types) | How to safely convert Prisma JSON to typed values | Working with JsonValue fields |
| [Quick Checklist - Type Safety](./agent-tools-quick-checklist-MAIS-20251231.md#type-safety-checklist)                                     | 30-second type safety review                      | Before submitting PR          |
| [Testing - Type Safety](./agent-testing-patterns-MAIS-20251231.md#pattern-4-type-safety-testing)                                          | How to test JSON parsing                          | Writing unit tests            |

### Null Safety

| Document                                                                                                                             | Purpose                          | Use When                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | -------------------------------- |
| [Optional Fields Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-2-missing-null-checks-on-optional-fields) | Defensive null checking patterns | Accessing optional Prisma fields |
| [Quick Checklist - Null Safety](./agent-tools-quick-checklist-MAIS-20251231.md#null-safety-checklist)                                | 30-second null safety review     | Before submitting PR             |
| [Testing - Optional Fields](./agent-testing-patterns-MAIS-20251231.md#pattern-3-optional-field-testing)                              | How to test optional fields      | Writing unit tests               |

### Error Handling

| Document                                                                                                                                   | Purpose                                    | Use When             |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------- |
| [Error Handling Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#issue-3-error-swallowing---generic-catch-all-handlers) | How to classify and handle errors properly | In try/catch blocks  |
| [Quick Checklist - Error Handling](./agent-tools-quick-checklist-MAIS-20251231.md#code-patterns-copy-paste-ready)                          | 30-second error handling review            | Before submitting PR |
| [Testing - Error Paths](./agent-testing-patterns-MAIS-20251231.md#pattern-6-error-path-testing)                                            | How to test all error scenarios            | Writing unit tests   |

### Testing

| Document                                                                                               | Purpose                      | Use When              |
| ------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------- |
| [Testing Patterns](./agent-testing-patterns-MAIS-20251231.md)                                          | Comprehensive testing guide  | Writing tests         |
| [Happy Path Tests](./agent-testing-patterns-MAIS-20251231.md#pattern-1-happy-path-testing)             | How to test normal operation | Every tool needs this |
| [Validation Tests](./agent-testing-patterns-MAIS-20251231.md#pattern-2-validation-error-testing)       | How to test input validation | Every tool needs this |
| [Tenant Isolation Tests](./agent-testing-patterns-MAIS-20251231.md#pattern-5-tenant-isolation-testing) | How to test multi-tenancy    | Every tool needs this |
| [Integration Tests](./agent-testing-patterns-MAIS-20251231.md#pattern-7-integration-testing)           | How to test end-to-end flows | For complex tools     |

### Tenant Isolation

| Document                                                                                                        | Purpose                            | Use When                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| [Quick Checklist - Tenant Isolation](./agent-tools-quick-checklist-MAIS-20251231.md#tenant-isolation-checklist) | 30-second tenant check             | Before submitting PR           |
| [Testing - Tenant Isolation](./agent-testing-patterns-MAIS-20251231.md#pattern-5-tenant-isolation-testing)      | How to test isolation              | Writing unit tests             |
| [CLAUDE.md - Multi-Tenant](../../CLAUDE.md#multi-tenant-data-isolation)                                         | Foundational multi-tenancy pattern | Understanding the architecture |

---

## Implementation Workflow

### Step 1: Plan Your Tool

- [ ] Read [Agent Tools Quick Checklist](./agent-tools-quick-checklist-MAIS-20251231.md) - Print and pin
- [ ] Identify JSON fields in your data
- [ ] Identify optional fields
- [ ] Plan error cases

### Step 2: Implement

- [ ] Follow code patterns from [Agent Implementation Prevention](./agent-implementation-prevention-phase-3-MAIS-20251231.md#code-pattern-to-follow)
- [ ] Create type guard functions for JSON fields
- [ ] Add null checks for optional fields
- [ ] Implement differentiated error handling
- [ ] Use provided templates from [Quick Checklist](./agent-tools-quick-checklist-MAIS-20251231.md#file-templates)

### Step 3: Test

- [ ] Follow patterns from [Agent Testing Patterns](./agent-testing-patterns-MAIS-20251231.md)
- [ ] Write tests for all 7 categories (happy path, validation, optional fields, type safety, tenant isolation, errors, integration)
- [ ] Achieve 70%+ code coverage
- [ ] Run `npm test` locally

### Step 4: Code Review

- [ ] Check against [Prevention Checklist](./agent-implementation-prevention-phase-3-MAIS-20251231.md#integrated-prevention-checklist-for-agent-tools)
- [ ] Check against [Code Review Red Flags](./agent-tools-quick-checklist-MAIS-20251231.md#code-review-red-flags)
- [ ] Fix any issues and test again

---

## Key Patterns Reference

### Always Use These Patterns

1. **Type Guards for JSON**
   - See: [Type Assertions Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#code-pattern-to-follow)
   - File: `server/src/agent/orchestrator/orchestrator.ts` (lines 48-61)

2. **Optional Chaining + Null Coalescing**
   - See: [Optional Fields Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#code-pattern-to-follow-1)
   - File: Any tool accessing optional fields

3. **Differentiated Error Handling**
   - See: [Error Handling Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#code-pattern-to-follow-2)
   - File: `server/src/agent/customer/customer-tools.ts`

4. **Tenant-Scoped Queries**
   - See: [Tenant Isolation Pattern](./agent-implementation-prevention-phase-3-MAIS-20251231.md#database-query-pattern)
   - File: All agent tools include tenantId in WHERE

### Never Use These Anti-Patterns

- ❌ `as unknown as Type` without validation
- ❌ Accessing `obj.nested.property` without null checks
- ❌ Generic catch-all error handlers
- ❌ Missing `tenantId` in WHERE clauses
- ❌ Skipping tests for optional fields
- ❌ Logging sensitive data

---

## Real-World Examples

### Example 1: Booking Tool (Complete)

The booking tool in `server/src/agent/customer/customer-tools.ts` demonstrates all patterns:

- ✅ Type-safe null checks for optional fields
- ✅ Specific error handling (validation, conflict, not found)
- ✅ Tenant isolation in all queries
- ✅ Error logging with context
- ✅ Full test coverage

### Example 2: JSON Parsing (Type Safety)

The `parseChatMessages` function in `server/src/agent/orchestrator/orchestrator.ts` (lines 48-61) demonstrates:

- ✅ Type guard filter
- ✅ Comprehensive validation
- ✅ Safe fallback (empty array)
- ✅ Used in multiple places

### Example 3: Proposal Service (Error Handling)

The `ProposalService` in `server/src/agent/proposals/proposal.service.ts` demonstrates:

- ✅ Transaction safety
- ✅ Specific error handling
- ✅ Status tracking
- ✅ Tenant isolation checks

---

## Related Documentation

- [CLAUDE.md - Multi-Tenant Architecture](../../CLAUDE.md#multi-tenant-data-isolation)
- [CLAUDE.md - Layered Architecture](../../CLAUDE.md#layered-architecture)
- [CLAUDE.md - Service Layer Patterns](../../CLAUDE.md#code-patterns-to-follow)
- [Service Layer Patterns](./best-practices/service-layer-patterns-MAIS-20251204.md)
- [Any Types Quick Reference](./best-practices/any-types-quick-reference-MAIS-20251204.md)

---

## Questions & Answers

### Q: When should I use `as unknown as Type`?

**A:** Almost never. See [Any Types Quick Reference](./best-practices/any-types-quick-reference-MAIS-20251204.md).

If you need to convert Prisma JSON:

1. Create a type guard function (like `parseChatMessages`)
2. Use it everywhere you access that JSON field
3. Never directly assert with `as unknown as`

### Q: What if I can't test the tool locally?

**A:** Add integration tests that:

- Set up test database
- Create minimal test data
- Execute tool
- Verify database state

See [Integration Testing Pattern](./agent-testing-patterns-MAIS-20251231.md#pattern-7-integration-testing).

### Q: How do I avoid tenant isolation bugs?

**A:** Follow the checklist:

```
Every database query?
├─ WHERE clause has tenantId? (Yes → Good)
├─ Relation filtered by tenantId? (Yes → Good)
└─ Test with wrong tenantId? (Should return nothing)
```

See [Tenant Isolation Testing](./agent-testing-patterns-MAIS-20251231.md#pattern-5-tenant-isolation-testing).

### Q: What's the difference between logging null vs not found?

**A:**

- **Not found** (404): Expected case, log at info level, return user-friendly message
- **Null** (field is optional): Not an error, handle with `??` operator
- **Unexpected error** (500): Log at error level with stack trace, re-throw

### Q: Should I add error details to the API response?

**A:** Yes, but safely:

- Include user-friendly error message
- Do NOT expose database errors or internal details
- Include operation identifier for debugging (not sensitive data)

Example:

```typescript
// GOOD
{ success: false, error: 'Package not found' }

// BAD - Exposes database details
{ success: false, error: 'P2025: Record not found in Booking table' }
```

---

## Maintenance

Last updated: **2025-12-31**
Status: **Active - Use for Phase 3+ implementations**

### Changes in This Release

- Created 3 comprehensive prevention documents
- 30-second quick checklist for easy reference
- Full testing patterns with 7 test categories
- Real-world examples from Phase 3 code
- Quick-copy code templates

### Future Updates

When you discover new patterns or issues:

1. Document in appropriate file
2. Update this index
3. Add real-world examples
4. Link from CLAUDE.md if foundational

---

## Print & Pin

For fastest reference during implementation:

📌 **Print:** [Agent Tools Quick Checklist](./agent-tools-quick-checklist-MAIS-20251231.md)

This single page contains:

- Type safety checklist (3 questions)
- Null safety checklist (3 questions)
- Error handling checklist (4 questions)
- Tenant isolation checklist (3 questions)
- Code patterns (copy/paste ready)
- Pre-submission checklist

---

## Support & Escalation

### If you find a bug in the prevention patterns:

1. Create a GitHub issue with:
   - Which document
   - What's wrong
   - How to fix
2. Update the document
3. Update this index

### If you find a new pattern:

1. Document it in the appropriate file
2. Add real-world code example
3. Add test example
4. Update this index

---

## Version History

| Date       | Changes                                              |
| ---------- | ---------------------------------------------------- |
| 2025-12-31 | Initial creation - Phase 3 prevention strategy suite |

**Created by:** Claude Code Agent
**Status:** Production Ready - Use for all Phase 3+ agent work
