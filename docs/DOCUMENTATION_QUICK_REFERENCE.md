# Documentation Quick Reference

**Fast answers to common documentation questions. For full details, see [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)**

---

## Where Does My Document Go?

| Document Type          | Location                    | Example                         |
| ---------------------- | --------------------------- | ------------------------------- |
| Sprint report/progress | `/docs/sprints/sprint-{N}/` | `SPRINT_6_COMPLETION_REPORT.md` |
| Deployment guide       | `/docs/operations/`         | `deployment-guide.md`           |
| API documentation      | `/docs/api/`                | `api-integration-guide.md`      |
| Security procedure     | `/docs/security/`           | `SECRET_ROTATION_GUIDE.md`      |
| Setup/config guide     | `/docs/setup/`              | `ENVIRONMENT.md`                |
| Architecture decision  | `/docs/architecture/`       | `ADR-001-framework.md`          |
| Feature roadmap        | `/docs/roadmaps/`           | `widget-implementation-plan.md` |
| Multi-tenant doc       | `/docs/multi-tenant/`       | `tenant-admin-guide.md`         |
| Phase report           | `/docs/phases/`             | `PHASE_4_COMPLETION_REPORT.md`  |
| Old/superseded doc     | `/docs/archive/{category}/` | `archive/sprints/sprint-1-3/`   |

**Still not sure?** Use the [decision tree](./DOCUMENTATION_STANDARDS.md#quick-decision-trees) in the standards doc.

---

## What Do I Name My File?

### Pattern 1: UPPERCASE_UNDERSCORE

**Use for:** Reports, audits, summaries, completion documents

```
SPRINT_6_COMPLETION_REPORT.md
SECURITY_AUDIT_PHASE_2B.md
TEST_STABILIZATION_SUMMARY.md
```

### Pattern 2: kebab-case

**Use for:** Guides, tutorials, how-to documents

```
deployment-guide.md
quick-start-tutorial.md
local-testing-guide.md
```

### Pattern 3: YYYY-MM-DD-description

**Use for:** Time-specific reports, incident logs

```
2025-11-12-incident-response.md
2025-11-07-sprint-planning.md
```

### Pattern 4: ADR-###-title

**Use for:** Architectural Decision Records ONLY

```
ADR-001-adopt-diataxis-framework.md
ADR-002-documentation-naming-standards.md
```

---

## Required Headers (Copy-Paste This)

```markdown
# Document Title

**Version:** 1.0
**Last Updated:** 2025-11-12
**Author/Owner:** [Your Name or Role]
**Status:** [Active | Draft | Deprecated | Archived]

---

## Purpose

[1-2 sentence description of what this document is for]

---

[Your content starts here]
```

---

## Pre-Commit Checklist

Before committing documentation, check:

- [ ] **Correct location** - Used decision tree to verify
- [ ] **Correct naming** - Followed one of the 4 patterns
- [ ] **Metadata headers** - Included version, date, owner, status
- [ ] **No secrets** - Ran: `grep -r -E '(password|api_key|secret|token)[:=]' docs/`
- [ ] **README updated** - Parent directory README lists new doc (if major)
- [ ] **INDEX updated** - Added to `/docs/INDEX.md` (if major doc)

---

## Common Scenarios

### "I'm writing a Sprint progress report"

- **Name:** `SPRINT_{N}_PROGRESS_REPORT.md`
- **Location:** `/docs/sprints/sprint-{N}/`

### "I wrote a new deployment procedure"

- **Name:** `{service}-deployment-guide.md`
- **Location:** `/docs/operations/`

### "We had a security incident"

- **Name:** `YYYY-MM-DD-{incident-type}-incident.md`
- **Location:** `/docs/security/incidents/`
- **Archive after:** 180 days

### "We made an architecture decision"

- **Name:** `ADR-{NNN}-{decision-title}.md`
- **Location:** `/docs/architecture/`
- **Template:** Copy `ADR-TEMPLATE.md`
- **Never archive**

### "I finished a one-time analysis"

- **Name:** `{SUBJECT}_ANALYSIS.md`
- **Location:** `/docs/sprints/sprint-{current}/` during sprint
- **Archive:** Move to `/docs/archive/{category}/{YYYY-MM}/` after 90 days

---

## When to Archive

| Document Type     | Archive After              | New Location                                  |
| ----------------- | -------------------------- | --------------------------------------------- |
| Sprint docs       | 90 days after completion   | `/docs/archive/sprints/sprint-{N}/`           |
| Incident logs     | 180 days after resolution  | `/docs/archive/security/incidents/{YYYY-MM}/` |
| Analysis reports  | After completion + 90 days | `/docs/archive/{category}/{YYYY-MM}/`         |
| Superseded guides | Immediately when replaced  | `/docs/archive/{original-category}/`          |

**Never archive:**

- ADRs (they're historical by nature)
- Core guides (ARCHITECTURE.md, SECURITY.md, RUNBOOK.md)
- Active procedures (deployment guides, incident response)
- README.md files

---

## Security Scan Commands

**Before committing, run:**

```bash
# Scan for potential secrets
grep -r -E '(password|api_key|secret|token)[:=]' docs/

# Check for high-risk patterns
grep -r -E '(sk_live|pk_live|postgres://|mongodb://)' docs/

# Run full validation
./scripts/validate-docs.sh
```

---

## Need Help?

1. **Check the full standards:** [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
2. **Ask in #documentation** channel
3. **Tag the Technical Lead** for placement questions
4. **Response time:** Same day for simple questions, 2 days for complex

---

## Links

- **Full Standards:** [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
- **Main Index:** [INDEX.md](./INDEX.md)
- **ADR Template:** [architecture/ADR-TEMPLATE.md](./architecture/ADR-TEMPLATE.md)
- **Validation Script:** [/scripts/validate-docs.sh](/scripts/validate-docs.sh)

---

**Last Updated:** 2025-11-12
