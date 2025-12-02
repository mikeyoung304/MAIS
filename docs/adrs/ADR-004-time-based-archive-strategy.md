# ADR-004: Time-Based Archive Strategy

**Status**: Accepted
**Date**: 2025-11-12
**Last Updated**: 2025-11-12
**Deciders**: Tech Lead, Documentation Systems Specialist
**Related**: ADR-002 (Naming Standards), ADR-003 (Sprint Lifecycle), ADR-005 (Security Review)

---

## Context

MAIS's documentation archive is disorganized with severe chronological inconsistencies that undermine its usefulness for historical research and compliance tracking.

### Current Archive Problems

**1. Chronological Mislabeling (Critical Issue)**

```
docs/archive/oct-22-analysis/
├── 2025-10-06-catalog-query-deep-dive.md      (October 2025, not 2022!)
├── 2025-10-10-repository-test-failures.md     (October 2025, not 2022!)
├── catalog-service-bugs-investigation.md      (October 2025)
└── (8 more files, all from October 2025)
```

**Problem**: `oct-22` ambiguously means:
- October 22nd, 2023?
- October 22nd, 2022?
- October, year '22 (2022)?
- October 2022?

**Actual meaning**: October 2025 (3-year misdating!)

**Impact**:
- Historical research fails (looking for "2025 work" misses oct-22-analysis/)
- Compliance risk (audit trails mislabeled by 3 years)
- Developer confusion ("Why is 2025 work in oct-22 directory?")
- AI agent temporal reasoning broken (Claude Code thinks oct-22 = old data)

**2. Inconsistent Archive Structure**

```
docs/archive/
├── oct-22-analysis/              (ambiguous month-day format)
├── october-2025-analysis/        (spelled-out month format)
├── cache-investigation/          (no date at all)
├── phase-3/                      (no date, unclear phase of what)
├── overnight-runs/               (no date, what night?)
├── sprints/                      (no date, mixed Sprint 2-3)
├── test-reports/                 (no date, which tests, when?)
└── client-reports/               (no date, which client, when?)
```

**Problem**: 7+ different organizational schemes with no consistent pattern.

**3. No Archival Rules or Triggers**

Questions with no clear answers:
- When should documentation be archived? (30 days? 90 days? never?)
- What triggers archival? (project completion? sprint end? arbitrary decision?)
- Who is responsible for archiving? (document author? sprint lead? nobody?)
- How to organize archives? (by date? by project? by topic? mixed?)

**Result**: Ad-hoc archiving decisions, inconsistent structure, lost historical context.

### Real-World Consequences

**Incident 1: Lost Audit Trail (October 2025)**
- Compliance team requested "all architecture decisions from 2025"
- Missed ADRs in oct-22-analysis/ (assumed it was 2022 data)
- Had to manually grep entire project to rebuild timeline

**Incident 2: Duplicate Investigation (November 2025)**
- Developer investigated catalog bug for 4 hours
- Complete analysis already existed in cache-investigation/ (no date, not discovered)
- Wasted 4 hours redoing work because archive wasn't discoverable

**Incident 3: Sprint Retrospective Failure (November 2025)**
- Sprint 6 retrospective needed Sprint 4-5 context
- Sprint 4-5 docs scattered across root/, docs/sprints/, .claude/, docs/archive/sprints/
- Took 45 minutes to assemble complete picture (should take 5 minutes)

### Comparative Evidence: Rebuild 6.0 Archive Success

Rebuild 6.0 uses **strict ISO 8601 date-based archives** with zero ambiguity:

```
docs/archive/
├── 2025-08/
│   ├── sprints/
│   ├── investigations/
│   └── decisions/
├── 2025-09/
│   ├── sprints/
│   ├── investigations/
│   └── decisions/
├── 2025-10/
│   ├── sprints/
│   ├── investigations/
│   └── decisions/
└── 2025-11/
    ├── sprints/
    ├── investigations/
    └── decisions/
```

**Benefits**:
- **Chronological clarity**: 2025-10 unambiguously means October 2025
- **Automatic sorting**: File system sorts YYYY-MM naturally
- **Historical research**: "Show me all Q4 2025 work" = ls docs/archive/2025-{10,11,12}
- **Compliance-ready**: Audit trail organized by month (ISO 8601 standard)
- **Predictable paths**: Script-friendly (construct path programmatically)

**Result**: 18 months of archives, zero temporal confusion, 5-second historical lookups.

---

## Decision

**Adopt ISO 8601 date-based archive structure** with consistent categorization and clear archival triggers for all MAIS documentation.

### Archive Structure: docs/archive/YYYY-MM/category/

**Top-Level Structure**:
```
docs/archive/
├── 2025-10/                    # October 2025
│   ├── sprints/
│   ├── investigations/
│   ├── decisions/
│   ├── incidents/
│   └── reports/
├── 2025-11/                    # November 2025
│   ├── sprints/
│   ├── investigations/
│   ├── decisions/
│   ├── incidents/
│   └── reports/
└── 2025-12/                    # December 2025 (future)
    ├── sprints/
    ├── investigations/
    ├── decisions/
    ├── incidents/
    └── reports/
```

