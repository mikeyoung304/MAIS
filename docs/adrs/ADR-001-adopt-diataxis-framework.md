# ADR-001: Adopt Diátaxis Documentation Framework

**Status**: Accepted
**Date**: 2025-11-12
**Last Updated**: 2025-11-12
**Deciders**: Tech Lead, Documentation Systems Specialist
**Related**: DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md, INDEX.md

---

## Context

MAIS's documentation system is experiencing severe structural drift despite recent reorganization efforts. Analysis reveals:

### Current State (248 Files)
- **Recent reorganization failure**: Major restructuring on Nov 7, 2025 created 9 categories
- **Immediate drift**: Within 5 days, 30+ files already out of place
- **Sprint documentation scatter**: Sprint 4-6 docs fragmented across root/, server/, .claude/
- **Archive confusion**: oct-22-analysis/ contains 2025 files (mislabeling)
- **Security exposures**: Passwords remained in archived docs for weeks/months
- **23% duplication rate**: Multiple files covering same content in client/ directory
- **No governance model**: No clear rules for where documentation belongs

### Symptoms of Structural Problem
1. **Information fragmentation**: Developers create duplicate docs because they can't find existing ones
2. **Cross-team confusion**: Backend/frontend/DevOps teams have different mental models
3. **Onboarding friction**: New team members report 2-3 hour setup time just understanding docs
4. **Documentation debt**: 248 files with no clear ownership or maintenance schedule
5. **AI agent confusion**: Claude Code agents reference conflicting documentation sources

### Root Cause Analysis
The Nov 7 reorganization created **9 ad-hoc categories** (setup/, api/, operations/, etc.) based on intuition rather than proven documentation science. Without a framework:
- No clear decision rules for categorization
- Categories overlap (where does "API authentication setup" go?)
- No support for different user journeys (novice vs expert)
- No distinction between learning, reference, and troubleshooting content

### Comparative Evidence: Rebuild 6.0 Success
The rebuild 6.0 project handles 281 files (17% more than MAIS) with minimal drift because it adopted the **Diátaxis framework**:
- Clear 4-quadrant structure (Tutorials, How-To Guides, Explanation, Reference)
- 15 navigation hubs serving different personas
- Strict naming conventions (4 patterns)
- Time-based archives (YYYY-MM/category/)
- 10 Architecture Decision Records documenting key choices

**Key Insight**: Framework + governance scales better than intuitive categorization.

---

## Decision

**Adopt the Diátaxis documentation framework** as the foundational structure for all MAIS documentation.

### What is Diátaxis?

Diátaxis (developed by Daniele Procida, adopted by Django, Cloudflare, and many open-source projects) organizes documentation into 4 quadrants based on two axes:

**Axis 1: Practical vs Theoretical**
**Axis 2: Learning vs Using**

```
                    LEARNING-ORIENTED
                           |
                           |
        TUTORIALS    |    EXPLANATION
        (Learning)   |    (Understanding)
        ------------------------------------
        HOW-TO       |    REFERENCE
        (Problem)    |    (Information)
                           |
                           |
                    WORK-ORIENTED
```

### The Four Quadrants

1. **Tutorials** (Learning-Oriented, Practical)
   - Goal: Teach by doing
   - Example: "Build your first restaurant in 30 minutes"
   - Audience: Newcomers
   - Content: Step-by-step walkthroughs with expected outcomes

2. **How-To Guides** (Work-Oriented, Practical)
   - Goal: Solve specific problems
   - Example: "How to configure Stripe webhooks"
   - Audience: Experienced users with specific needs
   - Content: Goal-oriented recipes and solutions

3. **Explanation** (Learning-Oriented, Theoretical)
   - Goal: Deepen understanding
   - Example: "Why we chose multi-tenancy architecture"
   - Audience: Those seeking context and rationale
   - Content: Concepts, design decisions, trade-offs (ADRs live here)

4. **Reference** (Work-Oriented, Theoretical)
   - Goal: Provide accurate information
   - Example: "API endpoint specifications"
   - Audience: Users who know what they need
   - Content: Exhaustive, precise technical details

### MAIS's Implementation Structure

```
docs/
├── tutorials/              # Quadrant 1: Learning-oriented, practical
│   ├── getting-started.md
│   ├── first-restaurant.md
│   └── testing-guide.md
│
├── how-to/                 # Quadrant 2: Work-oriented, practical
│   ├── deployment/
│   ├── configuration/
│   └── troubleshooting/
│
├── explanation/            # Quadrant 3: Learning-oriented, theoretical
│   ├── architecture/
│   ├── adrs/              # Architecture Decision Records
│   └── concepts/
│
└── reference/              # Quadrant 4: Work-oriented, theoretical
    ├── api/
    ├── database-schema/
    └── configuration/
```

---

## Rationale

### Why Diátaxis Over Ad-Hoc Categories?

#### Advantage 1: Clear Decision Rules
**Before (Ad-Hoc)**:
- "Should 'API authentication' go in setup/ or security/ or api/?"
- Three team members might choose three different locations
- Result: Duplication and confusion

