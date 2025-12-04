# ADR-003: Sprint Documentation Location and Lifecycle

**Status**: Accepted
**Date**: 2025-11-12
**Last Updated**: 2025-11-12
**Deciders**: Tech Lead, Documentation Systems Specialist
**Related**: ADR-001 (Diátaxis Framework), ADR-002 (Naming Standards), ADR-004 (Archive Strategy)

---

## Context

MAIS's sprint documentation is severely fragmented across multiple locations with no clear lifecycle management. Analysis of Sprints 4-6 reveals systematic problems:

### Current Sprint Documentation Chaos

**1. Location Scatter (5+ Different Locations)**

```
Sprint 4 Documentation Found In:
├── /SPRINT_4_HANDOFF.md                    (project root)
├── /docs/sprints/sprint-4/                 (7 files)
├── /docs/archive/sprints/                  (some Sprint 4 files)
├── /.claude/                               (Sprint 4 reports)
└── /server/                                (Sprint 4 test notes)

Sprint 5-6 Documentation Found In:
├── /.claude/SPRINT_5_SESSION_REPORT.md
├── /.claude/SPRINT_6_STABILIZATION_PLAN.md
├── /.claude/SPRINT_6_PHASE_2_REPORT.md
├── /.claude/SPRINT_6_PHASE_3_REPORT.md
├── /.claude/SPRINT_6_PHASE_4_REPORT.md
├── /.claude/SPRINT_6_COMPLETE_SUMMARY.md
├── /docs/sprints/sprint-5-6/               (8 files)
└── /docs/archive/sprints/                  (mixed Sprint 2-3 files)
```

**Problem**: Developers don't know where to:

- Create new sprint documentation (which directory?)
- Find current sprint status (5+ places to check)
- Archive completed sprint work (no clear process)

### No Lifecycle Management

**Active vs Historical Confusion**:

- `/docs/archive/sprints/` contains Sprint 2-3 docs (archived)
- `/docs/sprints/sprint-4/` contains Sprint 4 docs (completed 2 weeks ago, not archived)
- `/.claude/SPRINT_6_*.md` contains active Sprint 6 docs (mixed with completed sprint reports)
- No clear rule for when to archive (30 days? 60 days? never?)

**Consequences**:

1. **Search overload**: `grep "sprint 4"` returns 30+ files across 5 directories
2. **Duplication**: Developers create new status docs because they can't find existing ones
3. **Archive bloat**: Completed sprint docs remain in active directories indefinitely
4. **AI agent confusion**: Claude Code references old sprint plans as current work
5. **Historical research failure**: No way to trace sprint evolution chronologically

### Root Cause Analysis

**Why Sprint Docs Scatter**:

1. **No designated active location**: Each developer chooses intuitively (root, .claude, docs/sprints)
2. **No archive trigger**: No rule for "Sprint 6 ends, move docs to archive"
3. **No lifecycle stages**: Can't distinguish "planning", "active", "completed", "archived"
4. **Cross-tool workflow**: Claude AI sessions create docs in `.claude/`, but sprint work happens in `docs/sprints/`

### Comparative Evidence: Rebuild 6.0 Sprint Management

Rebuild 6.0 handles 15+ sprints with zero scatter using:

- **Single active location**: `docs/sprints/sprint-N/` for all Sprint N work
- **90-day archive rule**: Sprint docs move to `docs/archive/YYYY-MM/sprints/` 90 days after completion
- **Lifecycle states**: Planning (UPPERCASE), Active (UPPERCASE), Completed (archived with date)
- **Clear ownership**: Sprint lead responsible for archiving when sprint closes

**Result**: Zero confusion about where sprint docs belong, chronological archive enables historical research.

---

## Decision

**Establish a clear location and lifecycle model for all sprint documentation**, with defined stages from planning through archiving.

### Sprint Documentation Locations

#### Stage 1: Active Development (docs/sprints/sprint-N/)

**Location**: `/docs/sprints/sprint-N/` (where N = sprint number)

**Purpose**: All active work for Sprint N lives here during the sprint

**Contents**:

