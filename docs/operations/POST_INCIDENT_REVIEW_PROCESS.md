# Post-Incident Review Process

**Owner**: Engineering Team Lead
**Last Updated**: 2025-11-18
**Status**: Active

---

## Purpose

This document establishes the formal process for conducting post-incident reviews (also known as post-mortems) after production incidents. The goal is to learn from failures, prevent recurrence, and continuously improve system reliability.

**Critical Context**: MAIS platform has experienced 3 P0 incidents in 35 days (Nov 6 cache leak, Nov 10 exposed secrets, platform admin bug). This process ensures we learn from these incidents and prevent similar issues.

---

## Incident Classification

### P0 - Critical (Review within 24 hours)

- Complete system outage
- Data breach or security incident
- Cross-tenant data exposure
- Authentication/authorization bypass
- Data loss or corruption
- **Examples from MAIS**:
  - Nov 6: Cross-tenant cache leak (P0)
  - Nov 10: Exposed secrets in git history (P0)
  - Recent: Platform admin authentication bypass (P0)

### P1 - High (Review within 72 hours)

- Partial system outage
- Significant performance degradation
- Feature completely unavailable
- Critical bug affecting multiple tenants

### P2 - Medium (Review in next sprint retrospective)

- Non-critical bugs
- Minor performance issues
- Single-tenant impact

### P3 - Low (Optional review)

- Cosmetic issues
- Documentation gaps discovered

---

## Review Timeline

| Priority | Timeline          | Required Attendees                                     |
| -------- | ----------------- | ------------------------------------------------------ |
| **P0**   | Within 24 hours   | All engineering, Product Owner, Security (if relevant) |
| **P1**   | Within 72 hours   | Incident commander, Engineering leads, Product Owner   |
| **P2**   | Next sprint retro | Incident commander, Affected team members              |
| **P3**   | Optional          | Incident commander only                                |

---

## Review Process

### 1. Incident Commander Responsibilities

**Before the Review (2 hours prep)**:

- [ ] Create incident timeline document
- [ ] Gather all relevant logs, screenshots, metrics
- [ ] Document who was involved and their actions
- [ ] Identify root cause(s) using 5 Whys technique
- [ ] Draft preliminary action items
- [ ] Schedule review meeting with all required attendees

### 2. Review Meeting Structure (60-90 minutes)

**Agenda Template**:

```markdown
# Post-Incident Review: [Incident Name]

**Date**: [Date]
**Incident Commander**: [Name]
**Attendees**: [Names]
**Duration**: [Start] - [End]

## Incident Summary

- **Severity**: P0/P1/P2/P3
- **Detection Time**: [When we first knew]
- **Resolution Time**: [When fully resolved]
- **Customer Impact**: [Number of tenants/users affected]
- **Duration**: [Total time from detection to resolution]

## Timeline

[Detailed chronological timeline]

08:45 - First user report received
08:47 - Engineer investigated, identified cache leak
08:50 - Incident declared, commander assigned
09:15 - Root cause identified (missing tenantId in cache keys)
09:30 - Fix deployed to production
09:45 - Verification complete, incident resolved

## What Went Well ✅

- Fast detection (2 minutes from user report)
- Clear communication in #incidents channel
- Quick root cause identification
- Fix deployed within 45 minutes

## What Went Wrong ❌

- Cache isolation not tested in integration tests
- Code review didn't catch missing tenantId
- No pre-deployment checklist for multi-tenant isolation

## Root Cause Analysis (5 Whys)

1. Why did the incident occur?
   → Cache keys didn't include tenantId, allowing cross-tenant data access

2. Why weren't cache keys scoped by tenant?
   → Developer oversight, no enforcement mechanism

3. Why was there no enforcement?
   → No automated check in CI/CD for tenant isolation

4. Why wasn't this caught in code review?
   → No specific checklist for multi-tenant concerns

5. Why didn't we have a checklist?
   → No formal security review process established

**Root Cause**: Lack of systematic security review process and automated checks for multi-tenant isolation.

## Action Items

[All items assigned with owners and due dates]

| Action Item                                      | Owner     | Due Date | Status         |
| ------------------------------------------------ | --------- | -------- | -------------- |
| Add tenantId validation to all cache operations  | @engineer | Nov 7    | ✅ Done        |
| Create integration tests for cache isolation     | @engineer | Nov 8    | ✅ Done        |
| Add pre-deployment security checklist            | @lead     | Nov 10   | ✅ Done        |
| Implement CI check for tenant isolation patterns | @devops   | Nov 15   | 🔄 In Progress |
| Update code review checklist with security items | @lead     | Nov 12   | ✅ Done        |

## Preventive Measures

- Added to SECURITY_INCIDENT_PREVENTION.md
- All cache operations now require tenantId parameter
- CI fails if cache key doesn't include tenant scope
- Security checklist in PR template

## Documentation Updates

- [ ] Update ARCHITECTURE.md with cache isolation pattern
- [ ] Create ADR-009: Multi-Tenant Cache Isolation
- [ ] Update runbooks with detection/resolution steps
- [ ] Add to incident response playbook

## Communication

- [x] Internal team summary sent
- [ ] Customer communication (if applicable)
- [x] Stakeholder report
```

