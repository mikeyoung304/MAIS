# Growth Assistant UI - Deliverables & Document Index

> **Overview:** Complete deliverables for Growth Assistant default-open + content-push feature
>
> **Status:** Planning & Design Phase (Ready for Implementation Review)
>
> **Created:** 2025-12-28

---

## Four Main Documents

This feature has been analyzed and documented from four complementary perspectives:

### 1. **BDD Analysis** (Complete SpecFlow Format)

**File:** `GROWTH_ASSISTANT_UI_BDD_ANALYSIS.md`

**Contains:**

- User stories with Gherkin scenarios
- 5 acceptance criteria suites
- 5 edge cases with mitigation strategies
- Mobile/responsive design specifications
- Accessibility requirements (WCAG AA)
- Success metrics (UX + technical)
- 7-phase implementation checklist
- Risk assessment matrix
- Complete SpecFlow feature definitions

**Audience:** Product, design, QA, engineering leads
**Read Time:** 45 minutes
**Use When:** Planning, design review, defining acceptance criteria

---

### 2. **Quick Spec** (TL;DR Implementation Guide)

**File:** `GROWTH_ASSISTANT_UI_QUICK_SPEC.md`

**Contains:**

- 3 core changes summarized (default open, push content, Cmd+K)
- Mobile breakpoint strategy
- MVP acceptance criteria (12 items)
- Testing checklist (unit, integration, E2E, manual)
- 5 common gotchas with solutions
- Success metrics (tracking)
- File change summary (4 files, ~40 lines)
- Implementation order (5 steps)
- Frequently asked questions

**Audience:** Developers, QA, sprint planning
**Read Time:** 15 minutes
**Use When:** Starting implementation, daily stand-ups, code review

---

### 3. **Comprehensive Test Plan** (45+ Test Cases)

**File:** `GROWTH_ASSISTANT_UI_TEST_PLAN.md`

**Contains:**

- Unit tests (3 suites, ~30 test cases)
  - `useGrowthAssistant` hook tests
  - `GrowthAssistantPanel` component tests
  - Layout structure tests
- Integration tests (2 suites, ~12 test cases)
  - Layout integration (sidebar + main + panel)
  - Keyboard interaction (Cmd+K, Escape, focus management)
- E2E tests (4 suites, ~25 test cases) in Playwright
  - Panel visibility & interaction
  - Content push behavior
  - Keyboard shortcuts
  - Mobile responsiveness
- Manual QA checklist (9 sections)
  - Desktop (3 resolutions: 1920px, 2560px, 3440px)
  - Mobile (3 resolutions: 320px, 375px, 414px)
  - Tablet (2 orientations)
  - Browser compatibility (4 browsers)
  - Feature testing (6 items)
- Performance testing (Lighthouse + network throttling)
- Accessibility testing (automated + manual)
- Regression testing (critical paths)
- Sign-off criteria (12 items + 3 sign-offs)

**Audience:** QA engineers, testing leads
**Read Time:** 30 minutes
**Use When:** Writing tests, planning QA, test execution

---

### 4. **This Document** (Index & Navigation)

**File:** `GROWTH_ASSISTANT_UI_DELIVERABLES.md`

**Contains:**

- Document index and relationships
- Quick navigation guide
- Document reading order
- File summary table
- How to use each document
- Questions answered by each document

**Audience:** Everyone (entry point)
**Read Time:** 10 minutes
**Use When:** Starting work, finding the right document

---

## Document Relationships

```
┌─────────────────────────────────────────────────┐
│       GROWTH_ASSISTANT_UI_DELIVERABLES.md       │
│              (You are here - INDEX)              │
└────────────┬────────────────────────────┬────────┘
             │                            │
             ├────────────────────────────┼────────────────┬─────────────────┐
             │                            │                │                 │
    (Planning phase)           (Dev phase)        (QA phase)      (Ongoing)
             │                    │                │                 │
      ▼                      ▼              ▼                 ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐
│ BDD Analysis    │  │ Quick Spec       │  │ Test Plan        │  │ (Future docs)  │
│                 │  │                  │  │                  │  │                │
│ • Scenarios     │  │ • 3 core changes │  │ • Unit tests     │  │ • Post-launch  │
│ • Acceptance    │  │ • MVP criteria   │  │ • Integration    │  │   monitoring   │
│   criteria      │  │ • Gotchas        │  │ • E2E tests      │  │ • Metrics      │
│ • Edge cases    │  │ • Metrics        │  │ • Manual QA      │  │ • Feedback     │
│ • Accessibility │  │ • FAQ            │  │ • Performance    │  │                │
│ • Success       │  │                  │  │ • Sign-off       │  │                │
│   metrics       │  │                  │  │                  │  │                │
│                 │  │ 15 min read      │  │ 30 min read      │  │                │
│ 45 min read     │  │                  │  │                  │  │                │
└─────────────────┘  └──────────────────┘  └──────────────────┘  └────────────────┘
        │                    │                      │
        │ Read FIRST         │ Read SECOND         │ Read THIRD
        │ (understand)       │ (implement)         │ (validate)
```