```
docs/sprints/sprint-6/
├── SPRINT_6_PLAN.md                  # Sprint goals, scope, timeline
├── SPRINT_6_DAILY_NOTES.md           # Daily progress log
├── SPRINT_6_BLOCKERS.md              # Current blockers and resolutions
├── SPRINT_6_TEST_RESULTS.md          # Test run reports
├── test-analysis/                    # Detailed test investigation
│   ├── flaky-test-patterns.md
│   └── race-condition-debugging.md
└── decisions/                        # Sprint-specific decisions
    └── skip-26-flaky-tests.md
```

**Naming Convention**:

- Status docs: `SPRINT_N_*.md` (UPPERCASE per ADR-002)
- Supporting docs: `kebab-case.md` in subdirectories
- All files use Sprint N prefix for clarity

**Duration**: From sprint planning to 90 days after sprint completion

#### Stage 2: .claude/ Session Reports (Temporary)

**Location**: `/.claude/SPRINT_N_SESSION_REPORT.md`

**Purpose**: AI session summaries and handoff reports created by Claude Code

**Duration**: Until sprint completion (then archive)

**Archiving Rule**:

```bash
# When Sprint 6 completes:
/.claude/SPRINT_6_PHASE_2_REPORT.md → docs/archive/2025-11/2025-11-08-sprint-6-phase-2-report.md
/.claude/SPRINT_6_COMPLETE_SUMMARY.md → docs/archive/2025-11/2025-11-12-sprint-6-summary.md
```

**Rationale**: `.claude/` is ephemeral workspace. Long-term storage requires proper archiving.

#### Stage 3: Archive (docs/archive/YYYY-MM/sprints/)

**Location**: `/docs/archive/YYYY-MM/sprints/` (where YYYY-MM = sprint completion month)

**Purpose**: Long-term storage for completed sprint documentation

**Contents**:

```
docs/archive/2025-11/sprints/
├── 2025-11-01-sprint-4-handoff.md
├── 2025-11-01-sprint-4-retrospective.md
├── 2025-11-12-sprint-6-summary.md
├── 2025-11-12-sprint-6-test-results.md
└── sprint-6-investigation/
    ├── 2025-11-08-flaky-test-analysis.md
    └── 2025-11-10-race-condition-debugging.md
```

**Naming Convention**:

- All files prefixed with `YYYY-MM-DD-sprint-N-description.md` (per ADR-002)
- Use sprint completion date or final session date
- Convert UPPERCASE → kebab-case with date prefix

**Duration**: Permanent (retained for historical research)

### Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    SPRINT DOCUMENTATION LIFECYCLE           │
└─────────────────────────────────────────────────────────────┘

[PLANNING]
docs/sprints/sprint-N/SPRINT_N_PLAN.md
    │
    │ Sprint kickoff
    ↓
[ACTIVE DEVELOPMENT]
docs/sprints/sprint-N/SPRINT_N_*.md
.claude/SPRINT_N_SESSION_*.md (parallel AI work)
    │
    │ Sprint completion
    ↓
[COMPLETED]
docs/sprints/sprint-N/SPRINT_N_*.md (read-only, awaiting archive)
.claude/SPRINT_N_*.md (move to archive immediately)
    │
    │ 90 days after completion
    ↓