### 3. Facilitation Guidelines

**Do's**:

- ✅ Focus on systems and processes, not individuals
- ✅ Use "we" language, not "you" language
- ✅ Assume good intentions
- ✅ Seek to understand, not to blame
- ✅ Document learnings comprehensively
- ✅ Follow up on all action items

**Don'ts**:

- ❌ Blame individuals
- ❌ Skip the review due to time pressure
- ❌ Create action items without owners
- ❌ Forget to document learnings
- ❌ Let action items languish without follow-up

---

## 5 Whys Technique

The "5 Whys" helps identify root causes by repeatedly asking "why" until you reach a systemic issue.

**Example from Nov 6 Cache Leak**:

1. **Why** did cross-tenant data leak occur?
   → Cache keys didn't include tenantId

2. **Why** didn't cache keys include tenantId?
   → Developer created cache utility without tenant scoping

3. **Why** wasn't tenant scoping enforced?
   → No automated check or lint rule

4. **Why** was there no automated check?
   → Security automation not prioritized

5. **Why** wasn't it prioritized?
   → No formal security review process after incidents

**Root Cause**: Lack of systematic security process

---

## Action Item Tracking

### Creating Effective Action Items

**Good Action Items** (Specific, Measurable, Assigned, Time-bound):

- ✅ "Add integration test for cache isolation by Nov 8" (@engineer)
- ✅ "Create SECURITY_INCIDENT_PREVENTION.md by Nov 10" (@lead)
- ✅ "Implement CI check for tenant isolation by Nov 15" (@devops)

**Bad Action Items** (Vague, Unassigned, No Deadline):

- ❌ "Improve security"
- ❌ "Better testing"
- ❌ "Someone should document this"

### Tracking System

**All action items must**:

1. Be added to project management tool (GitHub Issues, Jira, etc.)
2. Have explicit owner assigned
3. Have realistic due date
4. Be tracked in sprint planning
5. Be reviewed weekly until complete

### Follow-Up Cadence

- **P0 Action Items**: Daily check-ins until complete
- **P1 Action Items**: Review in daily standup
- **P2 Action Items**: Review in weekly planning
- **P3 Action Items**: Review in sprint retrospective

---

## Documentation Updates

After every incident review, update relevant documentation:

### Required Updates

**Always Update**:

- [ ] Incident log (append to CHANGELOG.md or dedicated incident log)
- [ ] Runbooks with new detection/resolution procedures
- [ ] Architecture docs if systemic change made

**Update If Applicable**:

- [ ] Create new ADR if architectural decision made
- [ ] Update SECURITY.md if security pattern changed
- [ ] Update deployment checklist if new validation needed
- [ ] Update code review checklist if new criteria identified
- [ ] Update monitoring/alerting documentation

### ADR Creation Triggers

Create an ADR if incident reveals:

- Need for architectural change
- Technology choice that prevented incident
- New pattern that should be standardized
- Security model that needs documentation

**Example**: Nov 6 cache leak → Created ADR-009 "Multi-Tenant Cache Isolation"

---

## Communication Protocol

### Internal Communication

**During Review**:

- Share preliminary timeline in team chat
- Invite feedback from anyone involved
- Post summary in #engineering channel

**After Review**:

- Email summary to all attendees
- Share key learnings in all-hands meeting
- Update team documentation

### External Communication (If Customer-Impacting)

**When to Communicate**:

- Any P0 incident affecting customer data
- Any P1 incident with >1 hour downtime
- Any security incident, regardless of severity

**Communication Template**:

```markdown
Subject: [Date] Incident Report - [Brief Description]

Dear [Customer/Stakeholders],

On [Date] at [Time], we experienced [brief description]. The incident
was fully resolved by [Time], lasting approximately [Duration].

**What Happened**:
[2-3 sentences explaining what users experienced]

**Impact**:

- [Number] of users affected
- [Features] were unavailable
- [Duration] of service disruption

**Root Cause**:
[1-2 sentences explaining why it happened]

**Resolution**:
[What we did to fix it]

**Prevention**:
[What we're doing to prevent recurrence]

We sincerely apologize for the disruption. If you have any questions,
please contact [support email/person].

Best regards,
[Name, Title]
```

---

## Review Checklist

Use this checklist for every post-incident review:

### Preparation Phase

- [ ] Incident timeline created with exact timestamps
- [ ] All logs and metrics gathered
- [ ] Screenshots/evidence collected
- [ ] Initial root cause hypothesis formed
- [ ] 5 Whys analysis completed
- [ ] Review meeting scheduled with required attendees
- [ ] Agenda document created and shared 24h before meeting

### Review Meeting