**After (Diátaxis)**:
- Tutorial: "Build your first authenticated API call" (step-by-step for learners)
- How-To: "Configure JWT tokens" (specific solution for implementers)
- Explanation: "Why we chose dual authentication pattern" (ADR-006 for architects)
- Reference: "Authentication API endpoints" (complete API spec for developers)

**Impact**: Same content, four different forms for four different needs.

#### Advantage 2: User Journey Support
Diátaxis naturally supports different personas:
- **New developers**: Start with Tutorials → Explanation → Reference
- **Experienced devs joining project**: How-To Guides → Reference (skip tutorials)
- **Architects**: Explanation (ADRs) → Reference (schemas)
- **Support engineers**: How-To (troubleshooting) → Reference (logs, configs)

#### Advantage 3: Prevents Documentation Drift
When categorization rules are clear and purpose-driven:
- Developers know exactly where new docs belong
- Code reviewers can verify documentation placement
- AI agents don't create conflicting sources
- Archive decisions become mechanical (move old versions, not categories)

#### Advantage 4: Industry Validation
Proven at scale by:
- **Django** (most popular Python web framework)
- **Cloudflare** (serving millions of developers)
- **Gatsby, NumPy, FastAPI** (diverse tech stacks)
- **Rebuild 6.0** (our own sister project)

### Alternative Considered: Keep Ad-Hoc Categories

**Pros**:
- No migration cost (keep current 9 categories)
- Familiar to current team
- Simpler initial structure

**Cons**:
- Already failed (5-day drift after Nov 7 reorg)
- No clear decision rules (23% duplication)
- Doesn't scale (248 files → 500 files = chaos)
- No framework for preventing future drift
- Doesn't serve different user types

**Verdict**: Rejected. The Nov 7 reorganization proved that intuitive categories don't prevent drift without a framework.

---

## Implementation

### Phase 1: Foundation (Week 1)
**Files Changed**:
1. Create `docs/adrs/ADR-001-adopt-diataxis-framework.md` (this document)
2. Create `docs/adrs/ADR-002-documentation-naming-standards.md`
3. Create empty quadrant directories:
   - `docs/tutorials/`
   - `docs/how-to/`
   - `docs/explanation/`
   - `docs/reference/`
4. Update `docs/INDEX.md` with Diátaxis navigation structure

**Success Criteria**:
- [ ] Directory structure created
- [ ] INDEX.md explains the 4 quadrants
- [ ] First 2 ADRs written and accepted

### Phase 2: Migration (Weeks 2-3)
**Priority Order**:
1. **P0 Security**: Move exposed secrets to secure vault (before migration)
2. **P1 Core**: Migrate most-accessed 20 files (80% of traffic)
3. **P2 Active**: Migrate Sprint 4-6 documentation
4. **P3 Archive**: Properly timestamp and organize historical docs

**Migration Rules** (see ADR-002 for details):
- UPPERCASE_UNDERSCORE for status docs (e.g., SPRINT_6_STABILIZATION_PLAN.md)
- kebab-case for stable documentation (e.g., getting-started.md)
- YYYY-MM-DD prefixes for time-sensitive content (e.g., 2025-11-07-sprint-retrospective.md)
- ADR-### for Architecture Decision Records (e.g., ADR-001-adopt-diataxis-framework.md)

### Phase 3: Governance (Week 4+)
**Establish Practices**:
1. Documentation review in PR checklists
2. Quarterly documentation health audits
3. Ownership model (each doc has a responsible team)
4. AI agent instruction updates (reference Diátaxis structure)
5. Onboarding documentation that teaches the framework

---

## Consequences

### Positive

✅ **Clear decision rules**: No more "where should this doc go?" debates
✅ **User journey support**: Different personas find what they need faster
✅ **Scales to 500+ files**: Framework prevents chaos as documentation grows
✅ **Reduces duplication**: Clear purpose for each doc type prevents overlap
✅ **Industry-proven**: Battle-tested by major projects (Django, Cloudflare)
✅ **AI agent clarity**: Single source of truth, clear structure for Claude Code
✅ **Onboarding improvement**: New developers follow clear learning path
✅ **Maintainability**: Ownership and review processes become sustainable
✅ **Cross-project consistency**: Aligns with rebuild 6.0 practices

### Negative

⚠️ **Migration effort**: 248 files need review and potential relocation
- **Mitigation**: Phase 2 prioritizes P0-P1 (20 files = 80% of value)
- **Timeline**: 3-4 weeks for complete migration

⚠️ **Learning curve**: Team must learn Diátaxis principles
- **Mitigation**: 1-hour team workshop with examples
- **Mitigation**: ADR-001 and ADR-002 provide clear guidelines
- **Timeline**: Most devs understand framework in 2-3 hours

⚠️ **Initial friction**: Developers must think about doc purpose before writing
- **Mitigation**: Clear examples in docs/INDEX.md
- **Mitigation**: Code review checklist includes documentation placement
- **Benefit**: Friction forces intentional documentation (reduces duplication)