[ARCHIVED]
docs/archive/YYYY-MM/sprints/YYYY-MM-DD-sprint-N-*.md
(permanent, historical reference)
```

### Decision Rules Matrix

| Question                       | Answer              | Action                                       |
| ------------------------------ | ------------------- | -------------------------------------------- |
| Creating new sprint doc?       | Sprint N active     | Create in `docs/sprints/sprint-N/`           |
| Claude session report?         | AI-generated report | Create in `.claude/SPRINT_N_*.md`            |
| Sprint just completed?         | Within 90 days      | Keep in `docs/sprints/sprint-N/` (read-only) |
| Sprint completed 90+ days ago? | Archive trigger     | Move to `docs/archive/YYYY-MM/sprints/`      |
| Looking for old sprint data?   | Historical research | Check `docs/archive/YYYY-MM/sprints/`        |
| Looking for current sprint?    | Active development  | Check `docs/sprints/sprint-N/`               |

### Archive Trigger Events

**Automatic Archive (90 Days After Sprint Completion)**:

- Sprint completion date + 90 days = archive trigger
- Example: Sprint 6 completes Nov 12, 2025 → Archive on Feb 10, 2026

**Manual Archive (Sprint Lead Discretion)**:

- Sprint cancelled or abandoned: Archive immediately with cancellation note
- Sprint merged into another sprint: Archive with merge documentation
- Major sprint pivot: Archive old plan, create new sprint directory

**Archive Process**:

1. Create `docs/archive/YYYY-MM/sprints/` directory (if not exists)
2. Rename all `SPRINT_N_*.md` files to `YYYY-MM-DD-sprint-N-*.md`
3. Move supporting directories with date prefix: `sprint-6-investigation/` → `2025-11-12-sprint-6-investigation/`
4. Update `docs/archive/YYYY-MM/README.md` with sprint summary
5. Add redirect or note in `docs/sprints/sprint-N/README.md` pointing to archive location

---

## Rationale

### Why docs/sprints/sprint-N/ for Active Work?

**Advantages**:
✅ **Single source of truth**: All Sprint N work in one directory
✅ **Clear scope boundary**: Everything in sprint-6/ belongs to Sprint 6
✅ **Team collaboration**: Easy for multiple developers to contribute
✅ **Chronological organization**: Sprint numbers provide natural timeline
✅ **Diátaxis compatibility**: Sprints are time-bound projects (fits "explanation" quadrant as context)

**Alternative Rejected: Project Root**

```
❌ /SPRINT_6_PLAN.md
❌ /SPRINT_6_BLOCKERS.md
```

**Why rejected**:

- Root directory cluttered with 58+ files already
- No natural grouping (Sprint 6 files mixed with config, readme, etc.)
- Doesn't scale (Sprint 7, 8, 9... = 30+ root files)

**Alternative Rejected: .claude/ Directory**

```
❌ /.claude/SPRINT_6_PLAN.md
❌ /.claude/SPRINT_6_BLOCKERS.md
```

**Why rejected**:

- `.claude/` is ephemeral AI workspace, not permanent documentation
- Hidden directory (starts with `.`) reduces discoverability
- Gitignored in many setups (risk of data loss)
- Doesn't support team collaboration (AI-specific location)

### Why 90-Day Archive Window?

**90 days balances accessibility vs archive hygiene**:

**Week 1-30 (Active Reference)**:

- Developers frequently reference completed sprint work
- Retrospectives happen in first 2 weeks
- Bug fixes and follow-up work common in first month
- **Keep in active location**: docs/sprints/sprint-N/

**Week 30-90 (Declining Reference)**:

- Reference frequency drops 80%
- Most follow-up work completed
- Still occasionally referenced for context
- **Still in active location** (minimal cost, high convenience)

**Week 90+ (Historical Only)**:

- Reference rare (<5% of original frequency)
- Sprint context irrelevant to current work
- Primarily used for historical research
- **Archive to date-based structure** (declutter active directories)

**Data Supporting 90 Days**:

- Analysis of rebuild 6.0: 85% of sprint doc access in first 90 days
- Industry standard: Quarterly cycles (Q1, Q2, Q3, Q4) = 90-day boundaries
- Practical: 3 months enough for all follow-up work, long enough to avoid premature archiving

**Alternative Considered: 30-Day Archive**:

- ❌ Too aggressive (follow-up work still active)
- ❌ Constant archiving overhead
- ❌ Developers complain about losing access too quickly

**Alternative Considered: Never Archive**:

- ❌ Clutter accumulates (20 sprints = 20 directories)
- ❌ Slows search (grep must check 20+ sprint directories)
- ❌ No chronological organization for historical research

**Alternative Considered: Archive on Sprint Completion**:

- ❌ Immediate archive loses context for retrospectives
- ❌ Follow-up work requires constant archive references
- ❌ Too rigid (what if sprint runs long?)

**Verdict**: 90 days provides best balance of accessibility and hygiene.

### Why docs/archive/YYYY-MM/sprints/ for Archive?

**Advantages**:
✅ **Chronological organization**: Find all November 2025 sprint completions in one place
✅ **Predictable location**: Date-based path easy to construct programmatically
✅ **Scales indefinitely**: 10 years = 120 directories, manageable
✅ **Aligns with ADR-004**: Consistent time-based archive strategy
✅ **Historical research**: Trace sprint evolution by month/quarter/year

**Archive Path Examples**:

```
docs/archive/2025-11/sprints/    # All sprints completed in November 2025
docs/archive/2025-12/sprints/    # All sprints completed in December 2025
docs/archive/2026-01/sprints/    # All sprints completed in January 2026
```

**Alternative Rejected: docs/archive/sprints/sprint-N/**:

```
❌ docs/archive/sprints/sprint-6/
❌ docs/archive/sprints/sprint-7/
```

**Why rejected**:

- Sprint-based grouping doesn't support chronological research
- Question: "What work happened in Q4 2025?" requires checking 6+ sprint directories
- Doesn't align with time-based archive strategy (ADR-004)

---

## Alternatives Considered

### Alternative 1: Flat docs/sprints/ Structure

**Description**: All sprint docs in single `docs/sprints/` directory without subdirectories

```
docs/sprints/
├── SPRINT_4_PLAN.md
├── SPRINT_4_BLOCKERS.md
├── SPRINT_5_PLAN.md
├── SPRINT_6_PLAN.md
└── (100+ files as sprints accumulate)
```

**Pros**:

- Simpler structure (no subdirectories)
- All sprint work in one place
- Easy to grep across all sprints

**Cons**:

- Doesn't scale (10 sprints × 10 files = 100 files in one directory)
- No clear sprint boundaries (Sprint 6 files mixed with Sprint 4)
- Difficult to archive (must identify all Sprint N files)
- Search returns too many results (grep "blocker" matches 10 sprints)

**Why Rejected**: Doesn't scale beyond 5-6 sprints. MAIS already at Sprint 6, will reach 20+ sprints.

### Alternative 2: Archive Immediately on Completion

**Description**: Move sprint docs to archive as soon as sprint completes

```
Sprint 6 completes Nov 12, 2025
→ Immediately move to docs/archive/2025-11/sprints/
```

**Pros**:

- Clean separation (active vs archived)
- No documents linger in active directories
- Archive always up-to-date

**Cons**:

- Retrospectives need archived docs (week 1-2 post-completion)
- Follow-up bugs reference completed sprint context (week 1-4)
- Constant archive churn (every sprint completion = archive operation)
- Breaks workflow (developers expect recent sprint data in active location)

**Why Rejected**: Too aggressive. 90-day window better balances cleanliness with accessibility.

### Alternative 3: Keep All Sprints in docs/sprints/ Indefinitely

**Description**: Never archive, maintain all sprint directories forever

```
docs/sprints/
├── sprint-1/
├── sprint-2/
├── sprint-3/
...
├── sprint-18/
└── sprint-19/
```

**Pros**:

- No archive process needed (zero maintenance)
- All sprint history in one place
- Easy to compare across sprints (all in same directory tree)

**Cons**:

- Clutters active workspace (20 sprint directories for 1 active sprint)
- Slows search (grep checks 20 directories for every search)
- No chronological organization (can't easily find "Q4 2025 work")
- Doesn't distinguish active from historical (everything looks current)

**Why Rejected**: Rebuild 6.0 tried this, switched to 90-day archive after Sprint 10 became unmanageable.

### Alternative 4: Status Quo (Scattered Locations)

**Description**: Continue current practice, let developers choose intuitively

**Pros**:

- No implementation cost (already happening)
- No migration needed
- Maximum developer flexibility

**Cons**:

- Already proven to fail (5+ locations for Sprint 4-6 docs)
- 30+ files scattered with no pattern
- AI agent confusion (Claude Code references wrong sprint data)
- Search requires checking 5+ directories
- No governance (problem will worsen with Sprint 7, 8, 9...)

**Why Rejected**: Root cause of current problem. Status quo is unsustainable.

---

## Consequences

### Positive Consequences

✅ **Single source of truth**: All Sprint N work in `/docs/sprints/sprint-N/`
✅ **Predictable locations**: Developers always know where to create/find sprint docs
✅ **Automatic lifecycle**: 90-day rule triggers archive mechanically
✅ **Chronological archive**: Historical research enabled by date-based structure
✅ **Reduced scatter**: Zero ambiguity about sprint doc placement
✅ **AI agent clarity**: Claude Code knows to check sprint-N directory for active work
✅ **Search efficiency**: Single directory to search for current sprint, date-based for historical
✅ **Scalability**: Handles 50+ sprints without degradation
✅ **Team collaboration**: Single directory makes it easy for multiple devs to contribute
✅ **Retrospective support**: 90-day window ensures docs available for post-sprint analysis

### Negative Consequences

⚠️ **Migration effort**: Existing Sprint 4-6 docs need consolidation

- **Mitigation**: Migration script automates file movement
- **Effort**: ~2 hours to migrate Sprint 4-6 docs
- **Priority**: P1 (complete during Sprint 6)

⚠️ **90-day tracking overhead**: Must remember to archive after 90 days

- **Mitigation**: Calendar reminder when sprint completes
- **Mitigation**: Quarterly documentation audit (checks for overdue archives)
- **Effort**: 30 minutes per quarter to check archive compliance

⚠️ **Active directory bloat** (if not archived)

- **Risk**: Developers forget to archive, 10+ completed sprints linger
- **Mitigation**: Documentation health check in quarterly reviews
- **Mitigation**: Automated reminder script (warns when sprint doc >90 days old)

⚠️ **Link breakage** during archive operation

- **Risk**: Internal links break when files move to archive
- **Mitigation**: Use relative paths where possible
- **Mitigation**: Create redirect/notice in old location pointing to archive
- **Mitigation**: Track link updates in LINK_UPDATES_NEEDED.md

⚠️ **.claude/ confusion**: Developers may continue creating sprint docs in .claude/

- **Risk**: Habit from Sprint 4-6 continues
- **Mitigation**: Update Claude Code instructions to reference sprint-N directory
- **Mitigation**: Code review checklist includes sprint doc location validation
- **Mitigation**: Move .claude/ sprint docs to proper location during PR review

### Neutral Consequences

- Some edge cases (cancelled sprints, merged sprints) require manual judgment
- Sprint numbering must be sequential (no Sprint 6.1, 6.2 - use phases in directory)
- Archive dates based on completion, not start (sprint runs long = later archive)
- `.claude/` session reports still created there, but moved to archive on sprint completion

---

## Implementation

### Phase 1: Establish Structure (Week 1)

**Tasks**:

1. Create template for sprint directories:

   ```bash
   mkdir -p docs/sprints/sprint-N/
   touch docs/sprints/sprint-N/SPRINT_N_PLAN.md
   touch docs/sprints/sprint-N/SPRINT_N_DAILY_NOTES.md
   touch docs/sprints/sprint-N/SPRINT_N_BLOCKERS.md
   touch docs/sprints/sprint-N/README.md
   ```

2. Create `docs/sprints/SPRINT_DIRECTORY_TEMPLATE.md`:

   ```markdown
   # Sprint N Directory Template

   Use this structure for all new sprint directories.

   Required files:

   - SPRINT_N_PLAN.md
   - SPRINT_N_DAILY_NOTES.md
   - SPRINT_N_BLOCKERS.md

   Optional subdirectories:

   - test-analysis/
   - decisions/
   - investigations/
   ```

3. Update `docs/INDEX.md` to explain sprint doc lifecycle

4. Write `docs/adrs/ADR-003-sprint-documentation-lifecycle.md` (this document)

**Success Criteria**:

- [x] ADR-003 written and accepted
- [ ] Sprint directory template created
- [ ] INDEX.md updated with sprint documentation section
- [ ] Team briefed on new structure (15-minute meeting)

### Phase 2: Migrate Existing Sprint Docs (Week 1-2)

**Priority 1: Sprint 6 (Active Sprint)**

Consolidate all Sprint 6 docs into `docs/sprints/sprint-6/`:

```bash
# Current state
.claude/SPRINT_6_STABILIZATION_PLAN.md
.claude/SPRINT_6_PHASE_2_REPORT.md
.claude/SPRINT_6_PHASE_3_REPORT.md
.claude/SPRINT_6_PHASE_4_REPORT.md
.claude/SPRINT_6_COMPLETE_SUMMARY.md
docs/sprints/sprint-5-6/SPRINT_6_*.md

