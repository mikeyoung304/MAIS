# ADR-002: Documentation Naming Standards

**Status**: Accepted
**Date**: 2025-11-12
**Last Updated**: 2025-11-12
**Deciders**: Tech Lead, Documentation Systems Specialist
**Related**: ADR-001 (Diátaxis Framework), DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md

---

## Context

MAIS's documentation system suffers from severe naming inconsistencies that create confusion and undermine discoverability. Analysis of 248 files reveals multiple naming problems:

### Current Naming Chaos

**1. Inconsistent Case Conventions**

```
docs/MIGRATION_PLAN.md          (SCREAMING_SNAKE_CASE)
docs/INDEX.md                   (UPPERCASE)
docs/setup/local-development.md (kebab-case)
docs/api/payments.md            (lowercase)
SPRINT_4_HANDOFF.md             (root directory, UPPERCASE)
.claude/SPRINT_6_STABILIZATION_PLAN.md (different location, same pattern)
```

**2. Misleading Timestamps**

```
docs/archive/oct-22-analysis/   (actually contains Oct 2025 files!)
                                (oct-22 implies Oct 22, 2023 or 2022)
                                (creates 2-3 year misdating)
```

**3. Ad-Hoc Naming Without Patterns**

```
EXECUTION_ORDER.md              (what execution? when?)
PHASE_1.3_COMPLETION_REPORT.md  (which project? what happened to 1.0-1.2?)
README.md                       (35 different README.md files in project)
```

**4. Status vs Stable Content Confusion**

- UPPERCASE files suggest permanence but often contain time-sensitive status
- Lowercase files suggest stability but sometimes contain ephemeral notes
- No clear signal for "this is current" vs "this is historical"

### Consequences of Naming Chaos

**Developer Impact**:

