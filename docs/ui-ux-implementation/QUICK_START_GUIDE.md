# Quick Start Guide - UI/UX Implementation

**Goal:** Get your team up and running with the UI/UX transformation in under 30 minutes.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Access to the MAIS codebase (`/Users/mikeyoung/CODING/MAIS`)
- [ ] Node.js 18+ and npm installed
- [ ] Git access and permissions to create branches
- [ ] Design tools access (Figma or equivalent)
- [ ] 1-2 hours for initial setup and kickoff

---

## Step 1: Read the Master Plan (10 min)

📖 **Read:** [`00_MASTER_PLAN.md`](/Users/mikeyoung/CODING/MAIS/docs/ui-ux-implementation/00_MASTER_PLAN.md)

**Key Takeaways:**

- Understand the 4-phase approach
- Note the 12-week timeline
- Review success criteria
- Familiarize with risk mitigation

---

## Step 2: Review Phase 1 Detailed Plan (15 min)

📋 **Read:** [`01_PHASE_1_FOUNDATION.md`](/Users/mikeyoung/CODING/MAIS/docs/ui-ux-implementation/01_PHASE_1_FOUNDATION.md)

**Focus On:**

- Week 1 tasks (navigation, error handling)
- Technical implementation details
- Acceptance criteria for each task
- Testing requirements

---

## Step 3: Set Up Your Environment (10 min)

### Install Dependencies

```bash
cd /Users/mikeyoung/CODING/MAIS
npm install
```

### Create Feature Branch

```bash
git checkout -b feature/ui-ux-phase-1
```

### Run Development Server

```bash
# Terminal 1: Start API
npm run dev:api

# Terminal 2: Start client
npm run dev:client
```

### Verify Everything Works

- Open http://localhost:5173
- Navigate to login page
- Test admin dashboards
- Check browser console for errors

---

## Step 4: Understand Current State (10 min)

### Review Existing Components

Key files to familiarize yourself with:

**Navigation:**