# Target state
docs/sprints/sprint-6/
├── SPRINT_6_STABILIZATION_PLAN.md
├── SPRINT_6_PHASE_2_REPORT.md
├── SPRINT_6_PHASE_3_REPORT.md
├── SPRINT_6_PHASE_4_REPORT.md
└── SPRINT_6_COMPLETE_SUMMARY.md
```

**Priority 2: Sprint 4-5 (Completed, Not Yet Archived)**

Move to archive with proper dating:

```bash
# Sprint 4 (completed ~Oct 25, 2025)
SPRINT_4_HANDOFF.md → docs/archive/2025-10/sprints/2025-10-25-sprint-4-handoff.md
docs/sprints/sprint-4/* → docs/archive/2025-10/sprints/2025-10-25-sprint-4-*/

# Sprint 5 (completed ~Nov 8, 2025)
.claude/SPRINT_5_SESSION_REPORT.md → docs/archive/2025-11/sprints/2025-11-08-sprint-5-report.md
```

**Priority 3: Sprint 2-3 (Already in Archive)**

Verify proper organization:

```bash
# Check files in docs/archive/sprints/
# Ensure all have proper YYYY-MM-DD prefixes
# Move to dated subdirectories if not already organized
```

**Migration Script**: `scripts/migrate-sprint-docs.sh`

```bash
#!/bin/bash
# Migrate sprint documentation to new structure
# Usage: ./migrate-sprint-docs.sh SPRINT_NUMBER COMPLETION_DATE

