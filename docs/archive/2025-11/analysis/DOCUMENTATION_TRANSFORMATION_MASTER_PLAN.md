# Documentation Transformation Master Plan

## Business Growth Club Positioning - November 2025

**Created:** November 19, 2025
**Purpose:** Guide systematic update of all documentation to reflect business growth club model
**Status:** Phase 1 (HIGH Priority) - In Progress

---

## Executive Summary

**The Challenge:** MAIS documentation contains ~740+ references to old business models (wedding/elopement booking, tenant management SaaS) across 139 files (74% of all markdown files).

**The Solution:** Phased documentation transformation prioritizing developer-facing docs, then technical guides, and preserving historical archives.

**The Goal:** New developers immediately understand MAIS is a **revenue-sharing business growth club**, not a traditional SaaS platform or property management tool.

---

## Business Model Evolution Timeline

### Original Model (Pre-2025): Wedding/Elopement Booking

- **Business:** Wedding venue booking platform
- **Target:** Wedding photographers, venues, planners
- **Value Prop:** Prevent double-booking, package management
- **Evidence:** 631 "wedding/elopement" references across 139 files

### First Pivot (Early 2025): Property/Tenant Management SaaS

- **Business:** Property management SaaS platform
- **Target:** Landlords, property managers
- **Value Prop:** Tenant screening, lease management, rent collection
- **Evidence:** 74 "tenant management" references across 31 files

### Current Model (November 2025): Business Growth Club

- **Business:** AI consulting & business growth partnerships
- **Target:** Solopreneurs, scaling startups, pivot artists
- **Revenue Model:** Revenue-sharing (small base fee + % of sales)
- **Value Prop:** AI consulting, scheduling/bookings, web design, marketing automation
- **Evidence:** README.md, CLAUDE.md, Home.tsx correctly reflect current model

---

## Audit Summary

**Total Files Scanned:** 187 markdown files
**Files with Old Terminology:** 139 files (74%)
**Total Old References:** ~740+ occurrences

### Breakdown by Type:

- **Wedding/Elopement:** 631 occurrences across 139 files
- **Tenant Management:** 74 occurrences across 31 files
- **Property Management:** 31 occurrences across 10 files
- **Landlord:** 5 occurrences across 3 files

### Priority Classification:

- **HIGH Priority:** 7 files (~20 references) - MUST UPDATE (developer onboarding)
- **MEDIUM Priority:** ~20 files (~200 references) - SHOULD UPDATE (technical docs)
- **LOW Priority:** ~112 files (~520 references) - ARCHIVE OR LEAVE AS-IS (historical records)

---

## Phase 1: HIGH Priority - Core Onboarding Docs (MUST UPDATE)

**Estimated Time:** 2-3 hours
**Impact:** Critical - Define project identity for new developers
**Status:** In Progress

### Files to Update:

#### 1. `/ARCHITECTURE.md` ✅ Specification Complete

**Changes Required:** 18 sections

- Update header: Remove "wedding booking platform"
- Replace wedding examples with generic "appointment booking"
- Update multi-tenant language: "tenant" → "member"
- Update commission terminology: → "revenue sharing"
- **Status:** Detailed specification complete, ready for implementation

#### 2. `/CONTRIBUTING.md` (Line 101)

**Changes Required:** 1 reference

- Update seed data description: "3 wedding packages" → "3 service packages"
- **Estimated Time:** 1 minute

#### 3. `/DEVELOPING.md` (Line 82)

**Changes Required:** 1 reference

- Update seed data description: "3 wedding packages" → "3 service packages"
- **Estimated Time:** 1 minute

#### 4. `/DECISIONS.md` (6 wedding references)

**Changes Required:** Multiple sections

- Update document header
- Update ADR-001 context: "wedding booking" → "appointment booking"
- Preserve technical reasoning (still valid)
- **Estimated Time:** 15 minutes

#### 5. `/CHANGELOG.md`

**Changes Required:** Add business model pivot entry

- Add entry documenting transformation to business growth club
- Preserve all historical entries (accurate historical record)
- **Estimated Time:** 5 minutes

#### 6. `/START_HERE.md` ✅ Specification Complete

**Changes Required:** Major rewrite (70% of content)

- Remove AI automation language
- Add business model context
- Create role-based onboarding paths
- **Status:** Detailed specification complete, ready for implementation