**Date Format**: `YYYY-MM/` (ISO 8601 year-month)
- `2025-10/` = October 2025
- `2025-11/` = November 2025
- `2026-01/` = January 2026

**Categories** (subdirectories within each month):

1. **sprints/**: Completed sprint documentation
   - Sprint plans, retrospectives, session reports
   - Archive trigger: 90 days after sprint completion (per ADR-003)

2. **investigations/**: Technical investigations and deep-dives
   - Bug analysis, performance debugging, root cause analysis
   - Archive trigger: Investigation complete and findings documented

3. **decisions/**: Superseded or context-specific decisions
   - Not ADRs (those never archive)
   - Temporary technical decisions, spike reports
   - Archive trigger: Decision implemented or superseded

4. **incidents/**: Incident reports and postmortems
   - Outages, security incidents, data issues
   - Archive trigger: Incident resolved and postmortem complete

5. **reports/**: Status reports, metrics, and summaries
   - Weekly status reports, test run summaries, progress reports
   - Archive trigger: Reporting period ends

### File Naming in Archives

All archived files must follow ADR-002 naming standard:

**Format**: `YYYY-MM-DD-kebab-case-description.md`

**Examples**:
```
docs/archive/2025-11/sprints/
├── 2025-11-01-sprint-4-handoff.md
├── 2025-11-01-sprint-4-retrospective.md
├── 2025-11-08-sprint-5-complete-summary.md
└── 2025-11-12-sprint-6-phase-2-report.md

docs/archive/2025-10/investigations/
├── 2025-10-06-catalog-query-deep-dive.md
├── 2025-10-10-repository-test-failures.md
├── 2025-10-15-cache-invalidation-bug.md
└── 2025-10-22-race-condition-analysis.md

docs/archive/2025-11/incidents/
├── 2025-11-03-database-connection-pool-exhaustion.md
├── 2025-11-07-stripe-webhook-timeout.md
└── 2025-11-15-auth-service-outage-postmortem.md
```

**Date Meaning**:
- Use completion date (not start date) for consistency
- Sprint 4 completes Nov 1 → 2025-11-01-sprint-4-*
- Investigation finishes Oct 22 → 2025-10-22-investigation-name.md
- Incident occurs Nov 15 → 2025-11-15-incident-description.md

### Archival Triggers and Rules

| Content Type | Archive Trigger | Archive Location | Archive Timing |
|--------------|----------------|------------------|----------------|
| Sprint docs | Sprint completion + 90 days | archive/YYYY-MM/sprints/ | Quarterly review |
| Investigations | Investigation complete | archive/YYYY-MM/investigations/ | Immediately after completion |
| Incident reports | Postmortem complete | archive/YYYY-MM/incidents/ | Within 1 week of resolution |
| Status reports | Reporting period ends | archive/YYYY-MM/reports/ | Monthly |
| Technical decisions | Decision implemented | archive/YYYY-MM/decisions/ | Immediately after implementation |

**Special Cases**:

**Never Archive**:
- ADRs (Architecture Decision Records) - these are permanent reference
- Tutorials, How-To Guides, Reference docs - stable content (Diátaxis framework)
- Active project documentation - only archive when project/phase completes

**Immediate Archive** (don't wait):
- Security incident postmortems (per ADR-005 security requirements)
- Compliance-related reports (legal/audit requirements)
- Completed investigations (declutter active workspace)

**Quarterly Archive** (during documentation health audit):
- Sprint documentation (90 days after completion per ADR-003)
- Old status reports (>30 days old)
- Superseded technical decisions

### Archive Path Construction

**Deterministic Path Construction** (scriptable):

```bash
# Given: document completion date and category
COMPLETION_DATE="2025-11-12"
CATEGORY="sprints"
FILENAME="sprint-6-summary.md"

# Construct archive path
YEAR_MONTH="${COMPLETION_DATE:0:7}"  # Extract YYYY-MM
ARCHIVE_PATH="docs/archive/${YEAR_MONTH}/${CATEGORY}/${COMPLETION_DATE}-${FILENAME}"

# Result: docs/archive/2025-11/sprints/2025-11-12-sprint-6-summary.md
```

**Benefits**:
- Scripts can construct paths without human input
- No ambiguity in path selection
- Consistent for all document types
- Future-proof (works in 2026, 2027, ...)

---

## Rationale

### Why ISO 8601 YYYY-MM Format?

**ISO 8601 is international standard** for date representation:
- Unambiguous: 2025-11 always means November 2025
- Sortable: Lexicographic sort = chronological sort
- Machine-readable: All systems recognize YYYY-MM-DD format
- Compliance-ready: Legal/audit systems expect ISO 8601

**Comparison to Alternatives**:

| Format | Example | Ambiguity | Sortable | Compliance |
|--------|---------|-----------|----------|------------|
| ISO 8601 | 2025-11 | ✅ None | ✅ Yes | ✅ Yes |
| Month-YY | oct-22 | ❌ 3 interpretations | ❌ No | ❌ No |
| Spelled out | october-2025 | ✅ Clear | ❌ Sorts after november | ❌ Non-standard |
| MM-YYYY | 11-2025 | ⚠️ US vs EU confusion | ❌ No | ⚠️ Non-standard |
| YYYYMMDD | 20251112 | ✅ Clear | ✅ Yes | ❌ Not readable |

**Verdict**: ISO 8601 YYYY-MM balances clarity, sortability, and compliance.

### Why Month-Level Granularity (Not Day or Year)?

**Month is optimal granularity for documentation archives**:

**Too Coarse (Year-Level)**:
```
❌ docs/archive/2025/
   └── (100+ files in one directory = unmanageable)
```
- 12 months of documents in one directory
- Slow to browse (100+ files)
- Can't answer "show me Q4 work" without grepping

**Too Fine (Day-Level)**:
```
❌ docs/archive/2025-11-12/
   └── (365 directories per year = excessive)
```
- Most days have 0-2 archived documents
- Excessive directory creation overhead
- Difficult to browse by time period

**Just Right (Month-Level)**:
```
✅ docs/archive/2025-11/
   ├── sprints/
   ├── investigations/
   └── reports/
```
- 10-30 files per month per category (manageable)
- Natural time period for retrospectives (monthly, quarterly)
- Aligns with business cycles (monthly reports, quarterly reviews)

**Data Supporting Month-Level**:
- Analysis of rebuild 6.0: Average 15 files per category per month
- Too few for day-level (0.5 files/day), too many for year-level (180 files/year)
- Business cycles operate on month/quarter (not day/year)

### Why Category Subdirectories?

**Category subdirectories prevent mixing unrelated content**:

**Without Categories** (flat by month):
```
❌ docs/archive/2025-11/
   ├── 2025-11-01-sprint-4-retrospective.md
   ├── 2025-11-03-database-incident.md
   ├── 2025-11-08-sprint-5-summary.md
   ├── 2025-11-12-cache-investigation.md
   └── (30+ mixed files)
```
- Can't filter by type (show me all incidents)
- 30+ files in flat list = hard to scan
- Mixed content types reduce clarity

**With Categories** (organized by type):
```
✅ docs/archive/2025-11/
   ├── sprints/
   │   ├── 2025-11-01-sprint-4-retrospective.md
   │   └── 2025-11-08-sprint-5-summary.md
   ├── incidents/
   │   └── 2025-11-03-database-incident.md
   └── investigations/
       └── 2025-11-12-cache-investigation.md
```
- Filter by type: ls docs/archive/2025-11/incidents/
- Organized by purpose (sprints, incidents, investigations)
- Easy to scan (5-10 files per category)

**Category Benefits**:
- Type-based filtering (show all incidents across all months)
- Parallel structure across months (every month has same categories)
- Supports different retention policies (keep incidents 7 years, sprints 2 years)

### Why Completion Date (Not Start Date)?

**Completion date provides consistent archival point**:

**Problem with Start Date**:
```
Sprint 6 starts Nov 1, 2025
Sprint 6 runs 4 weeks
Sprint 6 completes Nov 29, 2025

Archive by start date: docs/archive/2025-11/sprints/
Archive by completion: docs/archive/2025-11/sprints/

Sprint 7 starts Nov 22, 2025 (overlaps Sprint 6!)
Sprint 7 completes Dec 20, 2025

Archive by start date: docs/archive/2025-11/sprints/ (same as Sprint 6)
Archive by completion: docs/archive/2025-12/sprints/ (different)
```

**Start date problem**: Overlapping work goes to same archive month (confusing).

**Completion date advantage**: Work archived when truly complete (clear).

**Edge Case Handling**:
- Long-running projects: Archive by phase completion, not overall project completion
- Cancelled projects: Archive by cancellation date
- Abandoned work: Archive after 90 days of inactivity

---

## Alternatives Considered

### Alternative 1: Topic-Based Archives (No Dates)

**Description**: Organize archives by topic, not time

```
docs/archive/
├── sprints/
│   ├── sprint-4/
│   ├── sprint-5/
│   └── sprint-6/
├── performance/
│   ├── cache-investigation/
│   └── query-optimization/
└── incidents/
    ├── database-outage/
    └── stripe-timeout/
```

**Pros**:
- Content grouped by topic (all sprints together)
- Easy to find all work on specific topic
- Familiar structure (many projects use this)

**Cons**:
- ❌ No chronological organization (can't answer "show me Q4 2025 work")
- ❌ Doesn't solve oct-22 ambiguity (still no dates in structure)
- ❌ Historical research requires checking multiple topic directories
- ❌ Compliance risk (audit trails not chronologically organized)
- ❌ Doesn't scale (20 sprints = 20 subdirectories under sprints/)

**Why Rejected**: Doesn't support chronological queries, which are critical for retrospectives, audits, and historical research.

### Alternative 2: Year-Only Archives

**Description**: Organize by year, not month

```
docs/archive/
├── 2025/
│   ├── sprints/
│   ├── investigations/
│   └── incidents/
└── 2026/
    ├── sprints/
    ├── investigations/
    └── incidents/
```

**Pros**:
- Simpler structure (fewer directories)
- Works well for multi-year projects
- Clear year boundaries

**Cons**:
- ❌ Poor granularity (12 months in one directory)
- ❌ Can't answer "show me Q4 work" without grepping files
- ❌ Large directories (100+ files per category per year)
- ❌ Doesn't align with business cycles (monthly/quarterly reviews)

**Why Rejected**: Too coarse. Month-level granularity better matches documentation volume and business cycles.

### Alternative 3: Quarter-Based Archives

**Description**: Organize by fiscal quarters

```
docs/archive/
├── 2025-Q3/
│   ├── sprints/
│   ├── investigations/
│   └── incidents/
└── 2025-Q4/
    ├── sprints/
    ├── investigations/
    └── incidents/
```

**Pros**:
- Aligns with business quarterly reviews
- Fewer directories than month-level
- Natural for quarterly retrospectives

**Cons**:
- ❌ Quarter boundaries arbitrary (Q1 ends March 31, but sprint might end April 2)
- ❌ 3 months of documents in one directory (30-50 files)
- ❌ Can't answer "show me November work" without checking Q4
- ❌ Quarter numbering varies (fiscal vs calendar quarters)

**Why Rejected**: Month-level provides better granularity without significantly increasing directory count. Quarterly queries still easy (ls docs/archive/2025-{10,11,12}).

### Alternative 4: Dated Directories Without Categories

**Description**: Use YYYY-MM but no category subdirectories

```
docs/archive/
├── 2025-10/
│   ├── 2025-10-01-sprint-4-plan.md
│   ├── 2025-10-06-cache-investigation.md
│   ├── 2025-10-10-test-failures.md
│   └── (30+ mixed files)
└── 2025-11/
    ├── 2025-11-01-sprint-4-retrospective.md
    ├── 2025-11-03-database-incident.md
    └── (30+ mixed files)
```

**Pros**:
- Simpler structure (fewer directories)
- All month's work in one place
- Easy to browse by month

**Cons**:
- ❌ Can't filter by type (show me all incidents)
- ❌ 30+ files per month in flat list (hard to scan)
- ❌ Mixed content types reduce clarity
- ❌ Doesn't support type-specific retention policies

**Why Rejected**: Category subdirectories provide valuable organization without significant complexity cost.

### Alternative 5: Status Quo (Ad-Hoc Archives)

**Description**: Continue current practice, let developers archive intuitively

**Pros**:
- No implementation cost (already happening)
- No migration needed
- Maximum flexibility

**Cons**:
- ❌ Already failed (oct-22-analysis/ contains 2025 files = 3-year misdating)
- ❌ 7+ different archive structures (no consistency)
- ❌ Historical research impossible (can't find 2025 work systematically)
- ❌ Compliance risk (audit trails mislabeled)
- ❌ AI agent confusion (temporal reasoning broken)

**Why Rejected**: Root cause of current problem. Status quo is unsustainable and creates compliance risk.

---

## Consequences

### Positive Consequences

✅ **Chronological clarity**: YYYY-MM eliminates all date ambiguity (no more oct-22 confusion)
✅ **Automatic sorting**: File system sorts chronologically (ls shows oldest to newest)
✅ **Historical research**: "Show me Q4 2025 work" = ls docs/archive/2025-{10,11,12}/
✅ **Compliance-ready**: ISO 8601 audit trails meet legal/regulatory standards
✅ **Predictable paths**: Scripts can construct archive paths deterministically
✅ **Type-based filtering**: Category subdirectories enable filtering (show all incidents)
✅ **Scalable structure**: Handles 10+ years without degradation (120 month directories)
✅ **Business cycle alignment**: Monthly archives match reporting and review cycles
✅ **AI agent clarity**: Temporal reasoning works correctly (2025-11 = November 2025)
✅ **Cross-project consistency**: Aligns with rebuild 6.0 proven archive strategy

### Negative Consequences

⚠️ **Migration effort**: Existing archives need reorganization
- **Scope**: oct-22-analysis/, cache-investigation/, phase-3/, etc.
- **Mitigation**: Migration script automates file movement
- **Mitigation**: Priority-based migration (P0 oct-22 first, P2 others later)
- **Effort**: ~4 hours to migrate existing archives

⚠️ **More directories**: Month-level granularity creates 12 directories per year
- **Counterpoint**: 12 directories far more manageable than 100+ files in one directory
- **Counterpoint**: Standard practice (rebuild 6.0, most time-based archives)
- **Mitigation**: Directories created on-demand (only create 2025-11 when needed)

⚠️ **Archive discipline required**: Must determine completion date and category
- **Risk**: Developers archive with wrong date or category
- **Mitigation**: Archive script prompts for date and category
- **Mitigation**: Code review validates archive location
- **Mitigation**: Quarterly audit catches misfiled archives

⚠️ **Link breakage**: Moving files to dated archives breaks existing links
- **Risk**: Internal documentation links break during migration
- **Mitigation**: Track all link updates in LINK_UPDATES_NEEDED.md
- **Mitigation**: Create redirect/notice in old location
- **Mitigation**: Use relative paths where possible

⚠️ **Year rollover complexity**: January 2026 archives in new year directory
- **Risk**: Confusion about where December 2025 vs January 2026 archives go
- **Mitigation**: Clear rules (use completion month, even if spans year boundary)
- **Mitigation**: Document year rollover explicitly in archive README

### Neutral Consequences

- Some edge cases (multi-month projects) require judgment on archive month
- Archives grow over time (manageable with standard disk space)
- Git history shows file movements (use `git log --follow` to track)
- Empty category directories okay (not all months have all types)

---

## Implementation

### Phase 1: Create Archive Structure (Week 1)

**Tasks**:

1. **Create current and upcoming month directories**:
```bash
mkdir -p docs/archive/2025-11/{sprints,investigations,decisions,incidents,reports}
mkdir -p docs/archive/2025-12/{sprints,investigations,decisions,incidents,reports}
```

2. **Create archive README template**:
```bash
# docs/archive/YYYY-MM/README.md template
cat > docs/archive/ARCHIVE_README_TEMPLATE.md << 'EOF'
# Archive for YYYY-MM

## Summary
Brief overview of significant work completed this month.

## Sprints
- Sprint N: [Brief description]
- Sprint N+1: [Brief description]

## Investigations
- [Investigation name]: [Brief outcome]

## Incidents
- [Incident date]: [Brief description and resolution]

## Reports
- [Report type]: [Coverage period]
EOF
```

3. **Create migration script**: `scripts/archive-document.sh`

```bash
#!/bin/bash
# Archive a document to ISO 8601 date-based structure
# Usage: ./archive-document.sh <file> <completion-date> <category>

FILE=$1
COMPLETION_DATE=$2  # YYYY-MM-DD format
CATEGORY=$3         # sprints, investigations, decisions, incidents, reports

if [ -z "$FILE" ] || [ -z "$COMPLETION_DATE" ] || [ -z "$CATEGORY" ]; then
    echo "Usage: $0 <file> <completion-date> <category>"
    echo "Example: $0 SPRINT_4_PLAN.md 2025-11-01 sprints"
    exit 1
fi

# Extract YYYY-MM from completion date
YEAR_MONTH="${COMPLETION_DATE:0:7}"

# Construct archive path
ARCHIVE_DIR="docs/archive/$YEAR_MONTH/$CATEGORY"
mkdir -p "$ARCHIVE_DIR"

# Convert filename to lowercase kebab-case and add date prefix
BASENAME=$(basename "$FILE" .md)
LOWERCASE=$(echo "$BASENAME" | tr '[:upper:]_' '[:lower:]-')
NEW_NAME="${COMPLETION_DATE}-${LOWERCASE}.md"

# Move file
mv "$FILE" "$ARCHIVE_DIR/$NEW_NAME"

echo "✅ Archived: $FILE"
echo "   → $ARCHIVE_DIR/$NEW_NAME"
```

4. **Update docs/INDEX.md** with archive section:

```markdown
## Archive

Historical documentation organized by completion date (ISO 8601).

**Structure**: `docs/archive/YYYY-MM/category/YYYY-MM-DD-description.md`

**Categories**:
- `sprints/`: Completed sprint documentation
- `investigations/`: Technical deep-dives and bug analysis
- `decisions/`: Superseded or context-specific decisions
- `incidents/`: Incident reports and postmortems
- `reports/`: Status reports and summaries

**Finding Archived Content**:
```bash
# All work from November 2025
ls docs/archive/2025-11/

# All sprint retrospectives from Q4 2025
ls docs/archive/2025-{10,11,12}/sprints/*retrospective*

# All incidents from 2025
find docs/archive/2025-*/incidents/ -type f
```
```