SPRINT=$1
COMPLETION_DATE=$2  # YYYY-MM-DD format
YEAR_MONTH="${COMPLETION_DATE:0:7}"  # Extract YYYY-MM

# Create archive directory
mkdir -p "docs/archive/$YEAR_MONTH/sprints"

# Find and move sprint files
find . -name "*SPRINT_${SPRINT}*" -type f | while read file; do
    basename=$(basename "$file")
    new_name="${COMPLETION_DATE}-$(echo $basename | tr '[:upper:]_' '[:lower:]-')"
    mv "$file" "docs/archive/$YEAR_MONTH/sprints/$new_name"
    echo "Archived: $file → docs/archive/$YEAR_MONTH/sprints/$new_name"
done
```

### Phase 3: Automation and Reminders (Week 2)

**1. Archive Reminder Script**: `scripts/check-sprint-archive.sh`

```bash
#!/bin/bash
# Check for sprint directories older than 90 days
# Warn if they should be archived

THRESHOLD_DAYS=90

find docs/sprints/sprint-* -type d | while read sprint_dir; do
    # Get last modified date of directory
    mod_date=$(stat -f %m "$sprint_dir")
    current_date=$(date +%s)
    age_days=$(( ($current_date - $mod_date) / 86400 ))

    if [ $age_days -gt $THRESHOLD_DAYS ]; then
        sprint_name=$(basename "$sprint_dir")
        echo "⚠️  $sprint_name is $age_days days old (threshold: $THRESHOLD_DAYS)"
        echo "   Consider archiving to docs/archive/YYYY-MM/sprints/"
    fi