- No persistent navigation (this is what we're fixing!)

**Components:**

```
client/src/components/ui/
├── button.tsx         # Button variants
├── card.tsx           # Card variants
├── input-enhanced.tsx # Enhanced input (login page)
├── empty-state.tsx    # Empty state component
├── skeleton.tsx       # Skeleton loading
├── toaster.tsx        # Toast notifications
└── ...
```

**Pages:**

```
client/src/pages/
├── Home.tsx                          # Marketing home
├── Login.tsx                         # Login page
├── admin/PlatformAdminDashboard.tsx  # Platform admin
└── tenant/TenantAdminDashboard.tsx   # Tenant admin
```

**Tailwind Config:**

```
client/tailwind.config.js  # Design tokens, colors, typography
```

### Identify Issues to Fix

**Navigation Issues:**

- No persistent nav bar in admin dashboards
- No way to navigate between sections
- Only logout button exists

**Loading States:**

- Using simple spinner, not skeleton screens
- No loading text

**Mobile:**

- Tables overflow on mobile
- No responsive grid for metrics
- No hamburger menu

**Empty States:**

- Plain text "No tenants yet" in table cells
- Should use EmptyState component with CTAs

---

## Step 5: Team Kickoff Meeting (30 min)

**Agenda:**

1. **Introductions** (5 min)
   - Developer(s)
   - Designer
   - QA Engineer
   - Project Manager

2. **Project Overview** (10 min)
   - Review master plan goals
   - Discuss 12-week timeline
   - Clarify success criteria

3. **Phase 1 Deep Dive** (10 min)
   - Walk through Week 1 tasks
   - Assign initial tasks
   - Discuss technical approach

4. **Process & Communication** (5 min)
   - Daily standups (async or sync?)
   - Code review process
   - Testing strategy
   - Deployment approach

**Action Items:**

- [ ] Assign Task 1.1 (AdminNav) to frontend dev
- [ ] Designer starts on logo and role badges
- [ ] QA sets up testing environment
- [ ] Schedule daily standups

---

## Step 6: Start Week 1, Task 1.1 (2 hours)

**Task:** Create AdminNav Component

**Steps:**

1. **Create Component File**

   ```bash
   mkdir -p client/src/components/navigation
   touch client/src/components/navigation/AdminNav.tsx
   ```

2. **Implement Base Navigation**
   - Copy implementation from Phase 1 plan (Task 1.1)
   - Start with desktop navigation only
   - Add logo placeholder
   - Add role badge
   - Add navigation links

3. **Test Locally**
   - Import in PlatformAdminDashboard
   - Verify navigation links work
   - Check styling matches design

4. **Create Pull Request**
   - Write clear PR description
   - Add screenshots
   - Request code review

---

## Quick Reference: File Locations

### Components You'll Create/Modify

**Phase 1:**

- `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/AdminNav.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/errors/ErrorBoundary.tsx` (ENHANCE)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/skeleton.tsx` (EXTEND)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/responsive-table.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/lib/toast.ts` (NEW)

**Phase 2:**

- `/Users/mikeyoung/CODING/MAIS/client/src/styles/tokens.css` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/styles/typography.css` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/metric-card.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/tailwind.config.js` (MODIFY)

**Phase 3:**

- `/Users/mikeyoung/CODING/MAIS/client/src/providers/ThemeProvider.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/theme-toggle.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/hooks/useKeyboardShortcuts.ts` (NEW)

**Phase 4:**

- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/chart.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/ui/pagination.tsx` (NEW)
- `/Users/mikeyoung/CODING/MAIS/client/src/components/onboarding/OnboardingTour.tsx` (NEW)

---

## Development Workflow

### Daily Workflow

1. **Morning:**
   - Check Slack/email for updates
   - Review PRs from yesterday
   - Plan today's tasks

2. **During Development:**
   - Work on assigned task
   - Write tests alongside code
   - Test in multiple browsers
   - Create PR when ready

3. **End of Day:**
   - Commit work (even if incomplete)
   - Update task status
   - Note any blockers

### Code Review Process

**Before Creating PR:**

- [ ] Code runs without errors
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Tested in Chrome, Firefox, Safari
- [ ] Tested on mobile (responsive mode or real device)

**PR Template:**

```markdown
## What Changed

Brief description of changes

## Why

Reason for change (links to task in plan)

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Accessibility tested
- [ ] Mobile tested

## Screenshots

Before/After screenshots

## Checklist

- [ ] Follows design system
- [ ] Responsive at all breakpoints
- [ ] Accessible (keyboard, screen reader)
- [ ] No console errors
```

### Testing Checklist

**For Every Component:**

- [ ] Renders correctly in light theme
- [ ] Renders correctly in dark theme (Phase 3+)
- [ ] Responsive on mobile (320px)
- [ ] Responsive on tablet (768px)
- [ ] Responsive on desktop (1024px+)
- [ ] Keyboard accessible
- [ ] Screen reader friendly
- [ ] Loading state handled
- [ ] Error state handled
- [ ] Empty state handled

---

## Troubleshooting Common Issues

### "I can't see my changes"

**Solution:**

1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Check Vite dev server is running
3. Check for TypeScript errors in terminal
4. Clear browser cache

### "Tests are failing"

**Solution:**

1. Run `npm test` to see specific failures
2. Check if you need to update snapshots
3. Ensure all imports are correct
4. Verify test data matches expected format

### "Linting errors"

**Solution:**

1. Run `npm run lint -- --fix` to auto-fix
2. Manually fix remaining issues
3. Add `// eslint-disable-next-line` only as last resort

### "TypeScript errors"

**Solution:**

1. Check import paths are correct
2. Verify types are properly defined
3. Use `as` type assertion only when necessary
4. Ask for help if stuck (type safety is important)

---

## Getting Help

### Documentation

- **Master Plan:** [`00_MASTER_PLAN.md`](/Users/mikeyoung/CODING/MAIS/docs/ui-ux-implementation/00_MASTER_PLAN.md)
- **Phase Plans:** `01_PHASE_1_FOUNDATION.md` through `04_PHASE_4_POLISH_SCALE.md`
- **Roadmap:** [`IMPLEMENTATION_ROADMAP.md`](/Users/mikeyoung/CODING/MAIS/docs/ui-ux-implementation/IMPLEMENTATION_ROADMAP.md)
- **Project Docs:** `/Users/mikeyoung/CODING/MAIS/CLAUDE.md`

### Team Communication

- **Daily Questions:** Slack #ui-ux-implementation channel
- **Code Review:** GitHub PR comments
- **Blockers:** Escalate to PM immediately
- **Design Questions:** Tag designer in Figma or Slack

### External Resources

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Radix UI:** https://www.radix-ui.com/docs/primitives
- **React Router:** https://reactrouter.com/
- **Recharts:** https://recharts.org/
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/

---

## Success Indicators (Week 1)

By end of Week 1, you should have:

- [ ] AdminNav component implemented
- [ ] Navigation working in both admin dashboards
- [ ] Toast notification system integrated
- [ ] Error boundaries added
- [ ] All tests passing
- [ ] PR reviewed and merged
- [ ] Deployed to staging environment

**If you're stuck or behind schedule:**

1. Review the task acceptance criteria
2. Ask for help in Slack
3. Pair program with another developer
4. Escalate to PM if blocking issues

---

## Next Steps After Week 1

1. ✅ **Week 1 Retrospective** - What went well? What can improve?
2. 📋 **Week 2 Planning** - Review tasks, estimate effort
3. 🚀 **Continue Phase 1** - Build on Week 1 foundation
4. 📊 **Track Metrics** - Are we on schedule? Quality good?

---

## Checklist: Ready to Start?

- [ ] Read master plan
- [ ] Read Phase 1 plan
- [ ] Environment set up
- [ ] Code running locally
- [ ] Feature branch created
- [ ] Team roles assigned
- [ ] First task assigned
- [ ] Communication channels set up
- [ ] Testing environment ready

**If all checked, you're ready to begin! 🚀**

Start with [`01_PHASE_1_FOUNDATION.md`](/Users/mikeyoung/CODING/MAIS/docs/ui-ux-implementation/01_PHASE_1_FOUNDATION.md) → Task 1.1: Create AdminNav Component

---

**Questions?** Contact the project manager or post in #ui-ux-implementation Slack channel.

**Good luck, and let's build something amazing! 💪**