**Success Criteria**:
- [x] ADR-004 written and accepted
- [ ] Archive directory structure created (2025-11, 2025-12)
- [ ] Migration script tested and validated
- [ ] INDEX.md updated with archive documentation

### Phase 2: Migrate Priority Archives (Week 1-2)

**Priority Order**:

**P0 - Critical Mislabeling (Day 1-2)**:

```bash
# oct-22-analysis/ → 2025-10/investigations/
./scripts/archive-document.sh \
    docs/archive/oct-22-analysis/catalog-query-deep-dive.md \
    2025-10-06 \
    investigations

# Repeat for all 10 files in oct-22-analysis/
# Result: docs/archive/2025-10/investigations/2025-10-*
```

**P1 - Undated Archives (Week 1)**:

```bash
# cache-investigation/ → 2025-10/investigations/ or 2025-11/investigations/
# (determine actual completion date from git history)
git log --follow -- docs/archive/cache-investigation/

# phase-3/ → 2025-10/decisions/ or 2025-11/decisions/
# (determine phase completion date)

# overnight-runs/ → 2025-11/reports/
# (determine date from file timestamps)
```

**P2 - Sprint Archives (Week 1-2)**:

```bash
# docs/archive/sprints/SPRINT_2_* → 2025-08/sprints/
# docs/archive/sprints/SPRINT_3_* → 2025-09/sprints/
# (determine completion dates from git history and content)
```