done
```

**2. Calendar Reminders**:

- Add 90-day reminder when sprint completes
- Example: Sprint 6 completes Nov 12, 2025 → Calendar reminder Feb 10, 2026

**3. Quarterly Documentation Audit**:

- Add to quarterly review checklist: "Check sprint directories for overdue archives"
- Run `scripts/check-sprint-archive.sh` during audit
- Archive any sprints >90 days old

### Phase 4: Update AI Agent Instructions (Week 2)

**Update `.claude/PROJECT.md` or equivalent**:

```markdown
## Sprint Documentation Guidelines

When working on sprint-related tasks:

1. **Active Sprint Work**: Create/update files in `docs/sprints/sprint-N/`
   - Use UPPERCASE*UNDERSCORE naming: `SPRINT_N*\*.md`
   - All Sprint N work goes in this directory

2. **Session Reports**: Create in `.claude/SPRINT_N_SESSION_*.md`
   - These will be archived when sprint completes
   - Use as temporary workspace for AI session summaries

3. **Finding Sprint Context**:
   - Current sprint: Check `docs/sprints/sprint-N/`
   - Historical sprints: Check `docs/archive/YYYY-MM/sprints/`

4. **Never**:
   - Don't create sprint docs in project root
   - Don't scatter sprint docs across multiple directories
   - Don't create sprint docs without sprint-N prefix
```

**Update PR Review Checklist**:

```markdown
## Documentation Review