#### 7. `/README.md` ✅ COMPLETED

**Status:** Updated Nov 19, 2025

- Business model description: ✅ Complete
- Three pillars of growth: ✅ Complete
- Target members: ✅ Complete
- Examples still use "bellaweddings" (minor cleanup needed)

---

## Phase 2: MEDIUM Priority - Technical Documentation (SHOULD UPDATE)

**Estimated Time:** 4-6 hours
**Impact:** Medium - Developers reference these for implementation
**Status:** Planned

### API Documentation (10-15 references each)

- `/docs/api/API_DOCS_QUICKSTART.md` (10 wedding references)
- `/docs/api/API_DOCUMENTATION_COMPLETION_REPORT.md`

### Multi-Tenant Guides (9-12 references each)

- `/docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` (4 wedding references)
- `/docs/multi-tenant/MULTI_TENANT_ROADMAP.md` (12 wedding references)
- `/docs/multi-tenant/MULTI_TENANT_QUICK_START.md` (9 wedding references)
- `/docs/multi-tenant/TENANT_ADMIN_USER_GUIDE.md` (11 wedding references)

### Integration Guides

- `/GOOGLE_CALENDAR_IMPLEMENTATION_PLAN.md` (10 wedding references)
- `/docs/roadmaps/EMBEDDABLE_STOREFRONT_RESEARCH.md` (26 wedding references)
- `/docs/roadmaps/WIDGET_INTEGRATION_GUIDE.md` (8 wedding references)

### Client SDK Documentation

- `/client/public/SDK_README.md` (11 wedding references)
- `/client/public/USAGE_SNIPPETS.md` (16 wedding references)
- `/client/public/QUICK_START.md` (4 wedding references)

### Component Documentation

- `/client/src/lib/PACKAGE_PHOTO_API_README.md`
- `/client/src/components/PackagePhotoUploader.md`

---

## Phase 3: LOW Priority - Historical Archives (LEAVE AS-IS)

**Estimated Time:** 1 hour (archiving organization only)
**Impact:** Low - Historical record keeping
**Status:** Planned

### Approach:

1. **Keep as-is** - Most archived documents remain unchanged (accurate history)
2. **Add README** - Create `/docs/archive/README.md` explaining these reflect historical models
3. **Move landing page strategies** to archive:
   - `/MAIS_LANDING_PAGE_STRATEGY.md` → `/docs/archive/2025-11/planning/`
   - `/MAIS_CLUB_LANDING_PAGE_STRATEGY.md` → `/docs/archive/2025-11/planning/`
   - `/LANDING_PAGE_TRANSFORMATION_SUMMARY.md` → `/docs/archive/2025-11/planning/`

### Files to Leave Unchanged:

- All files in `/docs/archive/2025-11/**`
- All files in `/docs/archive/2025-10/**`
- All files in `/docs/archive/2025-01/**`
- All files in `/nov18scan/**` (meta-documentation about audit)
- Test output files (`/test-results/**`, `/playwright-report/**`)

---

## Terminology Migration Guide

### Replace These Terms:

| Old Term            | New Term                              | Context                           |
| ------------------- | ------------------------------------- | --------------------------------- |
| tenant management   | member partnership                    | Business model description        |
| property management | business growth services              | Value proposition                 |
| tenant              | member                                | Database entities, API parameters |
| tenantId            | memberId                              | Code variables, foreign keys      |
| X-Tenant-Key        | X-Member-Key                          | HTTP headers                      |
| commission          | revenue share / platform share        | Partnership model                 |
| commission rate     | revenue-sharing percentage            | Business terms                    |
| CommissionService   | RevenueSharingService                 | Service classes                   |
| packages            | service packages / service offerings  | Product catalog                   |
| wedding booking     | appointment booking / service booking | Examples                          |
| wedding packages    | service packages                      | Seed data, examples               |
| landlord            | business owner                        | User roles                        |
| property manager    | entrepreneur / solopreneur            | Target audience                   |
| lease               | service agreement                     | Contracts                         |

### When to Preserve Old Terms:

**DO NOT change these contexts:**

- Historical documents in `/docs/archive/**`
- Git commit messages (historical record)
- CHANGELOG.md entries (factual history)
- Migration file names (`/server/prisma/migrations/**`)
- Test snapshots (would break tests)
- Comments explaining historical decisions