**P3 - Remaining Archives (Week 2)**:

```bash
# test-reports/ → 2025-11/reports/
# client-reports/ → 2025-11/reports/
# planning/ → 2025-10/decisions/ or appropriate category
```

**Migration Commands**:

```bash
# Step 1: Identify all undated archives
find docs/archive/ -maxdepth 1 -type d | grep -v "^docs/archive/2025-"

# Step 2: For each, determine date from git history
for dir in $(find docs/archive/ -maxdepth 1 -type d | grep -v "^docs/archive/2025-"); do
    echo "Analyzing: $dir"
    git log --diff-filter=A --format="%ai" -- "$dir" | head -1
done

# Step 3: Archive using script (manual review of dates)
./scripts/archive-document.sh <file> <date> <category>

# Step 4: Verify migration
find docs/archive/2025-* -type f | wc -l  # Count migrated files
```

### Phase 3: Archive Validation (Week 2)

**Validation Checklist**:

1. **Verify all files have ISO 8601 dates**:
```bash
# Should return 0 files
find docs/archive/ -type f -not -name "2025-*" -not -name "README.md"
```

2. **Verify all directories follow YYYY-MM pattern**:
```bash
# Should only show YYYY-MM directories
ls -d docs/archive/*/ | grep -v "2025-[0-9][0-9]"
```