---

## How to Use These Documents

### For Product Managers / UX Designers

1. **Start with:** BDD Analysis (`GROWTH_ASSISTANT_UI_BDD_ANALYSIS.md`)
   - Understand user stories and use cases
   - Review success metrics
   - Check mobile/responsive design specs
   - Confirm brand voice alignment

2. **Then read:** Quick Spec - FAQ section
   - Answer "why these decisions?"
   - Confirm scope and tradeoffs

3. **Action:** Approve acceptance criteria (MVP section) in Quick Spec

---

### For Developers / Implementation

1. **Start with:** Quick Spec (`GROWTH_ASSISTANT_UI_QUICK_SPEC.md`)
   - Understand the 3 core changes
   - See which files change (only 4!)
   - Review MVP acceptance criteria
   - Check gotchas section

2. **Then read:** BDD Analysis - "Implementation Checklist"
   - See detailed phase breakdown
   - Understand dependencies
   - Plan sprint allocation

3. **Implement:** Following Quick Spec order (5 steps)

4. **Validate:** Against BDD Analysis acceptance criteria

---

### For QA / Test Engineers

1. **Start with:** BDD Analysis - "Edge Cases" section
   - Understand what could break
   - Review mobile/responsive specs
   - Check accessibility requirements

2. **Then read:** Test Plan (`GROWTH_ASSISTANT_UI_TEST_PLAN.md`)
   - Write unit tests (use provided test suites as templates)
   - Plan E2E tests (use Playwright code samples)
   - Create manual QA checklist from mobile/browser sections

3. **Execute:** Test cases in order:
   - Unit tests first (fastest feedback)
   - Integration tests next (interaction validation)
   - E2E tests (full user flows)
   - Manual QA (edge cases, accessibility, performance)

4. **Sign-off:** Use "Sign-Off Criteria" section

---

### For Engineering Leads / Architects

1. **Read all four documents** (2-3 hours total)
   - Understand full scope
   - Review risk assessment
   - Check technical decisions

2. **Focus on:**
   - BDD Analysis: "Implementation Phases" and "Risk Assessment"
   - Quick Spec: "File Changes Summary"
   - Test Plan: "Sign-Off Criteria"

3. **Review:** Acceptance criteria with product
4. **Approve:** Sprint planning and resource allocation

---

## Document Contents Quick Reference

| Question                      | Document          | Section                |
| ----------------------------- | ----------------- | ---------------------- |
| **What's the feature?**       | All               | Executive Summary      |
| **Why this design?**          | BDD or Quick Spec | FAQ                    |
| **What are user stories?**    | BDD               | Feature / User Stories |
| **What could go wrong?**      | BDD               | Edge Cases             |
| **How do I build it?**        | Quick Spec        | Implementation Order   |
| **What code changes?**        | Quick Spec        | File Changes Summary   |
| **How do I test it?**         | Test Plan         | All sections           |
| **Is it accessible?**         | BDD or Test Plan  | Accessibility section  |
| **How long will this take?**  | BDD               | Timeline               |
| **What are gotchas?**         | Quick Spec        | Potential Gotchas      |
| **How do I measure success?** | BDD or Quick Spec | Success Metrics        |
| **Is this production-ready?** | Test Plan         | Sign-Off Criteria      |

---

## Key Decisions Documented

### 1. Default Open State

**Decision:** Panel starts open (not closed)

**Rationale (see BDD Analysis § Feature / User Stories § Story 1):**

- Discoverability: Users forget features they must enable
- Adoption: Always-visible features have 2-3x higher usage
- Onboarding: New tenants see help is available immediately

**Edge Cases Handled (see BDD Analysis § Edge Cases):**

- Hydration mismatch (solved with `isMounted` state)
- localStorage corruption (graceful fallback to boolean)
- Multi-tab synchronization (documented as expected limitation)

---

### 2. Content Push (Not Overlay)

**Decision:** Main content shifts right when panel opens, doesn't overlay