---

## Implementation Strategy

### Week 1: Foundation (HIGH Priority)

**Days 1-2:**

- ✅ Update README.md (COMPLETE)
- ✅ Update CLAUDE.md (COMPLETE)
- 🔲 Update ARCHITECTURE.md (Specification ready)
- 🔲 Update CONTRIBUTING.md (Quick fix)
- 🔲 Update DEVELOPING.md (Quick fix)

**Days 3-4:**

- 🔲 Update DECISIONS.md
- 🔲 Update START_HERE.md (Major rewrite)
- 🔲 Add CHANGELOG.md entry

**Day 5:**

- 🔲 Create Documentation Maintenance Guide
- 🔲 Team review & feedback

### Week 2-3: Technical Depth (MEDIUM Priority)

**Incremental approach:**

- Update 2-3 technical docs per day
- Prioritize actively-used guides first
- Test examples as you update them
- Get code reviews on technical changes

### Week 4: Organization (LOW Priority)

- Create `/docs/archive/README.md`
- Move old landing page strategies to archive
- Run final audit to verify terminology consistency

---

## Success Criteria

### Short-Term (Week 1)

- [ ] New developers read README.md and understand business growth club model
- [ ] ARCHITECTURE.md accurately reflects current business model
- [ ] START_HERE.md provides clear onboarding path
- [ ] No confusion about "tenant management" in core docs

### Medium-Term (Month 1)

- [ ] All actively-used technical documentation updated
- [ ] API examples use business-neutral scenarios
- [ ] Multi-tenant guides use "member" terminology
- [ ] SDK documentation reflects current model

### Long-Term (Quarter 1)

- [ ] Documentation maintenance becomes routine (update docs when changing code)
- [ ] New developers understand business context within first day
- [ ] Technical decisions align with business growth goals
- [ ] Archive properly organized with clear historical context

---

## Risk Mitigation

### Risk 1: Breaking Existing References

**Issue:** Other docs/scripts may reference old file paths or terminology
**Mitigation:**

- Use global search before renaming files
- Update cross-references in same PR
- Test all documentation links after changes

### Risk 2: Team Confusion During Transition

**Issue:** Team members may be used to old terminology
**Mitigation:**

- Announce changes in team communication
- Provide terminology cheat sheet
- Keep old versions in archive for reference
- Update incrementally, not all at once

### Risk 3: Incomplete Business Model Understanding

**Issue:** Some business details may not be fully documented
**Mitigation:**

- Create dedicated BUSINESS_MODEL.md if needed
- Interview business stakeholders to clarify revenue model
- Document assumptions clearly

### Risk 4: Code-Documentation Drift

**Issue:** Updating docs but not updating code variable names
**Mitigation:**

- Phase approach: Docs first, then code refactoring
- Clear separation: "Conceptual naming" vs "implementation naming"
- Add TODO comments in code for future refactoring

---

## Future-Proofing Strategy

### 1. Documentation Maintenance Ritual

**When to update docs:**

- [ ] When adding new features (document business context)
- [ ] When fixing bugs (update examples if they use old terminology)
- [ ] When onboarding new developers (note confusion points)
- [ ] Quarterly doc review (scan for drift)

### 2. Automated Checks

**Potential tooling:**

```bash
# Scan for old terminology in new commits
git diff --cached | grep -i "wedding\|elopement\|tenant management"

# Pre-commit hook to flag old terms
# .git/hooks/pre-commit
```

### 3. Living Glossary

**Create `/docs/GLOSSARY.md`:**

- Current terminology (authoritative source)
- Deprecated terms (with migration notes)
- Business concepts (revenue-sharing, club membership)
- Technical terms (multi-tenant, memberId scoping)

### 4. Onboarding Feedback Loop

**After each new developer onboards:**

- Survey: "What was confusing about the docs?"
- Document: Add clarifications to START_HERE.md
- Iterate: Improve based on real feedback

---

## Tools & Resources

### Automated Scanning

```bash
# Find all wedding/elopement references
grep -r -i "wedding\|elopement" --include="*.md" . | wc -l

# Find all tenant management references
grep -r -i "tenant management\|property manag" --include="*.md" .

# Find old example names
grep -r "bellaweddings\|bella-weddings" --include="*.md" .

# Check code for old terminology
grep -r "wedding\|elopement" --include="*.ts" --include="*.tsx" server/ client/
```