3. **Verify all categories exist**:
```bash
# Check each month has standard categories
for month in docs/archive/2025-*/; do
    echo "Checking $month"
    for cat in sprints investigations decisions incidents reports; do
        [ ! -d "$month/$cat" ] && echo "  Missing: $cat"
    done
done
```

4. **Verify file naming convention**:
```bash
# All archived files should match YYYY-MM-DD-kebab-case.md
find docs/archive/2025-* -type f -name "*.md" | \
    grep -v "^docs/archive/2025-[0-9][0-9]/.*/2025-[0-9][0-9]-[0-9][0-9]-.*\.md$"
# Should return only README.md files
```

5. **Create validation script**: `scripts/validate-archives.sh`

```bash
#!/bin/bash
# Validate archive structure and naming conventions

ERRORS=0

echo "Validating archive structure..."

# Check for non-ISO directories
NON_ISO=$(find docs/archive/ -maxdepth 1 -type d | \
          grep -v "docs/archive/$" | \
          grep -v "docs/archive/2[0-9][0-9][0-9]-[0-9][0-9]/$")
if [ -n "$NON_ISO" ]; then
    echo "❌ Non-ISO directories found:"
    echo "$NON_ISO"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ All directories use ISO 8601 format"
fi

# Check for files without date prefixes
UNDATED=$(find docs/archive/2[0-9][0-9][0-9]-[0-9][0-9]/ -type f -name "*.md" | \
          grep -v "README.md" | \
          grep -v "^docs/archive/2[0-9][0-9][0-9]-[0-9][0-9]/.*/2[0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-")
if [ -n "$UNDATED" ]; then
    echo "❌ Files without YYYY-MM-DD prefix:"
    echo "$UNDATED"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ All files have YYYY-MM-DD prefix"
fi

# Summary
if [ $ERRORS -eq 0 ]; then
    echo ""
    echo "✅ Archive validation passed"
    exit 0
else
    echo ""
    echo "❌ Archive validation failed ($ERRORS errors)"
    exit 1
fi
```

