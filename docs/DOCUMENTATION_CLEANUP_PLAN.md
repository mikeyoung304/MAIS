# Documentation Cleanup Plan

## Current State Analysis

| Metric                        | Count        |
| ----------------------------- | ------------ |
| Total markdown files in docs/ | 559          |
| Root-level docs (docs/\*.md)  | 21           |
| Active subdirectories         | 25           |
| Archive subdirectories        | 6 (by month) |

### Problems Identified

1. **Sprawl**: 559 docs across 25+ directories makes discovery difficult
2. **Stale Content**: Phase/sprint completion docs mixed with active references
3. **Inconsistent Archiving**: Some archived, some not; naming conventions vary
4. **Duplicate Locations**: ADRs in both `/DECISIONS/` and `/docs/adrs/`
5. **Wrong Project References**: Some docs reference "MAIS" instead of "MAIS"

---

## Recommended Documentation Structure

```
docs/
├── README.md                    # Index with links to all sections
├── CLAUDE.md → ../CLAUDE.md     # Symlink (AI assistant context)
│
├── guides/                      # HOW-TO guides (task-oriented)
│   ├── getting-started.md
│   ├── local-development.md
│   ├── testing.md
│   └── deployment.md
│
├── reference/                   # REFERENCE docs (information-oriented)
│   ├── api/                     # API documentation
│   ├── architecture/            # System design docs
│   ├── adrs/                    # Architecture Decision Records
│   └── security/                # Security policies & procedures
│
├── solutions/                   # EXPLANATION docs (understanding-oriented)
│   ├── prevention-strategies/   # Known issue prevention
│   └── patterns/                # Code patterns & best practices
│
├── operations/                  # OPERATIONS docs
│   ├── runbooks/                # Operational procedures
│   └── monitoring/              # Observability docs
│
└── archive/                     # Historical docs (by YYYY-MM)
    ├── 2025-10/
    ├── 2025-11/
    └── 2025-12/
```

This follows the **Diátaxis framework** (already referenced in existing docs).

---

## Cleanup Phases

### Phase 1: Quick Wins (30 min)

**Goal**: Remove obvious cruft, fix wrong references

- [ ] Delete `docs/LINK_UPDATES_NEEDED.md` (wrong project)
- [ ] Delete any empty or placeholder files
- [ ] Fix "MAIS" → "MAIS" references in active docs

### Phase 2: Archive Completed Work (1 hour)

**Goal**: Move historical docs to archive/2025-12/

**Move to archive:**

- [ ] `docs/phases/*.md` → `docs/archive/2025-12/phases/`
- [ ] `docs/sprints/*.md` → `docs/archive/2025-12/sprints/`
- [ ] `docs/reports/*_REPORT.md` → `docs/archive/2025-12/reports/`
- [ ] `server/docs/*_COMPLETION.md` → `docs/archive/2025-12/server/`

**Naming convention for archives:**

```
YYYY-MM-DD_original-filename.md
```

Example: `2025-11-17_PHASE_1_COMPLETION_REPORT.md`

### Phase 3: Consolidate Active Docs (1 hour)

**Goal**: Merge scattered docs into logical locations

- [ ] Merge `/DECISIONS/` ADRs into `/docs/adrs/` (single source)
- [ ] Consolidate multi-tenant docs into `docs/reference/architecture/`
- [ ] Move prevention strategies to `docs/solutions/prevention-strategies/`
- [ ] Consolidate setup guides into `docs/guides/`

### Phase 4: Update Index (30 min)

**Goal**: Create discoverable navigation

- [ ] Update `docs/README.md` with clear section links
- [ ] Add `_index.md` to each major directory
- [ ] Update `CLAUDE.md` key documentation references

### Phase 5: Establish Conventions (ongoing)

**Goal**: Prevent future sprawl

Add to `CLAUDE.md`:

```markdown
## Documentation Conventions

- **New features**: Add to `docs/guides/` or `docs/reference/`
- **Completed work**: Archive to `docs/archive/YYYY-MM/` with date prefix
- **ADRs**: Always in `docs/adrs/` using template
- **No root-level docs**: Everything in a subdirectory
```

---

## Execution Order

| Priority | Task                         | Effort | Impact |
| -------- | ---------------------------- | ------ | ------ |
| 1        | Delete wrong-project files   | 5 min  | High   |
| 2        | Archive phases/sprints       | 30 min | High   |
| 3        | Consolidate ADRs             | 15 min | Medium |
| 4        | Update multi-tenant docs     | 20 min | Medium |
| 5        | Create index files           | 30 min | High   |
| 6        | Add conventions to CLAUDE.md | 10 min | High   |

**Total estimated time: ~2 hours**

---

## Files to Delete (Phase 1)

```bash
# Wrong project references
rm docs/LINK_UPDATES_NEEDED.md

# Check for other "MAIS" references
grep -r "MAIS" docs/ --include="*.md" -l
```

## Files to Archive (Phase 2)

```bash
# Create December archive
mkdir -p docs/archive/2025-12/{phases,sprints,reports,server}

# Move with date prefix
# (Script would add dates based on file modification time)
```

---

## Success Criteria

- [ ] Root docs/ has ≤10 files (currently 21)
- [ ] No "MAIS" references in active docs
- [ ] Single ADR location (`docs/adrs/`)
- [ ] All completed work in `docs/archive/`
- [ ] `docs/README.md` links to all major sections
- [ ] `CLAUDE.md` documents conventions
