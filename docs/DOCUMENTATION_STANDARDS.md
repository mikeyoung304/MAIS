# Documentation Governance Standards

**Version:** 1.0
**Last Updated:** 2025-11-12
**Owner:** Technical Lead
**Status:** Active

---

## Purpose

This document establishes clear, actionable standards for creating, organizing, and maintaining documentation in the MAIS project. These standards prevent documentation drift, eliminate confusion about file placement, and ensure long-term sustainability.

**Context:** After a major documentation reorganization on Nov 7, 2025, the system showed significant drift within 5 days—Sprint 4-6 docs scattered across directories, 23% duplication rate, and developers uncertain about where to place new documentation. These standards address the root causes of that drift.

---

## Quick Decision Trees

### "Where Does This Document Go?" (30-Second Guide)

```
Is it Sprint-related work (reports, progress, blockers)?
├─ YES → /docs/sprints/sprint-{N}/
└─ NO ↓

Is it active operational guidance (runbooks, deployment, incidents)?
├─ YES → /docs/operations/
└─ NO ↓

Is it API documentation or contracts?
├─ YES → /docs/api/ or /packages/contracts/
└─ NO ↓

Is it security-related (procedures, audits, secrets)?
├─ YES → /docs/security/
└─ NO ↓

Is it setup/configuration guidance?
├─ YES → /docs/setup/
└─ NO ↓

Is it architectural design or decisions (ADRs)?
├─ YES → /docs/architecture/ (ADRs go here)
└─ NO ↓

Is it a feature roadmap or implementation plan?
├─ YES → /docs/roadmaps/
└─ NO ↓

Is it multi-tenant specific documentation?
├─ YES → /docs/multi-tenant/
└─ NO ↓

Is it a completed Phase report?
├─ YES → /docs/phases/
└─ NO ↓

Is it older than 90 days or superseded?
├─ YES → /docs/archive/{category}/{YYYY-MM}/
└─ NO → Ask in #documentation channel
```

---

## 1. Naming Conventions

### 1.1 Four Standard Patterns

#### Pattern 1: UPPERCASE_UNDERSCORE
**When to use:** Reports, audits, assessments, summaries, completion documents

**Format:** `{TYPE}_{SUBJECT}_{QUALIFIER}.md`

**Examples:**
- `SPRINT_6_COMPLETION_REPORT.md`
- `SECURITY_AUDIT_PHASE_2B.md`
- `TEST_STABILIZATION_SUMMARY.md`
- `INTEGRATION_TEST_PROGRESS.md`
- `PRODUCTION_READINESS_ASSESSMENT.md`