### Phase 4: Documentation and Training (Week 2)

**1. Create Archive Quick Reference**:

Add to `docs/DOCUMENTATION_QUICK_REFERENCE.md`:

```markdown
## Archive Quick Reference

**Archiving a document?**
```bash
./scripts/archive-document.sh <file> <completion-date> <category>

# Example
./scripts/archive-document.sh SPRINT_6_PLAN.md 2025-11-12 sprints
```

**Finding archived content?**
```bash
# All work from November 2025
ls docs/archive/2025-11/

# All incidents from Q4 2025
ls docs/archive/2025-{10,11,12}/incidents/

# Specific investigation
find docs/archive/ -name "*cache-investigation*"
```

**Categories**:
- `sprints/` - Sprint retrospectives, plans, reports
- `investigations/` - Technical deep-dives, bug analysis
- `decisions/` - Superseded technical decisions
- `incidents/` - Postmortems, outage reports
- `reports/` - Status reports, test summaries
```

**2. Update PR Review Checklist**:

```markdown
## Documentation Review

- [ ] Archives use ISO 8601 format (docs/archive/YYYY-MM/)
- [ ] Archived files have YYYY-MM-DD prefix
- [ ] Archives in correct category (sprints, investigations, etc.)
- [ ] Completion date matches actual completion (not start date)
- [ ] Links updated if files moved to archive
```