**Rationale (see BDD Analysis § Feature / User Stories § Story 2):**

- Content stability: Users don't lose their place when panel appears
- Familiar UX: Gmail sidebar, IDE editors use push pattern
- Prevents accidental clicks on hidden content

**Mobile Adaptation (see BDD Analysis § Mobile & Responsive Design):**

- Desktop (≥1024px): Panel is side column, content shifts right
- Tablet (768-1023px): Panel is 90vw overlay (less screen space)
- Mobile (<768px): Panel is bottom sheet, content stays full-width

---

### 3. Cmd+K Keyboard Shortcut

**Decision:** Cmd+K (Mac) / Ctrl+K (Windows) toggles panel and focuses input

**Rationale (see Quick Spec § 3. Keyboard Shortcut):**

- Industry standard: VS Code, Figma, Arc browser, Slack use Cmd+K
- Discoverability: Users already know and expect this shortcut
- Power user: Faster than mouse for frequent users

**Safety Features (see Quick Spec § Keyboard Shortcut Conflicts):**

- Doesn't trigger when typing in inputs (checks event.target)
- PreventDefault() avoids browser command palette conflict
- Escape key closes panel (familiar escape hatch)

---

## Measurement & Metrics

### UX Metrics (see BDD Analysis § Success Metrics & Measurement)

Track these after launch via analytics:

| Metric           | Target                            | How to Measure                             |
| ---------------- | --------------------------------- | ------------------------------------------ |
| Panel Discovery  | 85%+ of new tenants see it        | `growth_assistant_opened_first_time` event |
| Weekly Usage     | 60%+ of active tenants use weekly | `messages_sent_to_agent` event count       |
| Session Duration | +15% increase                     | Segment: avg session time before/after     |
| Bounce Rate      | -5% reduction                     | Mixpanel: tenants who interact stay longer |
| Click Fatigue    | <2 clicks to access               | UX task completion analysis                |

### Technical Metrics (see BDD Analysis § Success Metrics & Measurement)

Monitor in production:

| Metric        | Target    | How to Measure                   |
| ------------- | --------- | -------------------------------- |
| CLS           | <0.1      | Lighthouse, Sentry monitoring    |
| LCP           | <2.5s     | Lighthouse, real user monitoring |
| Panel Load    | <100ms    | DevTools Network tab             |
| Accessibility | ≥95 score | axe DevTools, WCAG AA audit      |

---

## File Dependencies

These files must be created/modified for the feature to work:

### Created / Modified Files

**Core Implementation (4 files, ~40 lines total):**

1. **`apps/web/src/hooks/useGrowthAssistant.ts`**
   - Change: `isOpen` defaults to `true` (not `false`)
   - Lines: ~5 changes
   - Complexity: Trivial

2. **`apps/web/src/app/(protected)/tenant/layout.tsx`**
   - Change: Update layout from simple main to flex (sidebar + main + panel)
   - Change: Add Cmd+K keyboard listener
   - Change: Add dynamic right padding based on panel state
   - Lines: ~30 changes
   - Complexity: Medium

3. **`apps/web/src/components/agent/GrowthAssistantPanel.tsx`**
   - Change: Minor CSS tweaks to support new layout
   - Lines: ~5 changes
   - Complexity: Low

4. **`apps/web/src/components/agent/PanelAgentChat.tsx`**
   - Change: No changes needed (existing component)
   - Lines: 0
   - Complexity: N/A

**Test Files (to be created):**

- `apps/web/src/hooks/useGrowthAssistant.test.ts` (~80 lines)
- `apps/web/src/components/agent/GrowthAssistantPanel.test.tsx` (~60 lines)
- `apps/web/test/integration/layout-panel-integration.test.ts` (~80 lines)
- `apps/web/test/integration/keyboard-shortcuts.test.ts` (~100 lines)
- `apps/web/e2e/tests/growth-assistant-*.spec.ts` (4 files, ~200 lines)

---

## Implementation Timeline

Based on BDD Analysis § Timeline & Dependencies:

| Phase               | Duration      | Effort                |
| ------------------- | ------------- | --------------------- |
| Layout architecture | 3-4 days      | 3-4 developer-days    |
| Default open state  | 2-3 days      | 1-2 developer-days    |
| Keyboard shortcuts  | 3-4 days      | 2-3 developer-days    |
| Responsive design   | 4-5 days      | 3-4 developer-days    |
| Accessibility       | 3-4 days      | 2-3 developer-days    |
| Testing & QA        | 5-7 days      | 4-5 QA-days           |
| **Total**           | **3-4 weeks** | **15-21 person-days** |

