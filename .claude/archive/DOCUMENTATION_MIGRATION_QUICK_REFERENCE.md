# Documentation Migration Quick Reference

**Status**: Ready for Execution
**Start Date**: TBD (awaiting approval)
**Estimated Duration**: 3 weeks (106 hours)

---

## 📊 At a Glance

```
Current State:          Target State:
261 files              261 files (100% accounted for)
9 categories           4 quadrants + archive
33 files scattered     0 files scattered
23% duplication        <5% duplication
~10% with metadata     100% with metadata
No governance          Automated governance
```

---

## 🎯 The Four Quadrants

### 1. TUTORIALS (Learning-Oriented)

**Goal**: Teach beginners by doing
**Count**: 5 new tutorials
**Examples**:

- Quick Start (15 minutes)
- Create Your First Tenant
- Complete Your First Booking
- Navigate Admin Dashboard
- Integrate Widget on Website

### 2. HOW-TO GUIDES (Problem-Solving)

**Goal**: Solve specific real-world problems
**Count**: 28 guides
**Examples**:

- Deploy to Production
- Rotate JWT Secrets
- Debug Multi-Tenant Issue
- Handle Production Incident
- Write Integration Test

### 3. REFERENCE (Information Lookup)

**Goal**: Provide factual details for lookup
**Count**: 18 docs
**Examples**:

- API Endpoints Reference
- Environment Variables Reference
- Database Schema Reference
- Error Codes Reference
- Stripe Connect API Reference

### 4. EXPLANATION (Understanding Concepts)

**Goal**: Clarify WHY and HOW things work
**Count**: 12 docs
**Examples**:

- Why Multi-Tenant Architecture?
- Modular Monolith Deep Dive
- Mock-First Development Philosophy
- Commission Calculation Logic
- Config-Driven Platform Vision

---

## 📅 Timeline (3 Weeks)

### Week 1: Foundation + Core Docs (49 hours)

```
Mon-Tue  : Create structure + governance (12h)
Wed      : Write tutorials (11h)
Thu      : Write how-to guides (9h)
Fri      : Write reference + explanation (17h)
```

### Week 2: Archive + Remaining (27 hours)

```
Mon-Tue  : Archive migration (11h)
Wed-Thu  : Client/server docs (7h)
Fri      : Root docs update (6.5h) + misc archive (2.5h)
```

### Week 3: Cleanup + Launch (30 hours)

```
Mon-Tue  : Deduplication + link validation (11.5h)
Wed-Thu  : Write ADR, learning materials, training (12h)
Fri      : Merge, monitor, iterate (5h + ongoing)
```

---

## 🚀 Quick Start Commands

### Pre-Migration

```bash
# Create backup
tar -czf docs-backup-$(date +%Y%m%d).tar.gz docs/ .claude/ *.md

# Create migration branch
git checkout -b docs/migrate-to-diataxis

# Install link checker
npm install -D markdown-link-check
```

### Phase 1: Foundation

```bash
# Create directory structure
mkdir -p docs/{tutorials,how-to,reference,explanation,archive}
mkdir -p docs/how-to/{deployment,development,operations,tenant-admin}
mkdir -p docs/reference/{api,architecture,configuration,cli,client,server,testing}
mkdir -p docs/explanation/{architecture,patterns,security,project-history}
mkdir -p docs/archive/{2025-11,2025-10,2025-01}

# Write foundation READMEs (manual - see plan for content)
```

### Link Validation

```bash
# Check all docs
find docs/ -name "*.md" -exec markdown-link-check {} \;

# Check specific file
markdown-link-check docs/README.md
```

### Rollback (if needed)

```bash
# Revert merge commit
git revert <merge-commit-sha>
git push origin main --force-with-lease

# Or restore from backup
tar -xzf docs-backup-YYYYMMDD.tar.gz
```

---

## 🗺️ Decision Tree: Where Does My Doc Go?

```
START: I have a document
│
├─ Teaching a beginner? → tutorials/
│
├─ Solving a specific problem? → how-to/
│  ├─ Deployment? → how-to/deployment/
│  ├─ Development? → how-to/development/
│  ├─ Operations? → how-to/operations/
│  └─ Tenant Admin? → how-to/tenant-admin/
│
├─ Factual reference? → reference/
│  ├─ API? → reference/api/
│  ├─ Configuration? → reference/configuration/
│  ├─ Architecture? → reference/architecture/
│  └─ Testing? → reference/testing/
│
├─ Explaining WHY? → explanation/
│  ├─ Architecture? → explanation/architecture/
│  ├─ Patterns? → explanation/patterns/
│  └─ Security? → explanation/security/
│
└─ Historical/completed? → archive/YYYY-MM/
   ├─ Sprint report? → archive/YYYY-MM/sprints/
   ├─ Phase report? → archive/YYYY-MM/phases/
   └─ Audit report? → archive/YYYY-MM/audits/
```

---

## ✅ Quality Checklist

### Every Doc Must Have:

- [ ] Clear title and purpose
- [ ] Metadata block (Last Updated, Category, Owner, Status)
- [ ] Relative links (not absolute URLs)
- [ ] Tested examples (if code included)
- [ ] Located in correct quadrant
- [ ] Linked from appropriate README

### Pre-Merge Validation:

- [ ] Link checker passes (0 broken links)
- [ ] Metadata validator passes (100% compliant)
- [ ] Structure validator passes (0 files outside structure)
- [ ] All tutorials tested end-to-end
- [ ] Root README navigation works
- [ ] 2+ team members reviewed PR
- [ ] CI passes

---

## 📈 Success Metrics

### 30 Days Post-Migration

- ✅ Zero files outside structure
- ✅ Zero broken links
- ✅ 100% metadata compliance
- ✅ 80%+ team adoption

### 90 Days Post-Migration

- ✅ <5% duplication rate (from 23%)
- ✅ Zero security exposures
- ✅ 90%+ team self-sufficiency
- ✅ 80%+ user satisfaction

### 6 Months Post-Migration

- ✅ <5% documentation drift
- ✅ Governance self-sustaining
- ✅ Documentation as competitive advantage

---

## 🔗 Key Resources

- **Full Plan**: [DOCUMENTATION_MIGRATION_PLAN.md](./DOCUMENTATION_MIGRATION_PLAN.md)
- **Executive Summary**: [DOCUMENTATION_MIGRATION_EXECUTIVE_SUMMARY.md](./DOCUMENTATION_MIGRATION_EXECUTIVE_SUMMARY.md)
- **Strategic Audit**: [DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md](./DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md)
- **Diátaxis Framework**: https://diataxis.fr/

---

## 🚨 Red Flags to Watch For

During migration, STOP and investigate if you see:

- ❌ More than 10 broken links in a single phase
- ❌ Files you can't categorize (ask team)
- ❌ Duplicate content you didn't know about
- ❌ CI/CD scripts referencing old paths
- ❌ Team pushback on new structure (gather feedback)

---

## 💡 Pro Tips

1. **Start small**: Do Phase 1 (foundation) first, validate, then continue
2. **Test as you go**: Don't wait until end to validate links
3. **Communicate often**: Daily Slack updates, weekly team sync
4. **Keep old structure**: Don't delete until migration complete and validated
5. **Iterate**: This is v1.0 of structure - expect refinements based on usage

---

## 📞 Get Help

- **Questions?** Ask in #docs Slack channel
- **Stuck on categorization?** Use decision tree above or ask team
- **Technical issues?** Check full plan for troubleshooting section
- **Need approval?** Review executive summary with stakeholders

---

_Last Updated: 2025-11-12_
_Version: 1.0_
_Status: Ready for Execution_