**Rules:**
- Start with document TYPE (SPRINT, AUDIT, REPORT, SUMMARY, ASSESSMENT, GUIDE)
- Use descriptive SUBJECT (what it's about)
- Optional QUALIFIER for specificity (phase numbers, versions)
- Maximum 4 segments (TYPE_SUBJECT_QUALIFIER_VERSION)

#### Pattern 2: kebab-case
**When to use:** Guides, tutorials, how-to documents, reference docs

**Format:** `{purpose}-{subject}.md`

**Examples:**
- `deployment-guide.md`
- `quick-start-tutorial.md`
- `api-integration-guide.md`
- `local-testing-guide.md`
- `secret-rotation-procedure.md`

**Rules:**
- All lowercase
- Hyphens between words
- Action-oriented naming (what it helps you do)
- Keep to 2-4 words maximum

#### Pattern 3: YYYY-MM-DD Timestamps
**When to use:** Time-specific reports, incident logs, meeting notes, changelogs

**Format:** `YYYY-MM-DD-{description}.md`

**Examples:**
- `2025-11-12-incident-response.md`
- `2025-11-07-sprint-planning.md`
- `2025-10-22-security-review.md`

**Rules:**
- Always use ISO 8601 date format (YYYY-MM-DD)
- Date comes FIRST (enables chronological sorting)
- Follow with kebab-case description
- Use for events, not evergreen content

#### Pattern 4: ADR-### Format
**When to use:** Architectural Decision Records ONLY

**Format:** `ADR-{NNN}-{decision-title}.md`

**Examples:**
- `ADR-001-adopt-diataxis-framework.md`
- `ADR-002-documentation-naming-standards.md`
- `ADR-003-sprint-documentation-location.md`
- `ADR-004-archive-strategy.md`

**Rules:**
- Zero-padded 3-digit number (001, 002, etc.)
- Sequential numbering (never reuse numbers)
- Kebab-case title after number
- Store in `/docs/architecture/`
- Follow ADR template (see Section 4.3)

### 1.2 Special Cases

#### Directory Names
- Use **kebab-case** for all directories
- Examples: `sprint-5-6`, `multi-tenant`, `october-2025-analysis`

#### README Files
- Every directory MUST have a `README.md`
- Explains the directory's purpose and contents
- Lists key documents with brief descriptions

#### Index Files
- Use `INDEX.md` for navigation hubs only
- Not the same as README (README explains, INDEX navigates)

---

## 2. File Placement Rules

### 2.1 Primary Directories

| Directory | Purpose | When to Use | Examples |
|-----------|---------|-------------|----------|
| `/docs/sprints/sprint-{N}/` | Active sprint work | Sprint reports, progress updates, blockers, session notes | `SPRINT_6_COMPLETION_REPORT.md` |
| `/docs/operations/` | Production operations | Runbooks, incident response, deployment guides, monitoring | `deployment-guide.md`, `RUNBOOK.md` |
| `/docs/api/` | API documentation | API guides, endpoint references, integration docs | `API_DOCS_QUICKSTART.md` |
| `/docs/security/` | Security documentation | Security procedures, audits, secret management | `SECRET_ROTATION_GUIDE.md` |
| `/docs/setup/` | Setup & configuration | Environment setup, service configuration, local dev | `ENVIRONMENT.md`, `SUPABASE.md` |
| `/docs/architecture/` | Architecture & design | ADRs, design docs, system architecture, patterns | `ADR-001-framework.md` |
| `/docs/roadmaps/` | Feature roadmaps | Implementation plans, feature specs, product roadmaps | `EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md` |
| `/docs/multi-tenant/` | Multi-tenant features | Tenant-specific guides, implementation details | `MULTI_TENANT_IMPLEMENTATION_GUIDE.md` |
| `/docs/phases/` | Phase reports | Completed phase reports, historical milestones | `PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md` |
| `/docs/archive/` | Historical docs | Superseded docs, old sprints, deprecated guides | `archive/sprints/sprint-1-3/` |

### 2.2 Detailed Placement Rules

#### Sprint Documentation
**Location:** `/docs/sprints/sprint-{N}/`

**What goes here:**
- Sprint completion reports
- Progress updates and session handoffs
- Sprint-specific blockers and known issues
- Sprint planning documents
- Session notes and work logs

**Structure:**
```
/docs/sprints/
├── sprint-4/
│   ├── README.md
│   ├── SPRINT_4_COMPLETION_REPORT.md
│   ├── cache-isolation-progress.md
│   └── known-issues.md
├── sprint-5-6/
│   ├── README.md
│   ├── SPRINT_5_SESSION_REPORT.md
│   └── SPRINT_6_COMPLETE_SUMMARY.md
```

**Archive rule:** Move to `/docs/archive/sprints/sprint-{N}/` 90 days after sprint completion

#### Security Documentation
**Location:** `/docs/security/`

**What goes here:**
- Security procedures and best practices
- Secret management guides
- Security audit reports
- Incident response procedures
- Vulnerability assessments

**Special rules:**
- NEVER commit actual secrets/passwords
- Security audits older than 90 days → archive
- Active procedures stay in main directory
- Review security docs every 90 days

#### Architecture Documentation
**Location:** `/docs/architecture/`

**What goes here:**
- Architectural Decision Records (ADRs)
- System architecture diagrams
- Design patterns and principles
- Technical design documents

**Special rules:**
- ADRs NEVER get archived (they're historical by nature)
- Use ADR-### naming for all decision records
- Architecture diagrams should be version-controlled

#### API Documentation
**Location:** `/docs/api/`

**What goes here:**
- API integration guides
- Endpoint documentation
- API quickstart guides
- OpenAPI/Swagger specs

**Special rules:**
- Generated API docs (from code) → `.gitignore`
- Manual API guides stay in this directory
- Link to contracts in `/packages/contracts/`

#### Operations Documentation
**Location:** `/docs/operations/`

**What goes here:**
- Runbooks for production issues
- Deployment guides and procedures
- Incident response playbooks
- Monitoring and alerting setup

**Special rules:**
- Keep procedures up-to-date (monthly review)
- Incident-specific docs → timestamped files
- Old incident logs → archive after 180 days

### 2.3 Edge Cases

#### Agent/AI Session Reports
**Current:** Scattered in `.claude/` and root
**Target:** `/docs/sprints/sprint-{N}/sessions/`
**Rationale:** Session reports are sprint context, should be organized with sprint docs

#### Analysis Reports
**Current:** Multiple locations
**Target:**
- Active analysis → `/docs/sprints/sprint-{N}/`
- Historical analysis → `/docs/archive/planning/{YYYY-MM}/`

#### Work Logs
**Current:** `work-log.md` in archive
**Target:**
- Active work log → `/docs/sprints/sprint-{N}/work-log.md`
- Completed sprint logs → archive with sprint

---

## 3. Metadata Requirements

### 3.1 Required Headers

Every documentation file MUST include this frontmatter:

```markdown
# Document Title

**Version:** 1.0
**Last Updated:** YYYY-MM-DD
**Author/Owner:** [Name or Role]
**Status:** [Active | Draft | Deprecated | Archived]

---

## Purpose

[1-2 sentence description of what this document is for]

---

[Document content begins here]
```

### 3.2 Status Values

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| **Draft** | Work in progress, not reviewed | Review before making Active |
| **Active** | Current, authoritative documentation | Keep up-to-date |
| **Deprecated** | Superseded by another document | Add "Superseded by: [link]" |
| **Archived** | Historical, no longer relevant | Move to archive/ |

### 3.3 Version Tracking

**Semantic versioning for docs:**
- **Major version (1.0 → 2.0):** Significant restructuring or complete rewrite
- **Minor version (1.0 → 1.1):** New sections or substantial additions
- **Patch version (1.1 → 1.1.1):** Minor corrections, typo fixes

**Version history:**
Include at bottom of document:
```markdown
---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1 | 2025-11-15 | Jane Doe | Added section on error handling |
| 1.0 | 2025-11-12 | John Smith | Initial version |
```

### 3.4 Cross-References

**Always use:**
- Relative links for internal docs: `[Guide](../setup/deployment-guide.md)`
- Absolute URLs for external resources
- Link to source of truth, never duplicate content

**Maintain a link registry:**
- When moving documents, search for references: `grep -r "old-filename.md" docs/`
- Update INDEX.md when adding major documents

---

## 4. Review Process

### 4.1 Security Review Checklist

Before committing ANY documentation:

- [ ] **No exposed secrets:** Search for passwords, API keys, tokens
- [ ] **No PII:** Check for emails, names, phone numbers (unless necessary)
- [ ] **No internal IPs/URLs:** Sanitize production infrastructure details
- [ ] **Audit trail review:** Security audits should be reviewed by security lead

**Tools:**
```bash
# Scan for potential secrets before commit
grep -r -E '(password|api_key|secret|token)[:=]' docs/

# Check for high-risk patterns
grep -r -E '(sk_live|pk_live|postgres://|mongodb://)' docs/
```

### 4.2 Deduplication Check

Before creating new documentation:

- [ ] **Search existing docs:** Is this already documented?
- [ ] **Check archive:** Has this been covered before?
- [ ] **Consolidate if possible:** Update existing doc rather than creating new

**Detection:**
```bash
# Find similar files by name
find docs/ -name "*{keyword}*"

# Find similar content (requires fzf or similar)
grep -r "key phrase" docs/
```

### 4.3 Placement Validation

Before committing:

- [ ] **Correct directory:** Follow decision tree (Section 1)
- [ ] **Correct naming:** Follow pattern rules (Section 2)
- [ ] **README updated:** Parent directory README lists new doc
- [ ] **INDEX updated:** If major doc, add to `/docs/INDEX.md`

### 4.4 ADR-Specific Review

Architectural Decision Records require:

- [ ] **Template used:** Follow ADR template structure
- [ ] **Numbered sequentially:** Check last ADR number
- [ ] **Context provided:** Why was decision needed?
- [ ] **Alternatives considered:** What options were evaluated?
- [ ] **Consequences documented:** What are the tradeoffs?

**ADR Template:**
```markdown
# ADR-{NNN}: {Decision Title}

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Deciders:** [List of people involved]
**Technical Story:** [Link to issue/epic]

---

## Context

[What is the issue that we're seeing that is motivating this decision?]

## Decision

[What is the change that we're proposing and/or doing?]

## Alternatives Considered

1. **Option A:** [Description, pros/cons]
2. **Option B:** [Description, pros/cons]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Tradeoff 1]
- [Tradeoff 2]

### Neutral
- [Impact 1]
- [Impact 2]

## References

- [Link to relevant documentation]
- [Link to technical research]
```

---

## 5. Archive Policy

### 5.1 When to Archive

Archive documentation when:

- **90 days after Sprint completion:** Sprint reports, progress docs
- **Superseded by new version:** Old guides replaced by updated ones
- **Feature deprecated:** Documentation for removed features
- **Incident resolved + 180 days:** Incident-specific troubleshooting
- **Analysis completed:** One-time analysis reports (after review)

### 5.2 Archive Directory Structure

```
/docs/archive/
├── sprints/
│   ├── sprint-1-3/         # Sprints 1-3 (completed 2025-10)
│   └── sprint-4/           # Sprint 4 (to archive 2026-02)
├── planning/
│   └── 2025-01-analysis/   # January 2025 planning docs
├── client-reports/
│   └── nov-2025/           # November 2025 client deliverables
├── test-reports/
│   └── 2025-10/            # October 2025 test analysis
├── overnight-runs/
│   └── 2025-10/            # October 2025 overnight analysis
└── october-2025-analysis/  # October comprehensive audit
```

**Structure rules:**
- Use `{category}/{YYYY-MM}/` for time-based archives
- Use `{category}/{descriptor}/` for topic-based archives
- Always include archive README explaining what's archived and why

### 5.3 Archive Process

**Step-by-step:**

1. **Identify candidates:**
   ```bash
   # Find files older than 90 days
   find docs/ -name "*.md" -mtime +90
   ```

2. **Create archive directory:**
   ```bash
   mkdir -p docs/archive/{category}/{YYYY-MM}
   ```

3. **Move files:**
   ```bash
   git mv docs/sprints/sprint-4/ docs/archive/sprints/sprint-4/
   ```

4. **Update links:**
   ```bash
   # Search for references
   grep -r "sprint-4" docs/
   # Update all references to new archive location
   ```

5. **Add archive README:**
   ```markdown
   # Sprint 4 Archive

   **Archived:** 2026-02-15
   **Reason:** Sprint completed 2025-11-12, 90-day retention passed
   **Contains:** Sprint 4 completion report, cache isolation work, session notes

   For current sprint documentation, see: [/docs/sprints/](/docs/sprints/)
   ```

6. **Update main INDEX.md:**
   - Move sprint from "Current" to "Archive" section

### 5.4 What NEVER Gets Archived

- **ADRs:** Architectural decisions are historical by nature
- **Core guides:** ARCHITECTURE.md, SECURITY.md, RUNBOOK.md
- **Active procedures:** Deployment guides, incident response playbooks
- **README.md files:** Keep for navigation
- **INDEX.md:** Main documentation hub

---

## 6. Ownership Model

### 6.1 Roles and Responsibilities

| Role | Responsibilities | Authority |
|------|------------------|-----------|
| **Technical Lead** | Documentation structure, standards enforcement, dispute resolution | Final say on placement and standards |
| **Sprint Contributors** | Sprint-specific docs, session reports, progress updates | Own their sprint directory |
| **Security Lead** | Security docs review, audit approval | Veto security doc changes |
| **API Owner** | API documentation accuracy, contract sync | Approve API doc changes |
| **Operations Lead** | Runbooks, deployment guides, incident procedures | Approve operational doc changes |
| **All Developers** | Follow standards, update docs with code changes | Create docs per standards |

### 6.2 PR Review Process

**For documentation PRs:**

1. **Self-review:**
   - Run security checklist (Section 4.1)
   - Verify placement (Section 2)
   - Check naming (Section 1)
   - Add metadata headers (Section 3)

2. **Automated checks (future):**
   - GitHub Action validates naming conventions
   - Scans for exposed secrets
   - Checks metadata presence
   - Validates links

3. **Human review:**
   - Technical Lead reviews structure/placement
   - Domain expert reviews content (Security Lead for security docs, etc.)
   - Approve if standards met

**Approval criteria:**
- [ ] Correct directory placement
- [ ] Correct naming convention
- [ ] Metadata headers present
- [ ] No security issues
- [ ] Links work
- [ ] README updated (if needed)

### 6.3 Escalation Path

**For disputes about documentation:**

1. **Developer → Technical Lead:** "Where should this doc go?"
2. **Technical Lead → Team Discussion:** Major structural questions
3. **Team → ADR:** Document decision if significant
4. **Emergency:** Security Lead can override for security concerns

**Response SLAs:**
- Simple placement questions: Same day
- Complex structural questions: 2 business days
- ADR decisions: 1 week

### 6.4 Maintenance Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Archive sprint docs | 90 days after completion | Sprint contributor |
| Review security docs | Quarterly | Security Lead |
| Update operational procedures | Monthly | Operations Lead |
| Scan for broken links | Monthly | Technical Lead |
| Audit documentation health | Quarterly | Technical Lead |
| Review archive candidates | Monthly | Technical Lead |

---

## 7. Automation (Future Enhancement)

### 7.1 GitHub Actions

**Planned automation:**

```yaml
# .github/workflows/docs-validation.yml
name: Documentation Validation

on:
  pull_request:
    paths:
      - 'docs/**'
      - '.claude/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Check naming conventions
        run: ./scripts/validate-doc-names.sh

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main

      - name: Validate metadata
        run: ./scripts/check-doc-metadata.sh

      - name: Check for duplicates
        run: ./scripts/detect-duplicate-docs.sh

      - name: Validate links
        uses: lycheeverse/lychee-action@v1
```

### 7.2 Documentation Health Dashboard

**Metrics to track:**
- Total file count by directory
- Files missing metadata
- Files older than 90 days (archive candidates)
- Duplication rate
- Broken links count
- Files outside standard directories

### 7.3 Auto-archival

**Future script:**
```bash
#!/bin/bash
# scripts/auto-archive.sh

# Find sprint docs older than 90 days
# Move to archive with proper structure
# Update links automatically
# Create archive README
# Open PR for review
```

---

## 8. Migration Guide

### 8.1 Existing Documentation

**For documents currently out of compliance:**

1. **Don't panic:** Migration will be gradual
2. **New docs:** Follow standards immediately
3. **Updated docs:** Fix naming/placement when updating
4. **Priority migration:**
   - Sprint 4-6 docs to proper sprint directories
   - Security docs review (highest priority)
   - ADRs to architecture directory

### 8.2 Backward Compatibility

**Grace period (30 days):**
- Old naming conventions still acceptable
- Old placement still discoverable
- Links to old locations will redirect

**After grace period:**
- New docs MUST follow standards
- PRs touching docs should fix non-compliance
- Quarterly cleanup sprints to migrate remaining docs

---

## 9. Success Metrics

### 9.1 30-Day Targets (By 2025-12-12)

- [ ] Zero new files outside defined structure
- [ ] 100% of new docs follow naming standards
- [ ] All sprint 6+ docs in correct sprint directories
- [ ] 5+ ADRs created
- [ ] Security docs reviewed and sanitized

### 9.2 90-Day Targets (By 2026-02-12)

- [ ] <10% duplication rate (down from 23%)
- [ ] Zero security exposures in documentation
- [ ] 90% of docs have complete metadata
- [ ] Automated validation running on PRs
- [ ] Documentation health dashboard live

### 9.3 6-Month Target (By 2026-05-12)

- [ ] Documentation drift rate <5%
- [ ] Team self-sufficient in placement decisions
- [ ] Governance model self-sustaining
- [ ] Archive process automated
- [ ] 100% compliance with standards

---

## 10. Examples

### 10.1 Common Scenarios

#### Scenario 1: Sprint Progress Report
**Question:** "I'm writing a report on Sprint 7 progress. What do I name it and where does it go?"

**Answer:**
- **Name:** `SPRINT_7_PROGRESS_REPORT.md` (Pattern 1: UPPERCASE_UNDERSCORE)
- **Location:** `/docs/sprints/sprint-7/`
- **Metadata:**
  ```markdown
  # Sprint 7 Progress Report

  **Version:** 1.0
  **Last Updated:** 2025-11-20
  **Author/Owner:** Sprint 7 Lead
  **Status:** Active
  ```

#### Scenario 2: New Deployment Procedure
**Question:** "I wrote a guide for deploying with Docker. Where does it go?"

**Answer:**
- **Name:** `docker-deployment-guide.md` (Pattern 2: kebab-case)
- **Location:** `/docs/operations/`
- **Also update:** `/docs/INDEX.md` to link new guide

#### Scenario 3: Security Incident Log
**Question:** "We had a security incident today. How do I document it?"

**Answer:**
- **Name:** `2025-11-12-auth-bypass-incident.md` (Pattern 3: Timestamp)
- **Location:** `/docs/security/incidents/` (create if needed)
- **Archive:** Move to `/docs/archive/security/incidents/2025-11/` after 180 days

#### Scenario 4: Architecture Decision
**Question:** "We decided to use Prisma instead of raw SQL. How do I document this?"

**Answer:**
- **Name:** `ADR-005-prisma-orm-adoption.md` (Pattern 4: ADR format)
- **Location:** `/docs/architecture/`
- **Template:** Use ADR template (Section 4.4)
- **Never archive:** ADRs are permanent historical records

#### Scenario 5: One-Time Analysis
**Question:** "I ran an analysis on test coverage. It's done, where does the report go?"

**Answer:**
- **Name:** `TEST_COVERAGE_ANALYSIS.md` (Pattern 1: UPPERCASE_UNDERSCORE)
- **Location:** `/docs/sprints/sprint-{current}/` during sprint
- **After sprint:** Move to `/docs/archive/test-reports/{YYYY-MM}/`

### 10.2 Before and After

#### Before Standards (Problematic)
```
/
├── SPRINT_4_HANDOFF.md        # Wrong: Sprint doc in root
├── test-login-browser.mjs      # Wrong: Not documentation
├── .claude/
│   ├── SPRINT_5_SESSION_REPORT.md  # Wrong: Should be in sprints
│   ├── LINT_CAMPAIGN_SUMMARY.md    # OK: Agent session context
└── docs/
    ├── archive/
    │   └── oct-22-analysis/     # Wrong: Mislabeled (actually Oct 2025)
    └── sprints/
        └── sprint-4/            # Correct
```

#### After Standards (Correct)
```
/
├── .claude/                    # Agent context only
│   └── PATTERNS.md
└── docs/
    ├── sprints/
    │   ├── sprint-4/
    │   │   ├── README.md
    │   │   └── SPRINT_4_COMPLETION_REPORT.md
    │   ├── sprint-5-6/
    │   │   ├── README.md
    │   │   ├── SPRINT_5_SESSION_REPORT.md
    │   │   └── sessions/
    │   │       └── 2025-11-10-agent-session.md
    │   └── sprint-7/
    │       └── README.md
    ├── architecture/
    │   ├── ADR-001-adopt-diataxis-framework.md
    │   └── ADR-002-documentation-naming-standards.md
    └── archive/
        └── october-2025-analysis/  # Correctly labeled
```

---

## 11. FAQ

### Q: What if I'm not sure where a document goes?
**A:** Use the decision tree in Section 1. If still unclear, ask in #documentation channel or tag the Technical Lead. Response within 1 business day.

### Q: Can I create a new top-level directory?
**A:** No. Top-level directories are defined by these standards. If you believe a new category is needed, create an ADR proposing it and discuss with the team.

### Q: What if a document fits multiple categories?
**A:** Choose the PRIMARY purpose. Use cross-references to link from other relevant docs. Example: A security deployment guide goes in `/docs/operations/` but is cross-referenced from `/docs/security/README.md`.

### Q: Do I need to update old docs to match new standards?
**A:** Not immediately. Fix naming/placement when you update a document. Priority: security docs, then sprint docs, then everything else.

### Q: How do I handle generated documentation?
**A:** Add to `.gitignore`. Generated docs (TypeDoc, API specs from code) should not be committed. Document the generation process in a guide instead.

### Q: What about diagrams and images?
**A:** Store in `{directory}/assets/` subdirectory. Example: `/docs/architecture/assets/system-diagram.png`. Reference in markdown: `![Diagram](./assets/system-diagram.png)`

### Q: Can I abbreviate directory names?
**A:** No. Use full, descriptive names. `multi-tenant` not `mt`, `operations` not `ops`.

### Q: What if I disagree with a placement decision?
**A:** Follow escalation path (Section 6.3). Document your reasoning and propose alternative. Technical Lead will mediate.

---

## 12. Enforcement

### 12.1 Validation

**On every PR touching documentation:**
1. Reviewer checks standards compliance
2. PR description must explain placement decision if non-obvious
3. PR cannot merge without standards compliance

**GitHub Actions (when implemented):**
- Automatic naming validation
- Automatic security scanning
- Automatic metadata check
- Fail build if violations detected

### 12.2 Non-Compliance

**If non-compliant documentation is merged:**
1. Create issue to fix within 7 days
2. Assign to original author
3. Tag Technical Lead
4. Document as learning opportunity (not punitive)

**Repeat violations:**
- Discuss with team lead
- Additional training on standards
- Pair with experienced team member

---

## 13. Future Evolution

### 13.1 Standards Review

**This document will be reviewed:**
- Every 90 days (first review: 2026-02-12)
- After major project changes
- When team feedback suggests improvements

**Version updates:**
- Minor changes: Update "Last Updated" date
- Major changes: Increment version, document in Version History

### 13.2 Continuous Improvement

**Feedback channels:**
- GitHub issues with `documentation` label
- #documentation Slack channel
- Quarterly retro discussions
- Anonymous feedback form

**Changes require:**
- ADR for structural changes
- Team discussion for process changes
- Technical Lead approval for all changes

---

## 14. Related Documents

- [/docs/INDEX.md](/docs/INDEX.md) - Main documentation navigation hub
- [/docs/README.md](/docs/README.md) - Documentation system overview
- [/.claude/DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md](/.claude/DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md) - Audit findings that led to these standards
- [/docs/architecture/ADR-001-adopt-diataxis-framework.md](/docs/architecture/ADR-001-adopt-diataxis-framework.md) - (To be created) Framework decision
- [/CONTRIBUTING.md](/CONTRIBUTING.md) - General contribution guidelines

---

## 15. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-12 | Documentation Systems Specialist | Initial version based on strategic audit findings |

---

**Questions or suggestions?** Contact the Technical Lead or open an issue with the `documentation` label.
