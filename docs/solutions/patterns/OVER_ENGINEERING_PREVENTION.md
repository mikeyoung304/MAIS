---
module: MAIS
date: 2026-01-22
problem_type: code_quality
component: all
symptoms:
  - Custom implementations of existing npm packages
  - Large modules with >80% dead code
  - Redundant safety mechanisms (multiple layers doing same thing)
  - "Enterprise" features nobody requested
  - Hours spent on code that gets deleted in review
root_cause: Building for imagined future requirements instead of current needs
resolution_type: prevention_strategy
severity: P2
tags: [over-engineering, simplicity, code-review, technical-debt, yagni]
---

# Over-Engineering Prevention Strategies

**The 850-Line Lesson:** A "persistent chat session storage" feature included a custom LRU cache (when `lru-cache` was already installed), 196 lines of audit code with 95% never called, 293 lines of metrics mostly unused, redundant isolation levels, and application-layer encryption duplicating existing DB encryption. All removed in review.

**Core Principle:** The best code is code you don't write.

---

## 1. Pre-Implementation Checklist

**Ask these questions BEFORE writing any "enterprise" or "production-grade" code:**

### Existence Check

- [ ] Does this functionality already exist in an installed package?
  ```bash
  # Check what's already installed
  npm ls | grep -i "cache\|metrics\|audit\|encrypt"
  ```
- [ ] Does this functionality already exist elsewhere in the codebase?
  ```bash
  rg "class.*Cache|LRU|audit|metrics" server/src --type ts
  ```
- [ ] Is there a simpler stdlib/built-in solution?

### Necessity Check

- [ ] Is this explicitly in the requirements? (Link to issue/spec)
- [ ] Has a user/stakeholder actually requested this?
- [ ] What specific failure does this prevent? (Cite incident)
- [ ] Will removing this cause a test to fail?

### Timing Check

- [ ] Do we need this TODAY, or is this "might need someday"?
- [ ] Are we at scale that requires this complexity?
- [ ] What's the actual current load? (Show numbers)

### Cost-Benefit Check

- [ ] How many lines of code will this add?
- [ ] How many new dependencies?
- [ ] How much ongoing maintenance burden?
- [ ] Is the complexity proportional to the problem?

**Rule of thumb:** If you can't answer "YES" with evidence to at least 3 of the necessity questions, don't build it.

---

## 2. Red Flags (Stop and Reconsider)

### During Planning

| Red Flag                               | What It Means                               |
| -------------------------------------- | ------------------------------------------- |
| "We might need this later"             | YAGNI violation - build when you need it    |
| "This is how [Big Tech] does it"       | You're not at their scale                   |
| "Enterprise-grade" in your description | Marketing term, not engineering requirement |
| "Future-proofing"                      | Predicting requirements you don't have      |
| "Just in case"                         | Fear-driven development                     |

### During Implementation

| Red Flag                                      | What It Means              |
| --------------------------------------------- | -------------------------- |
| Writing >100 lines without a test using it    | Building unused code       |
| Creating abstractions with one implementation | Premature abstraction      |
| Adding config options nobody asked for        | Imaginary flexibility      |
| Implementing features "while you're in there" | Scope creep                |
| npm package exists but you're writing custom  | Not Invented Here syndrome |

### In Code Structure

| Red Flag                                     | What It Means           |
| -------------------------------------------- | ----------------------- |
| Module has methods never called from outside | Dead code               |
| Interface with single implementation         | Unnecessary indirection |
| Config with 10+ options, 8 use defaults      | Over-parameterization   |
| Multiple safety mechanisms at same layer     | Redundant protection    |
| "Helper" classes that add no value           | Abstraction addiction   |

---

## 3. Simplicity Heuristics

### The Rule of Three

Don't abstract until you have THREE concrete use cases. One is a special case. Two might be coincidence. Three is a pattern.

```typescript
// DON'T: Abstract on first use
class GenericCacheStrategy<T> { ... }
const sessionCache = new GenericCacheStrategy<Session>(); // Only use

// DO: Inline until pattern emerges
const sessionCache = new Map<string, Session>(); // Simple, works
```

### Package Before Custom

Always check npm before writing custom implementations:

```typescript
// DON'T: 150 lines of custom LRU cache
class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private accessOrder: K[];
  // ... 150 more lines
}

// DO: 3 lines using installed package
import { LRUCache } from 'lru-cache';
const cache = new LRUCache<string, Session>({ max: 1000 });
```

### Single Responsibility for Safety

One safety mechanism per concern. Multiple layers doing the same thing = redundant complexity:

```typescript
// DON'T: Triple redundancy
await prisma.$transaction(
  async (tx) => {
    // Serializable isolation AND advisory lock AND optimistic version check
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(...)`;
    const current = await tx.session.findUnique({ where: { id } });
    if (current.version !== expected) throw new Error('Conflict');
    // ... actual work
  },
  { isolationLevel: 'Serializable' }
);

// DO: Pick ONE appropriate mechanism
// For session storage: optimistic locking is sufficient
const updated = await prisma.session.update({
  where: { id, version: expected },
  data: { ...changes, version: { increment: 1 } },
});
if (!updated) throw new ConflictError();
```

### The "Delete Test"

Before adding code, ask: "If I delete this, what breaks?" If the answer is "nothing breaks" or "only this new code breaks," you probably don't need it.

### Lines of Code Budget

Set a budget BEFORE implementing. If a feature "needs" 500 lines, pause and ask why.

| Feature Type         | Reasonable LOC | Red Flag |
| -------------------- | -------------- | -------- |
| Simple CRUD endpoint | 50-100         | >200     |
| Cache layer          | 20-50          | >100     |
| Audit logging        | 30-50          | >100     |
| Metrics              | 20-40          | >80      |

### The 80/20 Rule

80% of value comes from 20% of features. Build the 20% first. Ship it. See if anyone asks for more.

---

## 4. Code Review Checklist

### For Reviewers: Over-Engineering Detection

```markdown
## Simplicity Review

### Existence

- [ ] No custom implementation of available npm package
- [ ] No reimplementation of existing codebase functionality
- [ ] Checked: `npm ls | grep [relevant-keywords]`

### Necessity

- [ ] Every public method is called from outside the module
- [ ] No "just in case" parameters or config options
- [ ] Links to requirement/issue for non-obvious features
- [ ] Can articulate specific failure this prevents

### Proportionality

- [ ] LOC proportional to problem complexity
- [ ] No interfaces with single implementation
- [ ] No abstract base classes with one child
- [ ] Config options actually vary in practice

### Dead Code Indicators

- [ ] No methods that are only tested, never used in production
- [ ] No error handling for errors that can't occur
- [ ] No feature flags for features that are always on/off
- [ ] No metrics that are collected but never queried

### Redundancy Check

- [ ] Single source of truth for each concern
- [ ] Not multiple safety mechanisms at same layer
- [ ] Encryption at ONE layer (app OR database, not both)
- [ ] Locking strategy is ONE approach (optimistic OR pessimistic)
```

### Red Flag Phrases in PR Descriptions

| Phrase             | Translation             | Action                     |
| ------------------ | ----------------------- | -------------------------- |
| "Enterprise-grade" | Over-engineered         | Request simplification     |
| "Future-proof"     | Predicting requirements | Remove speculative code    |
| "Comprehensive"    | Did more than asked     | Scope back to requirements |
| "Full-featured"    | Kitchen sink            | Identify must-haves        |
| "Production-ready" | May have over-prepared  | Verify actual requirements |
| "Extensible"       | Premature abstraction   | Inline until needed        |

### Review Questions to Ask

1. **"What breaks if we remove this?"**
   - If answer is "nothing" or "just the tests for this" = likely unnecessary

2. **"Who asked for this?"**
   - No ticket/issue = scope creep

3. **"What's the current scale?"**
   - If <1000 users, probably don't need distributed caching

4. **"What's the simpler alternative?"**
   - Force consideration of MVP approach

5. **"Can you show me the usage?"**
   - If showing usage requires writing new code, it's not used

---

## 5. Decision Trees

### Should I Build This Optimization?

```
Is there a measured performance problem?
├── NO → Don't build it
└── YES → Is there a simpler solution?
    ├── YES → Use simpler solution
    └── NO → Is the complexity worth the improvement?
        ├── NO → Accept current performance
        └── YES → Build it, but measure before/after