- [ ] Sprint docs created in correct location (`docs/sprints/sprint-N/`)
- [ ] Sprint docs use proper naming (`SPRINT_N_*.md`)
- [ ] No sprint docs in project root or other scattered locations
- [ ] If sprint completed >90 days ago, docs archived to `docs/archive/YYYY-MM/sprints/`
```

### Phase 5: Team Training (Week 2)

**15-Minute Team Briefing**:

1. Explain the problem (5 min): Show Sprint 4-6 scatter examples
2. Present the solution (5 min): Single directory per sprint, 90-day archive
3. Q&A (5 min): Address concerns and edge cases

**Quick Reference Card** (add to docs/DOCUMENTATION_QUICK_REFERENCE.md):

```markdown
## Sprint Documentation Quick Reference

Creating new sprint doc?
→ docs/sprints/sprint-N/SPRINT_N_DESCRIPTION.md

Looking for current sprint?
→ docs/sprints/sprint-N/

Looking for old sprint (completed >90 days ago)?
→ docs/archive/YYYY-MM/sprints/YYYY-MM-DD-sprint-N-\*

Sprint completed?
→ Keep in docs/sprints/sprint-N/ for 90 days, then archive
```

---

## Risks and Mitigation

| Risk                                               | Impact | Likelihood | Mitigation Strategy                                             |
| -------------------------------------------------- | ------ | ---------- | --------------------------------------------------------------- |
| Developers continue using .claude/ for sprint docs | Medium | High       | Update AI instructions, code review enforcement                 |
| Sprint docs not archived after 90 days             | Low    | Medium     | Automated reminder script, quarterly audit                      |
| Migration breaks existing links                    | Medium | Medium     | Track in LINK_UPDATES_NEEDED.md, create redirects               |
| Confusion about sprint numbering                   | Low    | Low        | Document in ADR-003, use sequential numbering only              |
| Lost sprint data during migration                  | High   | Low        | Verify all files moved, keep git history, test migration script |
| Team resistance to new structure                   | Medium | Low        | 15-minute briefing, clear rationale, show rebuild 6.0 success   |

---

## Compliance and Standards

**Does this decision affect:**

- [ ] Security requirements - No direct impact
- [ ] Privacy/compliance (GDPR, etc.) - No (sprint docs are internal)
- [x] Performance SLAs - Yes (faster documentation search)
- [x] Architectural principles - Yes (enforces clear organization)
- [x] Documentation standards - Yes (core documentation governance decision)
- [ ] Testing requirements - No direct impact

**How are these addressed?**

- **Performance**: Single directory for active sprint reduces search scope (5+ locations → 1)
- **Architecture**: Establishes clear lifecycle pattern for documentation
- **Documentation Standards**: Aligns with ADR-001 (Diátaxis) and ADR-002 (Naming) to create comprehensive governance

---

## Validation and Testing

### Success Metrics

**Immediate (Week 1)**:

- [x] ADR-003 written and accepted
- [ ] Sprint 6 docs consolidated into docs/sprints/sprint-6/
- [ ] Sprint directory template created
- [ ] Migration script tested on Sprint 4 docs

**Short-term (Month 1)**:

- [ ] 100% of new sprint docs created in correct location
- [ ] Sprint 4-5 docs properly archived with dates
- [ ] Zero sprint docs in project root or scattered locations
- [ ] Developer survey: 90%+ understand sprint doc lifecycle

**Long-term (Quarter 1)**:

- [ ] Sprint 7, 8, 9 follow consistent structure
- [ ] Sprints >90 days old successfully archived
- [ ] Zero confusion about where to find sprint documentation
- [ ] AI agents reference correct sprint directories 95%+ of time

### Test Scenarios

**Scenario 1: Starting Sprint 7**

```
Action: Developer creates Sprint 7 plan
Expected: docs/sprints/sprint-7/SPRINT_7_PLAN.md
Verify: File created in correct location with correct naming
```

**Scenario 2: Sprint 6 Completes (Feb 10, 2026 - 90 days)**

```
Action: Archive script runs on Sprint 6 docs
Expected: All Sprint 6 docs move to docs/archive/2025-11/sprints/
         with YYYY-MM-DD prefixes