⚠️ **Existing links break**: URLs change during migration
- **Mitigation**: Track link updates in LINK_UPDATES_NEEDED.md
- **Mitigation**: Use relative paths where possible
- **Mitigation**: Create redirects for most-accessed documents

### Neutral

- Some documents may fit multiple quadrants (create clear primary location, cross-reference others)
- Framework is recommendation-based, not enforcement-based (trust over bureaucracy)
- Archive/ directory structure needs separate decision (see Phase 2)

---

## Validation & Testing

### Success Metrics

**Immediate (Week 1)**:
- [x] ADR-001 and ADR-002 written and accepted
- [ ] Diátaxis structure created in docs/
- [ ] INDEX.md updated with 4-quadrant navigation

**Short-term (Month 1)**:
- [ ] 20 most-accessed docs migrated to correct quadrants
- [ ] Zero new documentation placed in old ad-hoc categories
- [ ] Developer survey: 90%+ understand where to place new docs
- [ ] Onboarding time reduced from 2-3 hours to <1 hour

**Long-term (Quarter 1)**:
- [ ] Zero documentation drift (all new docs in correct quadrants)
- [ ] Duplication rate drops from 23% to <5%
- [ ] 50+ files properly organized without manual intervention
- [ ] AI agents reference correct documentation 95%+ of time

### Test Scenarios

**Scenario 1: New Developer Onboarding**
- Before: 2-3 hours, unclear where to start
- After: 30 minutes following tutorials/ directory

**Scenario 2: Experienced Dev Joining Project**
- Before: Read 10+ scattered docs, miss critical pieces
- After: Read explanation/adrs/ for context, reference/ for specifics

**Scenario 3: Support Engineer Troubleshooting**
- Before: Search across root/, server/, docs/, .claude/
- After: Go directly to how-to/troubleshooting/

**Scenario 4: AI Agent Documentation**
- Before: Claude Code references conflicting sources
- After: Claude Code instruction references Diátaxis structure explicitly

---

## Rollback Strategy

If Diátaxis proves ineffective:

1. **Immediate Rollback**: Revert to Nov 7, 2025 ad-hoc structure (git checkout 973eafe)
2. **Alternative Approach**: Try simpler 2-category split (User Docs / Developer Docs)
3. **Nuclear Option**: Flatten to single docs/ directory (last resort)

**Risk Assessment**: Low risk. Diátaxis is addition of structure, not removal of content. All existing files remain accessible during migration.

**Escape Criteria** (re-evaluate if these occur):
- Migration takes >6 weeks
- Developer satisfaction drops below current baseline
- Documentation drift continues despite framework

---

## Related Documentation

- **DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md**: Root cause analysis of documentation drift
- **docs/INDEX.md**: Primary navigation hub (to be updated with Diátaxis structure)
- **ADR-002**: Documentation naming standards (companion decision)
- **Rebuild 6.0**: docs/explanation/architecture-decisions/ (reference implementation)
- **Diátaxis Official**: https://diataxis.fr/ (framework documentation)

---

## Resources & Learning

### Diátaxis Framework
- **Official documentation**: https://diataxis.fr/
- **Video introduction**: "What nobody tells you about documentation" (PyCon talk)
- **Case studies**: Django, Cloudflare, Gatsby implementations

### Implementation Examples
- **Rebuild 6.0**: `/Users/mikeyoung/CODING/rebuild-6.0/docs/` (sister project)
- **Django**: https://docs.djangoproject.com/ (gold standard)
- **Cloudflare**: https://developers.cloudflare.com/ (scaled example)

---

## Lessons Learned (To Be Updated Quarterly)

### From Nov 7 Reorganization Failure
1. **Intuitive categories fail at scale**: 9 ad-hoc categories drifted in 5 days
2. **Framework > Organization**: Rebuild 6.0 has 17% more files but better structure
3. **Governance is critical**: Rules without enforcement = suggestions

### From Other Projects
1. **Diátaxis requires buy-in**: 1-hour workshop more effective than written guidelines
2. **Migration is ongoing**: Budget 10% of documentation time for continuous improvement
3. **Examples matter**: Show, don't tell (this ADR itself follows the framework)

---

## Approval

This ADR addresses a critical systemic issue (documentation drift) identified through:
- Git history analysis (Nov 7 reorganization failure)
- Comparative analysis (rebuild 6.0 success)
- Quantitative metrics (23% duplication, 30+ misplaced files)
- Industry best practices (Diátaxis adoption at scale)

**Decision validated through**:
- Rebuild 6.0's proven implementation (281 files, minimal drift)
- Industry adoption (Django, Cloudflare, 100+ projects)
- Root cause analysis (framework prevents drift better than intuition)

**Status**: ACCEPTED (2025-11-12)

---

**Revision History**:
- 2025-11-12: Initial version (v1.0) - Establishes Diátaxis as documentation framework