- [ ] All required attendees present
- [ ] Timeline reviewed chronologically
- [ ] "What went well" discussed (celebrate good responses)
- [ ] "What went wrong" discussed (blameless)
- [ ] Root cause analysis validated
- [ ] Action items created with owners and dates
- [ ] Communication plan agreed upon
- [ ] Documentation updates identified

### Follow-Up Phase

- [ ] All action items added to tracking system
- [ ] Action items assigned and accepted by owners
- [ ] Due dates confirmed as realistic
- [ ] Internal summary shared with team
- [ ] External communication sent (if applicable)
- [ ] Documentation updates scheduled
- [ ] Review document stored in docs/incidents/ directory
- [ ] Follow-up review scheduled (2-4 weeks out)

### Quality Checks

- [ ] Root cause is systemic, not individual
- [ ] Action items are specific and measurable
- [ ] All action items have owners
- [ ] Timeline is accurate and complete
- [ ] Review document is well-organized
- [ ] Learnings are documented for future reference

---

## Template Files

### Create New Incident Review

```bash
# Create new incident review from template
cp docs/templates/incident-review-template.md \
   docs/incidents/YYYY-MM-DD-incident-name.md
```

### Incident Review Template

Location: `docs/templates/incident-review-template.md`

```markdown
# Post-Incident Review: [INCIDENT NAME]

**Date**: YYYY-MM-DD
**Incident Commander**: [@username]
**Severity**: P0/P1/P2/P3
**Status**: [Draft/Final]

## Quick Reference

- **Detection**: [When we first knew]
- **Resolution**: [When fully resolved]
- **Impact**: [Who/what was affected]
- **Duration**: [Total time]

## Timeline

[Chronological events]

## What Went Well ✅

[Things that worked]

## What Went Wrong ❌

[Things that failed]

## Root Cause Analysis (5 Whys)

[5 Whys here]

**Root Cause**: [Final answer]

## Action Items

| Action | Owner | Due | Status |
| ------ | ----- | --- | ------ |
|        |       |     |        |

## Preventive Measures

[What we changed]

## Documentation Updates

- [ ] [List updates needed]

## Communication

- [ ] [Who needs to know]
```

---

## Success Metrics

Track these metrics to measure incident review effectiveness:

### Leading Indicators

- % of incidents with completed review (target: 100%)
- Average time to complete review (target: <24h for P0, <72h for P1)
- % of action items with owners (target: 100%)
- % of action items completed on time (target: >80%)

### Lagging Indicators

- Incident recurrence rate (target: <5%)
- Mean time to recovery (MTTR) trend (target: decreasing)
- Customer satisfaction after incidents (target: >70%)
- Number of preventive improvements implemented (target: >3 per incident)

---

## Historical Incident Reviews

### Required Reviews (To Be Completed)

**Nov 6, 2025 - Cross-Tenant Cache Leak (P0)**:

- [ ] Create incident review document
- [ ] Conduct team review
- [ ] Document root cause
- [ ] Create action items
- [ ] Create ADR-009

**Nov 10, 2025 - Exposed Secrets in Git (P0)**:

- [ ] Create incident review document
- [ ] Conduct team review
- [ ] Document root cause
- [ ] Create action items
- [ ] Update secret management procedures

**Recent - Platform Admin Auth Bypass (P0)**:

- [ ] Create incident review document
- [ ] Conduct team review
- [ ] Document root cause
- [ ] Create action items
- [ ] Update authentication testing

**Action**: Schedule reviews for all 3 incidents by end of week.

---

## Related Documentation

- [SECURITY_INCIDENT_PREVENTION.md](./SECURITY_INCIDENT_PREVENTION.md) - Prevention checklist
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) - Response playbook
- [RUNBOOK.md](./RUNBOOK.md) - Operational procedures
- [docs/incidents/](../incidents/) - Historical incident reviews

---

## Continuous Improvement

This process should evolve based on our learnings:

### Quarterly Process Review

- Review effectiveness of past incident reviews
- Update template based on learnings
- Adjust timelines if needed
- Refine root cause analysis techniques
- Update success metrics

### Annual Process Audit

- Compare MAIS incident review process to industry best practices
- Benchmark against similar companies
- Consider external facilitation for critical incidents
- Update training materials

---

**Last Updated**: 2025-11-18
**Next Review**: 2026-02-18 (Quarterly)
**Process Owner**: Engineering Team Lead

---

## Quick Start

**For Incident Commanders**: When an incident occurs:

1. **Immediately** after resolution:

   ```bash
   # Create new incident review
   cp docs/templates/incident-review-template.md \
      docs/incidents/$(date +%Y-%m-%d)-[incident-name].md
   ```

2. **Within 2 hours**: Draft timeline and initial analysis

3. **Within 24 hours** (P0) or **72 hours** (P1): Schedule and conduct review

4. **Within 48 hours**: Complete all documentation and action items

5. **Weekly**: Follow up on action item progress until all complete

**Need Help?** Ping @engineering-lead in #incidents channel.
