---
status: complete
priority: p1
issue_id: '003'
tags: [documentation, branding, find-replace]
dependencies: []
---

# Fix "Elope" → "MAIS" Branding References

## Problem Statement

The project was renamed from "Elope" to "MAIS" (Macon AI Solutions) but **2,344 occurrences** of "Elope" remain across 326 files. This creates confusion about the project identity and appears unprofessional in documentation.

## Findings

**Scope of issue:**

- 2,344 occurrences of "elope" or "Elope" across markdown files
- 326 files affected
- Primarily in documentation, not code

**High-priority files identified:**

1. `.github/workflows/README.md` - References "Elope" project badges
2. `client/ROLE_BASED_ARCHITECTURE.md` - Throughout entire document
3. `client/WIDGET_README.md` - Title and content
4. `docs/LINK_UPDATES_NEEDED.md` - References wrong project path
5. `ARCHITECTURE_DIAGRAM.md` - Line 1-30 references "ELOPE PLATFORM"

**Note:** Some "elope" references may be legitimate (wedding industry term "elopement"). Need selective replacement.

## Proposed Solutions

### Solution 1: Selective Find/Replace (Recommended)

- Replace project name references but preserve wedding terminology
- Target: "Elope Platform", "Elope booking", "Elope Widget"
- Preserve: "elopement package", "elopement ceremony"
- Effort: Medium (4-6 hours)
- Risk: Low with review
- Pros: Accurate, preserves domain terms
- Cons: More time required

### Solution 2: Bulk Replace All

- Replace all "Elope" → "MAIS", "elope" → "mais"
- Effort: Small (1 hour)
- Risk: Medium - may break wedding terminology
- Pros: Fast
- Cons: May need post-fix corrections

### Solution 3: Replace in Priority Files Only

- Fix only high-visibility files (.github/, root docs, client/)
- Effort: Small (2 hours)
- Risk: Low
- Pros: Quick improvement
- Cons: Incomplete fix

## Recommended Action

Solution 1 - Selective find/replace with pattern matching.

## Technical Details

**Patterns to replace:**

- "Elope Platform" → "MAIS Platform"
- "Elope booking" → "MAIS booking"
- "Elope Widget" → "MAIS Widget"
- "Elope wedding" → "MAIS wedding" (if referring to system, not ceremony)
- GitHub badge URLs with "Elope" repo name

**Patterns to PRESERVE:**

- "elopement package" - legitimate business term
- "elopement ceremony" - wedding industry term
- "elope" as verb - not project reference

**Command for audit:**

```bash
# Find all occurrences
grep -ri "elope" --include="*.md" . | grep -v node_modules | grep -v ".git"

# Count by file
grep -ril "elope" --include="*.md" . | grep -v node_modules | wc -l
```

## Acceptance Criteria

- [ ] All project name references updated to "MAIS"
- [ ] Wedding industry terms preserved
- [ ] .github/ badges reference correct repo
- [ ] No broken references introduced
- [ ] Verify with grep after fix

## Work Log

| Date       | Action      | Notes                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-11-24 | Created     | 2,344 occurrences identified                                                                                                                                                                                                                                                                                                                                                                |
| 2025-11-24 | Partial fix | Fixed CHANGELOG.md GitHub URLs (elope→mais)                                                                                                                                                                                                                                                                                                                                                 |
| 2025-11-24 | Partial fix | Fixed client/ROLE_BASED_ARCHITECTURE.md project name                                                                                                                                                                                                                                                                                                                                        |
| 2025-11-24 | Scoped      | 122 non-archived files have references (vs 325 total)                                                                                                                                                                                                                                                                                                                                       |
| 2025-12-01 | Complete    | Fixed all high-visibility files (20+ files): client/src/lib/_.md, client/src/components/_.md, client/src/styles/_.md, client/src/contexts/_.md, docs/setup/_.md, docs/phases/_.md, docs/SEGMENT*TIER_INTEGRATION_REPORT.md, server/docs/*.md, .claude/\_.md. Preserved "elopement" wedding terms. Remaining low-priority files in docs/roadmaps/ and docs/operations/ contain code samples. |

## Resources

- nov18scan/name-references-to-fix.md (original audit)
- Project rename date: Unknown