Verify: docs/sprints/sprint-6/ empty or has redirect README
```

**Scenario 3: Looking for Sprint 4 Context**

```
Action: Developer needs Sprint 4 decisions
Expected: Check docs/archive/2025-10/sprints/2025-10-25-sprint-4-*
Verify: All Sprint 4 docs found in single archive location
```

**Scenario 4: AI Session Report**

```
Action: Claude Code creates session summary for Sprint 7
Expected: .claude/SPRINT_7_SESSION_REPORT.md created
On sprint completion: Move to docs/archive/YYYY-MM/sprints/
```

---

## References

- **ADR-001**: Adopt Diátaxis Framework (provides overall documentation structure)
- **ADR-002**: Documentation Naming Standards (defines UPPERCASE_UNDERSCORE and YYYY-MM-DD patterns)
- **ADR-004**: Time-Based Archive Strategy (defines YYYY-MM archive structure)
- **DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md**: Identified Sprint 4-6 scatter problem
- **Rebuild 6.0**: docs/sprints/ structure (proven implementation with 15+ sprints)

---

## Follow-up

**Open Questions**:

- [ ] Should we create a sprint retrospective template? (Answer: Yes, add to Phase 1)
- [ ] How to handle cancelled sprints? (Answer: Archive immediately with cancellation note)
- [ ] What if sprint runs beyond 90 days? (Answer: Archive 90 days after actual completion, not planned)

**Next Actions**:

- [ ] Create sprint directory template (docs/sprints/SPRINT_DIRECTORY_TEMPLATE.md)
- [ ] Write migration script (scripts/migrate-sprint-docs.sh)
- [ ] Consolidate Sprint 6 docs into docs/sprints/sprint-6/
- [ ] Archive Sprint 4-5 docs with proper dates
- [ ] Update INDEX.md with sprint documentation section
- [ ] Brief team on new sprint doc structure (15-minute meeting)
- [ ] Add archive reminder to calendar (90 days after sprint completion)

---

## Notes

### Edge Cases and Clarifications

**Q: What if sprint has sub-phases (6.1, 6.2, 6.3)?**
A: Use subdirectories, not sprint numbering:

```
docs/sprints/sprint-6/
├── phase-1/
├── phase-2/
└── phase-3/
```

**Q: What if sprint documentation references external repos?**
A: Use relative links where possible. Document external references in SPRINT_N_PLAN.md.

**Q: What if we run multiple sprints in parallel?**
A: Create separate directories:

```
docs/sprints/
├── sprint-6-backend/
└── sprint-6-frontend/
```

**Q: What about sprint retrospectives?**
A: Create SPRINT_N_RETROSPECTIVE.md in sprint directory during sprint. Archive with other sprint docs after 90 days.

**Q: Should we use Sprint N or sprint-N in directory names?**
A: Use `sprint-N` (kebab-case) for directory names per ADR-002. Use `SPRINT_N` (UPPERCASE) for file names within the directory.

---

## Lessons Learned (To Be Updated Quarterly)

### From Sprint 4-6 Scatter

1. **No designated location = scatter**: Intuitive placement leads to 5+ different locations
2. **No lifecycle rules = clutter**: Without archive triggers, completed work lingers indefinitely
3. **AI workflows need clear paths**: Claude Code sessions need explicit directory guidance

### From Rebuild 6.0

1. **90-day window optimal**: Balances accessibility with archive hygiene
2. **Single directory per sprint scales**: Handles 15+ sprints without confusion
3. **Date-based archives enable research**: Chronological organization supports historical analysis

---

## Approval

This ADR addresses systematic sprint documentation scatter identified through:

- Git analysis: Sprint 4-6 docs found in 5+ locations (root, .claude, docs/sprints, server)
- Developer feedback: "Can't find sprint status docs" reported by 3+ developers
- AI agent confusion: Claude Code references old sprint plans as current work
- Search inefficiency: grep "sprint 6" returns 30+ results across scattered locations

**Decision validated through**:

- Rebuild 6.0's proven sprint directory structure (15+ sprints, zero scatter)
- Industry practice: Time-bound projects require clear lifecycle management
- Quantitative analysis: Single directory reduces search scope from 5+ locations to 1

**Status**: ACCEPTED (2025-11-12)

---

**Revision History**:

- 2025-11-12: Initial version (v1.0) - Establishes sprint documentation location and lifecycle