### Replace Patterns (Use with caution)

```bash
# Example: Replace in specific file
sed -i '' 's/tenant management/member partnership/g' FILE.md

# Always review changes before committing!
git diff
```

### Documentation Quality Checks

```bash
# Check for broken internal links
npm run check-docs-links  # (if we add this script)

# Validate markdown formatting
npx markdownlint-cli2 "**/*.md"

# Spell check
npx cspell "**/*.md"
```

---

## Communication Plan

### Internal Team Announcement

**Subject:** Documentation Transformation - Business Growth Club Model

**Message:**

> Team, we're systematically updating all documentation to reflect our current business model as a **business growth club with revenue-sharing partnerships**.
>
> **Why this matters:**
>
> - New developers will understand our business context immediately
> - Technical decisions will align with business goals
> - We'll reduce confusion from outdated "tenant management" language
>
> **What's changing:**
>
> - "Tenant" → "Member" (our club members are entrepreneurs, not property tenants)
> - "Commission" → "Revenue sharing" (partnership language)
> - "Packages" → "Service packages" (consulting, websites, bookings)
>
> **Timeline:**
>
> - Week 1: Core docs (README, ARCHITECTURE, CLAUDE.md) ✅ Mostly done
> - Week 2-3: Technical guides (API docs, multi-tenant guides)
> - Week 4: Archive organization
>
> **You can help:**
>
> - When you touch a doc, update old terminology
> - Report confusion to Mike
> - Review PRs for doc updates
>
> Questions? See DOCUMENTATION_TRANSFORMATION_MASTER_PLAN.md

### External Communication (Future)

**For open-source contributors or new developers:**

- Add note to README.md about recent business model shift
- Update CONTRIBUTING.md with terminology expectations
- Include in onboarding checklist

---

## Metrics & Tracking

### Phase 1 Progress (HIGH Priority)

- [x] README.md updated (100%)
- [x] CLAUDE.md updated (100%)
- [ ] ARCHITECTURE.md updated (0%) - Specification ready
- [ ] CONTRIBUTING.md updated (0%)
- [ ] DEVELOPING.md updated (0%)
- [ ] DECISIONS.md updated (0%)
- [ ] START_HERE.md updated (0%) - Specification ready
- [ ] CHANGELOG.md updated (0%)

**Overall Phase 1 Completion:** 28% (2/7 files)

### Phase 2 Progress (MEDIUM Priority)

- Not yet started

### Phase 3 Progress (LOW Priority)

- Not yet started

---

## Appendix: Detailed File Inventory

### HIGH Priority Files (7 files)

1. `/README.md` - 7 wedding references
2. `/ARCHITECTURE.md` - 5 wedding references
3. `/CLAUDE.md` - 1 reference (create-tenant comment)
4. `/DECISIONS.md` - 6 wedding references
5. `/CONTRIBUTING.md` - 1 wedding reference
6. `/DEVELOPING.md` - 1 wedding reference
7. `/START_HERE.md` - No old terminology (but major rewrite needed for business context)

### MEDIUM Priority Files (~20 files)

See "Phase 2" section above for complete list

### LOW Priority Files (~112 files)

See "Phase 3" section above for archival strategy

---

## Conclusion

This documentation transformation is a **strategic investment** in developer productivity and business alignment. By systematically updating documentation from old business models (wedding/elopement, tenant management) to the current **business growth club** model, we:

1. **Reduce onboarding confusion** - New developers understand the business immediately
2. **Improve technical decisions** - Features align with business goals
3. **Build trust with members** - Consistent messaging across docs and product
4. **Future-proof the codebase** - Documentation reflects reality

**Next Steps:**

1. Review this plan with team
2. Execute Phase 1 (HIGH priority) this week
3. Schedule Phase 2 (MEDIUM priority) over next 2-3 weeks
4. Create Documentation Maintenance Guide for ongoing updates

**Remember:** Documentation is not a one-time task - it's an ongoing commitment to clarity and alignment. Every doc update is an investment in our team's effectiveness and our members' success.

---

**Document Version:** 1.0
**Last Updated:** November 19, 2025
**Owner:** Development Team
**Next Review:** December 15, 2025