```

### Should I Add This Safety Feature?

```
Is there an existing safety mechanism for this concern?
├── YES → Use existing mechanism
└── NO → Is this a real threat? (cite incident or analysis)
    ├── NO → Don't build it
    └── YES → Is there a simpler protection?
        ├── YES → Use simpler protection
        └── NO → Build it, document the threat model
```

### Should I Write This Abstraction?

```
How many concrete implementations exist?
├── 0 → Don't abstract
├── 1 → Don't abstract, inline it
├── 2 → Probably don't abstract
└── 3+ → Abstract IF they share meaningful code
         Consider: Is shared code >30% of each implementation?
         ├── NO → Keep separate, duplication is OK
         └── YES → Abstract the shared part only
```

---

## 6. The "Session Storage" Anti-Pattern Analysis

Here's what went wrong in the 850-line feature, as a learning example:

| Component                    | Lines | Issue                                 | Should Have Been                        |
| ---------------------------- | ----- | ------------------------------------- | --------------------------------------- |
| Custom LRU Cache             | ~150  | `lru-cache` package already installed | `new LRUCache({ max: 1000 })` (3 lines) |
| Audit Module                 | 196   | 95% dead code, no consumer            | Remove entirely, or 10-line logger call |
| Metrics Module               | 293   | Mostly unused, no dashboards          | Remove, add when building dashboards    |
| Serializable + Advisory Lock | ~50   | Redundant with optimistic locking     | Pick one strategy                       |
| App-layer Encryption         | ~100  | DB already encrypted at rest          | Remove, use DB encryption               |

**Total:** ~850 lines removed
**What was needed:** ~50 lines of actual session storage logic

---

## 7. Healthy Patterns

### Start Small, Grow When Needed

```typescript
// V1: Simple Map (ships in 10 minutes)
const sessions = new Map<string, Session>();

// V2: Add TTL when needed (ships in 30 minutes)
import { LRUCache } from 'lru-cache';
const sessions = new LRUCache<string, Session>({
  max: 1000,
  ttl: 1000 * 60 * 30,
});

// V3: Add persistence when needed (ships in 2 hours)
// Now you have V1 and V2 working, you understand the access patterns
```

### Let Tests Drive Scope

```typescript
// Write the test FIRST
it('should retrieve session by ID', async () => {
  const session = await storage.save({ userId: 'user1', data: {} });
  const retrieved = await storage.get(session.id);
  expect(retrieved.userId).toBe('user1');
});

// Implementation: ONLY what the test needs
class SessionStorage {
  async save(data: SessionData): Promise<Session> { ... }
  async get(id: string): Promise<Session | null> { ... }
}
// That's it. No audit. No metrics. No encryption. Add when tests require it.
```

### Explicit "Not Implemented"

```typescript
// If you KNOW you'll need something later, leave a comment, not code
class SessionStorage {
  async save(data: SessionData): Promise<Session> {
    // TODO: Add audit logging when compliance requires it (no ticket yet)
    return this.repo.save(data);
  }
}
```

---

## 8. CLAUDE.md Addition

Add this to Common Pitfalls:

```markdown
71. Over-engineering "enterprise" features - Check if npm package exists, verify feature is actually required, prefer simple Map before LRU before Redis, single safety mechanism per concern. See `docs/solutions/patterns/OVER_ENGINEERING_PREVENTION.md`
```

---

## Quick Reference Card

```
BEFORE WRITING "ENTERPRISE" CODE:
1. Does npm package exist? → Use it
2. Is it in requirements? → Skip if not
3. What breaks without it? → Nothing = don't build
4. Current scale need this? → Probably not

RED FLAGS:
- "Might need later" = YAGNI
- Custom impl of npm package = NIH
- >100 lines for cache/audit/metrics = over-engineering
- Multiple safety mechanisms = redundancy

SIMPLICITY RULES:
- 3 uses before abstraction
- Package before custom
- One safety mechanism per concern
- Set LOC budget before coding

REVIEW QUESTIONS:
- "What breaks if we delete this?"
- "Who asked for this?"
- "What's the simpler alternative?"
```

---

**Last Updated:** 2026-01-22