**3. Team Briefing** (15 minutes):
- Explain the problem: oct-22-analysis/ misdating, inconsistent structure
- Present the solution: ISO 8601 YYYY-MM format, 5 categories
- Demo archive script: Show how to archive a document
- Q&A: Address questions and edge cases

### Phase 5: Automation and Monitoring (Week 3)

**1. Quarterly Archive Audit Script**: `scripts/audit-archives.sh`

```bash
#!/bin/bash
# Audit archives for compliance with ADR-004
# Run quarterly to ensure archive health

echo "Archive Audit - $(date)"
echo "================================"

# Count total archived files
TOTAL_FILES=$(find docs/archive/2[0-9][0-9][0-9]-[0-9][0-9]/ -type f -name "*.md" | \
              grep -v "README.md" | wc -l)
echo "Total archived files: $TOTAL_FILES"

# Count by category
for category in sprints investigations decisions incidents reports; do
    COUNT=$(find docs/archive/2[0-9][0-9][0-9]-[0-9][0-9]/$category/ -type f 2>/dev/null | wc -l)
    echo "  $category: $COUNT files"
done

# Check for non-compliant archives
echo ""
echo "Compliance Check:"
./scripts/validate-archives.sh

# List recent archives (last 30 days)
echo ""
echo "Recent archives (last 30 days):"
find docs/archive/ -type f -name "*.md" -mtime -30 | head -10
```

**2. Add to quarterly documentation health audit**:

```markdown
# Quarterly Documentation Audit Checklist

- [ ] Run ./scripts/audit-archives.sh
- [ ] Run ./scripts/validate-archives.sh
- [ ] Verify no undated directories in docs/archive/
- [ ] Check for archives >90 days old that should be moved
- [ ] Update archive README files with quarter summary
- [ ] Review and consolidate duplicate archived content
```

**3. Calendar Reminder**:
- Set recurring quarterly reminder: "Run documentation archive audit"
- First reminder: February 2026 (end of Q4 2025)

---

## Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|--------|------------|---------------------|
| Misdated archives during migration | Medium | Medium | Review git history, validate dates with team |
| Developers forget archive script | Low | High | Add to PR checklist, train in team meeting |
| Wrong category selection | Low | Medium | Document category definitions, code review validation |
| Link breakage during migration | Medium | High | Track in LINK_UPDATES_NEEDED.md, create redirects |
| Year rollover confusion (2025→2026) | Low | Medium | Document explicitly, show examples (2025-12 vs 2026-01) |
| Lost files during migration | High | Low | Test migration script, verify file counts, keep git history |
| Compliance audit failure (mislabeled dates) | High | Low | ISO 8601 standard, quarterly audit validation |

---

## Compliance and Standards

**Does this decision affect:**
- [ ] Security requirements - No direct impact (but see ADR-005 for security archiving)
- [x] Privacy/compliance (GDPR, etc.) - Yes (audit trail organization)
- [ ] Performance SLAs - No
- [x] Architectural principles - Yes (time-based organization is architectural decision)
- [x] Documentation standards - Yes (core documentation governance decision)
- [ ] Testing requirements - No direct impact

**How are these addressed?**
- **Privacy/Compliance**: ISO 8601 dates provide audit-ready chronological records
- **Architecture**: Time-based archiving is foundational pattern for historical data
- **Documentation Standards**: Aligns with ADR-002 (naming) and ADR-003 (sprint lifecycle)

---

## Validation and Testing

### Success Metrics

**Immediate (Week 1)**:
- [x] ADR-004 written and accepted
- [ ] Archive structure created (2025-11, 2025-12)
- [ ] oct-22-analysis/ migrated to 2025-10/investigations/
- [ ] Migration script tested on 5+ files

**Short-term (Month 1)**:
- [ ] 100% of existing archives migrated to ISO 8601 structure
- [ ] Zero undated directories in docs/archive/
- [ ] All archived files have YYYY-MM-DD prefix
- [ ] Validation script passes (zero errors)

**Long-term (Quarter 1)**:
- [ ] 100% of new archives use ISO 8601 format
- [ ] Zero date ambiguity (no oct-22 style naming)
- [ ] Historical research queries successful (show me Q4 2025 work)
- [ ] Compliance audit passes (chronological audit trail)

### Test Scenarios