**By Component:**

- Frontend: 12-16 days
- QA/Testing: 4-5 days
- Design/Product review: 2-3 days

---

## Risk & Mitigation

Critical risks documented in BDD Analysis § Risk Assessment & Mitigation:

| Risk                        | Likelihood | Mitigation                                      |
| --------------------------- | ---------- | ----------------------------------------------- |
| Layout shift (CLS > 0.1)    | Medium     | Use skeleton/fixed container, monitor in Sentry |
| Mobile UX broken            | Medium     | Test at 320px, use bottom sheet pattern         |
| Keyboard shortcut conflicts | Low        | Document conflicts, use event.target check      |
| localStorage unavailable    | Low        | Graceful fallback to session state              |
| Performance regression      | Medium     | Monitor LCP/CLS, lazy-load panel                |

---

## What's NOT Included

These features are explicitly out of scope (future enhancements):

- [ ] Real-time localStorage sync across browser tabs (use storage event listener)
- [ ] "Hide by default" preference in settings (can be added later)
- [ ] Keyboard shortcut customization (requires settings infrastructure)
- [ ] Panel width customization (fixed at 400px for now)
- [ ] Drag-to-resize panel (nice-to-have, adds complexity)

---

## Approval Checklist

Before starting implementation, confirm:

- [ ] **Product** approves user stories and acceptance criteria (BDD Analysis)
- [ ] **Design** approves brand voice and mobile breakpoints (BDD Analysis § Brand Voice & Design)
- [ ] **Engineering Lead** approves technical approach (Quick Spec)
- [ ] **Accessibility** approves WCAG AA compliance (BDD Analysis § Accessibility)
- [ ] **QA** approves test plan (Test Plan)

---

## Document Maintenance

### Versioning

| Version | Date       | Changes                               |
| ------- | ---------- | ------------------------------------- |
| 1.0     | 2025-12-28 | Initial analysis and design documents |

### When to Update

Update these documents if:

- [ ] Implementation reveals edge cases not covered
- [ ] Test results suggest different acceptance criteria
- [ ] Mobile/responsive design needs adjustment
- [ ] Accessibility audit fails WCAG AA
- [ ] Performance targets change
- [ ] Brand voice updates

---

## Contact & Questions

### Document Authors

- **BDD Analysis & Comprehensive Planning:** Claude Code (2025-12-28)
- **Implementation Support:** Available during dev phase
- **QA Support:** Available during testing phase

### Escalation Path

1. **Questions about design?** → Review BDD Analysis § Brand Voice & Design
2. **Questions about requirements?** → Review BDD Analysis § User Stories
3. **Questions about implementation?** → Review Quick Spec
4. **Questions about testing?** → Review Test Plan
5. **Questions about metrics?** → Review BDD Analysis § Success Metrics

---

## Quick Links

| Document                                            | Purpose                        | Read Time |
| --------------------------------------------------- | ------------------------------ | --------- |
| [BDD Analysis](GROWTH_ASSISTANT_UI_BDD_ANALYSIS.md) | Complete design & requirements | 45 min    |
| [Quick Spec](GROWTH_ASSISTANT_UI_QUICK_SPEC.md)     | Implementation guide           | 15 min    |
| [Test Plan](GROWTH_ASSISTANT_UI_TEST_PLAN.md)       | QA & testing strategy          | 30 min    |
| [This Doc](GROWTH_ASSISTANT_UI_DELIVERABLES.md)     | Navigation & index             | 10 min    |

---

## Next Steps

### If You're Starting Implementation

1. Read: Quick Spec (15 min)
2. Review: Quick Spec Acceptance Criteria with product
3. Check: Quick Spec Potential Gotchas
4. Start: Implementation in Quick Spec order (5 steps)

### If You're Writing Tests

1. Read: Test Plan (30 min)
2. Review: BDD Analysis Edge Cases
3. Create: Unit tests from Test Plan templates
4. Create: E2E tests from Playwright code samples
5. Create: Manual QA checklist from Test Plan

### If You're Reviewing

1. Read: All four documents (2-3 hours)
2. Focus: Risk Assessment section (BDD Analysis)
3. Validate: Acceptance criteria (Quick Spec)
4. Confirm: Test plan completeness (Test Plan)

---

**Document Suite Version:** 1.0
**Total Pages:** 4 documents, ~150 pages
**Total Read Time:** 100 minutes (if reading all)
**Total Test Cases:** 45+ (units, integration, E2E, manual)
**Last Updated:** 2025-12-28