- 23% duplication rate (developers can't find existing docs, create new ones)
- 2-3 hour onboarding time (navigating naming inconsistencies)
- Cross-team confusion (backend uses kebab-case, ops uses UPPERCASE)

**AI Agent Impact**:

- Claude Code agents reference wrong documentation versions
- Conflicting instructions from similarly-named files
- Can't distinguish current from archived content

**Search & Discovery Impact**:

- grep/search returns too many false positives
- Can't filter by file type (status vs guide vs reference)
- Time-based searches fail (oct-22 misdating)

### Comparative Evidence: Rebuild 6.0 Standards

Rebuild 6.0 enforces **4 strict naming patterns** with clear purposes:

1. **UPPERCASE_UNDERSCORE**: Living documents (STATUS.md, CONFIG.md)
2. **kebab-case**: Permanent content (api-reference.md, testing-guide.md)
3. **YYYY-MM-DD prefix**: Time-sensitive (2025-10-12-sprint-retrospective.md)
4. **ADR-###**: Architecture decisions (ADR-001-snake-case-convention.md)

**Result**: 281 files with zero ambiguity about file purpose or timeline.

---

## Decision

**Adopt 4 standardized naming patterns** for all MAIS documentation, each with clear semantic meaning and usage rules.

### Pattern 1: UPPERCASE_UNDERSCORE

**Purpose**: Living status documents that change frequently
**Format**: `UPPERCASE_UNDERSCORE.md`
**Location**: Usually project root or .claude/ for sprint-specific work

**Use For**:

- Current status reports (SPRINT_6_STABILIZATION_PLAN.md)
- Active planning documents (MIGRATION_PLAN.md)
- Live indices (INDEX.md)
- Configuration placeholders (SECRETS_ROTATION.md - move to vault!)

**Examples**:

```
✅ SPRINT_6_STABILIZATION_PLAN.md
✅ PRODUCTION_READINESS_ASSESSMENT.md
✅ LINK_UPDATES_NEEDED.md
❌ execution-order.md (wrong: should be EXECUTION_ORDER.md or archived)
```

**Archiving Rule**: When work completes, rename with date prefix:

```
SPRINT_6_STABILIZATION_PLAN.md → 2025-11-12-sprint-6-stabilization-plan.md
```

### Pattern 2: kebab-case

**Purpose**: Stable, permanent documentation
**Format**: `kebab-case-title.md`
**Location**: Diátaxis quadrant directories (tutorials/, how-to/, explanation/, reference/)

**Use For**:

- Tutorials (getting-started.md)
- How-to guides (configure-stripe-webhooks.md)
- Explanations (multi-tenancy-architecture.md)
- Reference docs (api-authentication.md)
- Permanent indices (architecture-overview.md)

**Examples**:

```
✅ docs/tutorials/getting-started.md
✅ docs/how-to/deployment/configure-ssl.md
✅ docs/reference/api/endpoints.md
❌ docs/GettingStarted.md (wrong: should be kebab-case)
❌ docs/api_reference.md (wrong: use kebab, not snake)
```

**Stability Guarantee**: These files should remain stable for months/years. Breaking changes require versioning:

```
api-v1.md → api-v2.md (major API change)
```

### Pattern 3: YYYY-MM-DD Prefix

**Purpose**: Time-sensitive or historical documentation
**Format**: `YYYY-MM-DD-kebab-case-description.md`
**Location**: docs/archive/ or sprint-specific directories

**Use For**:

- Sprint retrospectives (2025-11-12-sprint-6-retrospective.md)
- Incident reports (2025-10-15-database-outage-postmortem.md)
- Migration logs (2025-11-07-docs-reorganization-report.md)
- Release notes (2025-11-01-v2.0-release-notes.md)

**Examples**:

```
✅ docs/archive/2025-11/2025-11-07-documentation-reorganization.md
✅ docs/archive/2025-10/2025-10-22-catalog-bug-analysis.md
❌ docs/archive/oct-22-analysis/ (wrong: ambiguous date)
❌ docs/sprint-6-report.md (wrong: missing date prefix)
```

**Dating Rules**:

- Use ISO 8601 date format (YYYY-MM-DD)
- Date represents creation or event date, NOT arbitrary labeling
- Month-only archives use YYYY-MM/ directory structure

### Pattern 4: ADR-### (Architecture Decision Records)

**Purpose**: Document significant architectural decisions
**Format**: `ADR-###-kebab-case-title.md`
**Location**: docs/adrs/ (or docs/explanation/architecture-decisions/)

**Use For**:

- Framework choices (ADR-001-adopt-diataxis-framework.md)
- Technical standards (ADR-002-documentation-naming-standards.md)
- Architecture patterns (ADR-003-multi-tenancy-design.md)
- Technology selections (ADR-004-database-choice.md)

**Examples**:

```
✅ docs/adrs/ADR-001-adopt-diataxis-framework.md
✅ docs/adrs/ADR-002-documentation-naming-standards.md
✅ docs/adrs/ADR-003-api-versioning-strategy.md
❌ docs/architecture-decisions.md (wrong: should be separate ADRs)
❌ docs/adr-1-diataxis.md (wrong: use ADR-001, not adr-1)
```

**Numbering Rules**:

- Sequential numbering: ADR-001, ADR-002, ADR-003, ... ADR-010, ADR-011
- Zero-padded to 3 digits (supports up to 999 ADRs)
- Never reuse numbers (even if ADR is superseded)
- Superseded ADRs marked with status, not deleted

---

## Decision Matrix

Use this matrix to choose the correct naming pattern:

| Question                                  | Yes                  | No             |
| ----------------------------------------- | -------------------- | -------------- |
| Will this document change weekly/monthly? | UPPERCASE_UNDERSCORE | Continue       |
| Is this an architecture decision?         | ADR-###              | Continue       |
| Is this tied to a specific date/sprint?   | YYYY-MM-DD prefix    | Continue       |
| Is this permanent reference content?      | kebab-case           | Review purpose |

**Examples**:

| Document                 | Pattern              | Rationale                  |
| ------------------------ | -------------------- | -------------------------- |
| Current sprint plan      | UPPERCASE_UNDERSCORE | Changes weekly             |
| Why we chose PostgreSQL  | ADR-###              | Architecture decision      |
| Sprint 6 retrospective   | YYYY-MM-DD prefix    | Historical, date-specific  |
| API authentication guide | kebab-case           | Stable reference           |
| Database migration notes | YYYY-MM-DD prefix    | Tied to specific migration |
| Getting started tutorial | kebab-case           | Permanent learning content |

---

## Rationale

### Why These 4 Patterns?

#### Pattern Justification

**UPPERCASE_UNDERSCORE for Status**:

- ✅ Visual prominence (stands out in file listings)
- ✅ Signals "this is active/changing"
- ✅ Common convention in engineering (README.md, LICENSE.txt, etc.)
- ✅ Easy to grep: `ls -la | grep '^[A-Z]'`

**kebab-case for Stable Content**:

- ✅ Web-friendly (translates to clean URLs)
- ✅ Readable without underscores or capitals
- ✅ Standard in modern web documentation (Django, Gatsby, etc.)
- ✅ Sorts alphabetically in natural order

**YYYY-MM-DD for Time-Sensitive**:

- ✅ ISO 8601 standard (internationally recognized)
- ✅ Sorts chronologically automatically
- ✅ Unambiguous dates (no oct-22 confusion)
- ✅ Enables time-based queries: `ls docs/archive/2025-11/*`

**ADR-### for Architecture Decisions**:

- ✅ Industry standard (originated at Thoughtworks)
- ✅ Sequential numbering shows decision evolution
- ✅ Immutable numbering (ADR-005 always means same decision)
- ✅ Clear searchability: `grep -r "ADR-005"`

### Why Not Other Approaches?

**Alternative 1: All kebab-case**

- ❌ Can't distinguish status from stable content
- ❌ No chronological sorting for historical docs
- ❌ No visual prominence for active work

**Alternative 2: camelCase or PascalCase**

- ❌ Not web-friendly (requires URL encoding)
- ❌ Inconsistent with industry standards
- ❌ Harder to read (longComplexDocumentName vs long-complex-document-name)

**Alternative 3: snake_case**

- ❌ Conflicts with snake_case code convention (ADR-001 from rebuild 6.0)
- ❌ Less readable than kebab-case for multi-word titles
- ❌ Not standard in web documentation

**Alternative 4: Freestyle (Current State)**

- ❌ Already proven to fail (23% duplication, oct-22 misdating)
- ❌ No semantic meaning
- ❌ AI agent confusion

**Verdict**: 4-pattern system provides clear semantics without over-engineering.

---

## Implementation

### Phase 1: Establish Standards (Week 1)

**Files Changed**:

1. Create `docs/adrs/ADR-002-documentation-naming-standards.md` (this document)
2. Update `docs/INDEX.md` with naming pattern examples
3. Create `.github/PULL_REQUEST_TEMPLATE.md` with documentation checklist
4. Add naming standards to `.claude/PATTERNS.md` for AI agent guidance

**Success Criteria**:

- [x] ADR-002 written and accepted
- [ ] All new documentation follows standards (enforced in code review)
- [ ] Zero new files with ambiguous names

### Phase 2: Rename High-Priority Files (Week 2)

**Priority Order**:

**P0 - Immediate (Day 1-2)**:

```
❌ docs/archive/oct-22-analysis/
✅ docs/archive/2025-10/2025-10-22-catalog-bug-analysis/

❌ SPRINT_4_HANDOFF.md (root)
✅ docs/archive/2025-11/2025-11-01-sprint-4-handoff.md

❌ docs/EXECUTION_ORDER.md
✅ EXECUTION_ORDER.md (if active) OR archive with date
```

**P1 - Core Documentation (Week 2)**:

```
❌ docs/setup/*.md (inconsistent naming)
✅ docs/tutorials/getting-started.md
✅ docs/how-to/setup/local-environment.md

❌ docs/api/*.md (inconsistent)
✅ docs/reference/api/endpoints.md
✅ docs/reference/api/authentication.md
```

**P2 - Active Sprint Docs (Week 2)**:

```
❌ .claude/SPRINT_6_STABILIZATION_PLAN.md
✅ Keep UPPERCASE while active
✅ Archive as 2025-11-12-sprint-6-stabilization-plan.md when complete
```

### Phase 3: Migration Tooling (Week 3)

**Create Helper Scripts**:

1. **docs/scripts/validate-naming.sh**
   - Scans docs/ for naming violations
   - Reports files not matching any of 4 patterns
   - Suggests corrections

2. **docs/scripts/archive-document.sh**
   - Converts UPPERCASE_UNDERSCORE → YYYY-MM-DD-kebab-case
   - Moves to correct archive/ subdirectory
   - Updates internal links automatically

3. **Pre-commit Hook**
   - Validates new documentation follows patterns
   - Blocks commits with non-standard names
   - Provides helpful error messages

### Phase 4: Link Updates (Week 3-4)

**Track and Update** (use existing LINK_UPDATES_NEEDED.md):

1. Internal documentation links
2. README.md references
3. Code comments with doc links
4. AI agent instruction files (.claude/PROJECT.md)

---

## Consequences

### Positive

✅ **Clear semantics**: File name reveals purpose and stability
✅ **Chronological clarity**: ISO dates eliminate oct-22 confusion
✅ **Reduced duplication**: Easy to find existing docs (23% → <5% goal)
✅ **AI agent clarity**: Claude Code can distinguish status from stable docs
✅ **Search efficiency**: Pattern-based filtering (find all ADRs, all 2025-11 docs)
✅ **Archiving automation**: UPPERCASE → YYYY-MM-DD conversion is mechanical
✅ **Cross-project consistency**: Aligns with rebuild 6.0 standards
✅ **Onboarding speed**: New developers understand naming semantics in minutes
✅ **URL cleanliness**: kebab-case creates readable web URLs

### Negative

⚠️ **Migration effort**: 248 files need review and potential renaming

- **Mitigation**: Phase 2 prioritizes P0-P1 (20-30 files for 80% of value)
- **Mitigation**: Scripts automate bulk of migration work
- **Timeline**: 3-4 weeks for complete migration

⚠️ **Link breakage**: Renaming files breaks existing references

- **Mitigation**: Track all updates in LINK_UPDATES_NEEDED.md
- **Mitigation**: Use relative paths where possible
- **Mitigation**: Create redirects for most-referenced docs
- **Timeline**: Week 3-4 dedicated to link updates

⚠️ **Initial friction**: Developers must think about naming before creating docs

- **Mitigation**: Clear decision matrix in this ADR
- **Mitigation**: Pre-commit hook provides instant feedback
- **Mitigation**: Code review checklist includes naming validation
- **Benefit**: Friction forces intentional documentation (prevents clutter)

⚠️ **UPPERCASE files feel loud**: Some developers find ALL_CAPS aesthetically unpleasant

- **Counterpoint**: Visual prominence is the feature (active work should stand out)
- **Counterpoint**: Industry standard (README.md, LICENSE, etc.)
- **Mitigation**: UPPERCASE reserved for small subset (status docs only)

### Neutral

- Some edge cases may not fit cleanly (use closest match, document exception)
- Historical files may keep old names if rarely accessed (cost/benefit decision)
- Git history shows rename operations (use `git log --follow` to track)

---

## Validation & Testing

### Success Metrics

**Immediate (Week 1)**:

- [x] ADR-002 written and accepted
- [ ] Naming standards documented in INDEX.md
- [ ] Pre-commit hook created and tested

**Short-term (Month 1)**:

- [ ] 100% of new documentation follows standards
- [ ] Top 30 files migrated to correct naming
- [ ] Zero ambiguous dates (no more oct-22 style)
- [ ] Developer survey: 90%+ can choose correct pattern

**Long-term (Quarter 1)**:

- [ ] All 248 files follow standards (or documented exceptions)
- [ ] Zero naming-related confusion in support tickets
- [ ] Duplication rate drops from 23% to <5%
- [ ] Archive/ organized by YYYY-MM/ directories

### Test Scenarios

**Scenario 1: New Sprint Documentation**

- Developer creates sprint plan
- Decision: Active work → UPPERCASE_UNDERSCORE
- File: `SPRINT_7_PLAN.md`
- After sprint: Rename to `2025-12-01-sprint-7-retrospective.md`, move to archive

**Scenario 2: New Tutorial**

- Developer writes setup guide
- Decision: Permanent content → kebab-case
- File: `docs/tutorials/configure-testing-environment.md`
- Stable for years, no renaming needed

**Scenario 3: Architecture Decision**

- Team decides to switch databases
- Decision: ADR pattern
- File: `docs/adrs/ADR-003-migrate-to-postgres.md`
- Never renamed, superseded ADRs marked with status

**Scenario 4: Incident Response**

- Production outage occurs, postmortem written
- Decision: Time-sensitive → YYYY-MM-DD
- File: `docs/archive/2025-11/2025-11-15-auth-service-outage.md`
- Date = incident date, immediately archived

---

## Migration Checklist

### High-Priority Renames (Week 2)

**P0 - Immediate**:

- [ ] `docs/archive/oct-22-analysis/` → `docs/archive/2025-10/2025-10-22-catalog-bug-analysis/`
- [ ] `SPRINT_4_HANDOFF.md` → `docs/archive/2025-11/2025-11-01-sprint-4-handoff.md`
- [ ] Review all root-level UPPERCASE files, archive completed ones

**P1 - Core Documentation**:

- [ ] `docs/setup/*.md` → Reorganize into tutorials/ and how-to/ with kebab-case
- [ ] `docs/api/*.md` → Move to reference/api/ with kebab-case
- [ ] `docs/security/*.md` → Standardize to kebab-case

**P2 - Active Sprint Work**:

- [ ] Keep `SPRINT_6_STABILIZATION_PLAN.md` as UPPERCASE (active)
- [ ] Archive Sprint 4-5 docs with proper dates
- [ ] Consolidate `.claude/*.md` files (keep active, archive historical)

### Link Updates (Week 3-4)

- [ ] Update all internal doc links for renamed files
- [ ] Update README.md references
- [ ] Update code comments with doc links
- [ ] Update `.claude/PROJECT.md` instructions
- [ ] Update `docs/INDEX.md` navigation
- [ ] Create redirects for top 10 most-linked docs

---

## Rollback Strategy

If naming standards prove ineffective:

1. **Immediate Rollback**: Revert file renames (git history preserves old names)
2. **Partial Adoption**: Keep ADR-### and YYYY-MM-DD, drop kebab-case requirement
3. **Simplified Alternative**: 2-pattern system (UPPERCASE vs lowercase)

**Risk Assessment**: Low risk. Naming is purely organizational, doesn't affect functionality.

**Escape Criteria** (re-evaluate if these occur):

- Migration effort exceeds 6 weeks
- Developer satisfaction drops below current baseline
- Link breakage causes production issues (extremely unlikely)

---

## Related Documentation

- **ADR-001**: Adopt Diátaxis Framework (companion decision, provides structure for naming)
- **DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md**: Root cause analysis (identified oct-22 misdating)
- **docs/INDEX.md**: Primary navigation hub (will include naming examples)
- **LINK_UPDATES_NEEDED.md**: Track all link updates during migration
- **Rebuild 6.0**: Proven 4-pattern implementation (reference for migration)

---

## Examples & Quick Reference

### Naming Pattern Quick Reference

```bash
# Status documents (active, frequently changing)
SPRINT_6_STABILIZATION_PLAN.md
PRODUCTION_READINESS_ASSESSMENT.md
MIGRATION_PLAN.md

# Stable documentation (permanent reference)
docs/tutorials/getting-started.md
docs/how-to/deployment/configure-ssl.md
docs/reference/api/authentication.md

# Time-sensitive documents (historical, dated)
docs/archive/2025-11/2025-11-12-sprint-6-retrospective.md
docs/archive/2025-10/2025-10-15-database-outage-postmortem.md

# Architecture decisions (numbered, immutable)
docs/adrs/ADR-001-adopt-diataxis-framework.md
docs/adrs/ADR-002-documentation-naming-standards.md
docs/adrs/ADR-003-multi-tenancy-design.md
```

### Common Pitfalls to Avoid

```bash
❌ docs/GettingStarted.md        (use kebab-case, not PascalCase)
❌ docs/api_reference.md         (use kebab-case, not snake_case)
❌ docs/sprint-6-plan.md         (active status = UPPERCASE)
❌ docs/2025-11-sprint-6.md      (put date first: 2025-11-12-sprint-6)
❌ docs/adr-1-diataxis.md        (use ADR-001, not adr-1)
❌ docs/archive/oct-22/          (use YYYY-MM-DD, not oct-22)
```

---

## Approval

This ADR addresses critical naming inconsistencies identified through:

- Quantitative analysis (23% duplication rate)
- Historical misdating (oct-22 ambiguity)
- AI agent confusion (conflicting documentation sources)
- Developer feedback (2-3 hour onboarding due to navigation issues)

**Decision validated through**:

- Rebuild 6.0's proven 4-pattern system (281 files, zero ambiguity)
- Industry standards (ISO 8601 dates, ADR numbering convention)
- Comparative analysis (ad-hoc naming failed in Nov 7 reorganization)

**Status**: ACCEPTED (2025-11-12)

---

**Revision History**:

- 2025-11-12: Initial version (v1.0) - Establishes 4 naming patterns for documentation