**Scenario 1: Archive Completed Sprint**
```bash
Action: Archive Sprint 6 documentation (completed Nov 12, 2025)
Command: ./scripts/archive-document.sh \
           SPRINT_6_SUMMARY.md 2025-11-12 sprints
Expected: docs/archive/2025-11/sprints/2025-11-12-sprint-6-summary.md
Verify: File moved, properly named, in correct category
```

**Scenario 2: Historical Research Query**
```bash
Action: Find all Q4 2025 sprint retrospectives
Command: ls docs/archive/2025-{10,11,12}/sprints/*retrospective*
Expected: List of all Q4 sprint retrospectives
Verify: Results include Sprint 4, 5, 6 retrospectives
```

**Scenario 3: Incident Postmortem Archive**
```bash
Action: Archive Nov 15 database incident postmortem
Command: ./scripts/archive-document.sh \
           DATABASE_INCIDENT_POSTMORTEM.md 2025-11-15 incidents
Expected: docs/archive/2025-11/incidents/2025-11-15-database-incident-postmortem.md
Verify: File archived same day incident resolved
```

**Scenario 4: Validation Script**
```bash
Action: Run archive validation after migration
Command: ./scripts/validate-archives.sh
Expected: All checks pass, zero errors
Verify: No undated directories, no files without date prefix
```

---

## References

- **ADR-002**: Documentation Naming Standards (defines YYYY-MM-DD prefix standard)
- **ADR-003**: Sprint Documentation Lifecycle (defines 90-day archive trigger)
- **ISO 8601**: International standard for date and time representation
- **Rebuild 6.0**: docs/archive/ structure (proven implementation, 18+ months)
- **DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md**: Identified oct-22-analysis/ misdating

---

## Follow-up

**Open Questions**:
- [ ] How to handle multi-month projects? (Answer: Archive by completion month, add note if spans multiple months)
- [ ] What if completion date uncertain? (Answer: Use best estimate, document uncertainty in README)
- [ ] Should we version archived content? (Answer: No, use git history for versioning)
- [ ] How long to retain archives? (Answer: Indefinite for now, review retention policy in 2026)

**Next Actions**:
- [ ] Create archive directory structure (2025-11, 2025-12)
- [ ] Write and test archive migration script
- [ ] Migrate oct-22-analysis/ to 2025-10/investigations/ (P0)
- [ ] Migrate remaining undated archives (P1-P2)
- [ ] Create validation script and run initial validation
- [ ] Update INDEX.md with archive documentation
- [ ] Brief team on archive strategy (15-minute meeting)
- [ ] Add archive validation to quarterly audit checklist

---

## Notes

### Edge Cases and Clarifications

**Q: What if project spans multiple months?**
A: Archive by completion month. Add note in archive README if project started in earlier month.

**Q: What if we archive something then need to unarchive?**
A: Move back to active location, but keep date prefix (indicates it was previously archived).

**Q: What if completion date is uncertain?**
A: Use best estimate (last significant update date from git log). Document uncertainty in README.

**Q: Should we create empty category directories?**
A: Yes, create all 5 categories when creating month directory. Empty directories are okay (signals "no incidents this month").

**Q: What about year rollover (December 2025 → January 2026)?**
A: Use 2025-12/ for December 2025, 2026-01/ for January 2026. Clear boundary at year change.

**Q: How to handle timezone differences in dates?**
A: Use project timezone (local time where team operates). ISO 8601 supports timezone notation if needed (YYYY-MM-DD+HH:MM).

---

## Lessons Learned (To Be Updated Quarterly)

### From oct-22-analysis/ Misdating
1. **Ambiguous dates create 3-year errors**: oct-22 interpreted as 2022, actually 2025
2. **Impact propagates**: AI agents, developers, compliance all affected by misdating
3. **ISO 8601 prevents ambiguity**: 2025-10 has single interpretation

### From Rebuild 6.0 Success
1. **Month-level granularity optimal**: 15-20 files per category per month (manageable)
2. **Category subdirectories essential**: Type-based filtering frequently used
3. **Completion date consistency**: Archiving by completion date prevents overlap confusion

---

## Approval

This ADR addresses critical chronological inconsistencies identified through:
- **Quantitative analysis**: oct-22-analysis/ contains 2025 files (3-year misdating)
- **Compliance risk**: Audit trails mislabeled, historical research fails
- **Developer feedback**: "Can't find 2025 work systematically" (reported by 2+ developers)
- **AI agent confusion**: Claude Code temporal reasoning broken by ambiguous dates

**Decision validated through**:
- **ISO 8601 standard**: International standard for date representation (unambiguous)
- **Rebuild 6.0 success**: 18+ months of ISO 8601 archives with zero temporal confusion
- **Industry practice**: Time-series data universally organized chronologically

**Status**: ACCEPTED (2025-11-12)

---

**Revision History**:
- 2025-11-12: Initial version (v1.0) - Establishes ISO 8601 time-based archive strategy
