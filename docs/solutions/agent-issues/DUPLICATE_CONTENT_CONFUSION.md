# CRITICAL: Duplicate Content Sections Causing Agent Confusion

**Date:** 2026-01-28

**Status:** ACTIVE TECH DEBT - Causing agent failures

**Severity:** CRITICAL - Root cause of multiple agent "failures"

---

## The Problem

Every tenant has **TWO SEPARATE "About" sections** (and potentially other duplicates):

1. **Landing Page "About" Section** - Single-page homepage component
2. **Multi-Page "About" Page** - Separate standalone page (`/about`)

When a user says "update my about section," the agent must choose which one to update. **The agent often updates the wrong one**, leading to user frustration.

---

## Architecture Overview

### Landing Page (Single-Page Homepage)

**Structure:** All content on one scrollable page

**Sections:**

- Hero (headline, subheadline, CTA)
- About (story, mission)
- Services (offerings)
- FAQ (common questions)
- Contact (form)

**Storage:** `tenant.landingPageConfig` JSON field

**Visible in:** Build Mode preview (left side of dashboard)

**URL:** `https://www.gethandled.ai/t/{tenantSlug}`

### Multi-Page Website (Separate Pages)

**Structure:** Traditional multi-page navigation

**Pages:**

- `/` - Home
- `/services` - Services
- `/about` - About
- `/faq` - FAQ
- `/contact` - Contact

**Storage:** Separate database tables/fields (TBD - need to investigate)

**Visible in:** Customer-facing site navigation header

**NOT visible in:** Build Mode preview (only shows landing page)

**URL:** `https://www.gethandled.ai/t/{tenantSlug}/about`

---

## Why This Causes Agent Confusion

### User Request

```
User: "Update my about section to say: [exact content]"
```

### Agent's Dilemma

The agent has NO way to know which "About" the user means:

- Landing page About section? (visible in preview)
- Multi-page About page? (NOT visible in preview)

### What Happens

**Scenario A: Agent updates landing page About**

- ✅ User sees change in build mode preview
- ✅ Visible on homepage
- ❌ Multi-page `/about` is unchanged

**Scenario B: Agent updates multi-page About page**

- ❌ User sees NO change in build mode preview (because preview only shows landing page)
- ❌ User thinks agent failed
- ✅ But agent actually succeeded - just updated the wrong place
- ✅ Change is visible on `/about` page (which user isn't looking at)

### Result

- **User frustration:** "I gave you the exact words and you didn't update it!"
- **Agent blamed:** Logged as agent failure
- **Reality:** Agent succeeded but picked the wrong target
- **Invisible success:** The update exists, just not where user expected

---

## Evidence from Agent Failures

### Failure #1: About Section Update Failed

**User request:**

> "please update my about section. my about section: [exact text]"

**Agent response:**

> "Done. Your changes are now live."

**User observation:**

> Preview shows NO change - still placeholder text

**Possible explanation:**

- Agent updated multi-page `/about` page ✅
- User was looking at landing page About section in preview ❌
- Preview doesn't show multi-page content
- User concluded agent failed
- **Reality:** Agent may have succeeded on wrong target

---

## Scope of Duplication

### Confirmed Duplicates

| Section/Page | Landing Page (Single-Page) | Multi-Page Website  |
| ------------ | -------------------------- | ------------------- |
| About        | ✅ Section                 | ✅ Page `/about`    |
| Services     | ✅ Section                 | ✅ Page `/services` |
| FAQ          | ✅ Section                 | ✅ Page `/faq`      |
| Contact      | ✅ Section                 | ✅ Page `/contact`  |

### Customer-Facing Evidence

**From screenshot description:**

> "tenants are spawned with a multi-page website, in their customer facing website, I can see 5 options on the header. Home/Services/about/faq/contact"

This confirms:

- Landing page exists (Home)
- 4 additional separate pages exist
- 4 sections are duplicated between landing page and multi-page site

---

## Why Preview Doesn't Show Multi-Page Content

**Build Mode Preview:**

- Shows: `landingPageConfig` (single-page homepage)
- Does NOT show: Multi-page website pages
- User assumes preview = complete site
- User doesn't realize multi-page content exists separately

**User Mental Model:**

```
"I see About in the preview, so when I say 'update my about',
the agent should update what I'm looking at in the preview."
```

**Agent's Actual Choice:**

```
Option 1: Update landingPageConfig.sections.about
Option 2: Update separate About page
Option 3: Update BOTH (?)
```

No clear guidance in prompt about which to choose.

---

## Impact

### User Experience Impact

- ❌ **Unpredictable behavior** - Same request produces different results
- ❌ **Invisible updates** - Agent succeeds but user sees no change
- ❌ **Lost trust** - "The agent doesn't work"
- ❌ **Repeated requests** - User asks again, agent updates OTHER location
- ❌ **Conflicting content** - Landing page says X, multi-page says Y

### Agent Accuracy Impact

- ❌ **False negative failures** - Agent succeeded but looks like failure
- ❌ **Inconsistent tool selection** - Sometimes storefront, sometimes marketing
- ❌ **No feedback loop** - Agent can't verify which one user wanted
- ❌ **Prompt ambiguity** - No clear decision tree for duplication

### Development Impact

- ❌ **Content sync issues** - Two places to keep in sync
- ❌ **Double work** - Every content update needs 2x operations
- ❌ **Testing complexity** - Must verify both locations
- ❌ **Migration risk** - Changing one breaks the other

---

## Root Cause

### Historical Context

This duplication likely emerged from:

1. **Phase 1:** Single-page landing page built first
   - All content in one JSON blob
   - Simple, fast, works great

2. **Phase 2:** Multi-page site added later
   - Traditional nav structure
   - Better SEO, more conventional
   - But didn't REPLACE landing page

3. **Phase 3:** Both kept running
   - No migration from landing page to multi-page
   - No deprecation of one or the other
   - Both coexist indefinitely

### Technical Debt Decision

At some point, a choice was made (or deferred) to:

- ✅ Keep landing page (single-page scrolling)
- ✅ Add multi-page site (traditional nav)
- ❌ NOT unify them
- ❌ NOT create clear primary/secondary relationship

---

## Questions to Investigate

1. **Which is primary?**
   - Is landing page the "real" site and multi-page is fallback?
   - Or vice versa?

2. **Do they sync?**
   - If user updates landing page About, does multi-page About auto-update?
   - Or are they completely independent?

3. **Which do customers see?**
   - When customer visits `/t/{slug}`, do they see landing page?
   - Do they ever see multi-page site?
   - Is there a toggle/setting?

4. **Storage location:**
   - Landing page: `landingPageConfig` JSON
   - Multi-page: Where? Separate `pages` table? Same JSON with different field?

5. **Agent tools:**
   - Does `delegate_to_storefront` update both?
   - Or just one?
   - Is there a separate tool for multi-page content?

6. **User intent detection:**
   - How should agent know which one user wants?
   - Should agent ASK: "Landing page About section or separate About page?"
   - Should agent update BOTH by default?

---

## Potential Solutions

### Option 1: Deprecate One (Recommended)

**Deprecate multi-page site:**

- Keep landing page as single source of truth
- Remove duplicate pages
- Simplify content management
- Eliminate confusion

**Pros:**

- ✅ One source of truth
- ✅ No duplication
- ✅ Agent confusion eliminated
- ✅ Simpler for users

**Cons:**

- ❌ Lose traditional multi-page navigation
- ❌ SEO implications (each page has its own URL)
- ❌ Migration effort for existing tenants

**Deprecate landing page:**

- Keep multi-page site as single source of truth
- Remove single-page sections
- Use traditional CMS approach

**Pros:**

- ✅ One source of truth
- ✅ Traditional, familiar structure
- ✅ Better for SEO (separate pages)

**Cons:**

- ❌ Lose single-page scrolling UX
- ❌ Build mode preview needs redesign
- ❌ Migration effort

### Option 2: Sync Automatically

**Keep both, sync content:**

- Landing page About section mirrors multi-page About page
- Agent updates one, both change
- User sees consistency everywhere

**Pros:**

- ✅ No feature loss
- ✅ User sees consistent content
- ✅ Works for both UX patterns

**Cons:**

- ❌ Complex to implement
- ❌ What if user wants them different?
- ❌ Ongoing maintenance burden

### Option 3: Explicit Targeting

**Teach agent to ask:**

- User: "Update my about section"
- Agent: "Which About would you like to update: Landing page section or separate About page?"

**Pros:**

- ✅ No data loss
- ✅ User control
- ✅ No ambiguity

**Cons:**

- ❌ Friction in UX
- ❌ User doesn't understand distinction
- ❌ Adds complexity to every request

### Option 4: Context-Aware Default

**Use build mode context:**

- If user is in build mode preview → update landing page
- If user is on live site → update multi-page
- Default to landing page if ambiguous

**Pros:**

- ✅ Intelligent default
- ✅ Matches user's visual context
- ✅ Can still ask for clarification if needed

**Cons:**

- ❌ Not always correct
- ❌ Requires session context tracking
- ❌ Still have sync issues

---

## Immediate Actions

1. ✅ **DOCUMENTED** - Critical tech debt identified
2. ⏳ **Investigate storage** - Where is multi-page content stored?
3. ⏳ **Audit agent tools** - Which tools update which content?
4. ⏳ **Survey tenants** - Which site do customers actually use?
5. ⏳ **Measure traffic** - Landing page vs multi-page page views
6. ⏳ **Product decision** - Choose Option 1, 2, 3, or 4 above
7. ⏳ **Update agent prompt** - Add explicit guidance for now
8. ⏳ **Add detection** - Agent should log when ambiguity exists

## Interim Agent Guidance (Until Fixed)

**Add to agent prompt:**

```
CRITICAL: Content Duplication Awareness

When user requests content updates for About/Services/FAQ/Contact sections:

1. CLARIFY which location:
   - Landing page section (visible in preview) ← DEFAULT
   - Separate multi-page page (NOT in preview)

2. DEFAULT ASSUMPTION:
   - If user is viewing build mode preview → Update landing page section
   - Landing page sections are primary for onboarding

3. CONFIRM with user:
   - "I'll update your landing page About section (the one visible in your preview)."
   - User can correct if they meant multi-page

4. LOG ambiguity:
   - Log when user request could mean either location
   - Track which choice was made
   - Monitor for user corrections

5. NEVER update multi-page content during onboarding unless explicitly requested
```

---

## Related Agent Failures

- **Failure #1:** About section update - Agent may have updated multi-page About instead of landing page About
- **Failure #4:** Rewrite hero - Ambiguity about which hero to read/write
- **Failure #5:** Agent confusion about what content exists - May be seeing both versions

---

## File Locations to Investigate

- `apps/web/src/app/t/[slug]/page.tsx` - Landing page rendering
- `apps/web/src/app/t/[slug]/about/page.tsx` - Multi-page About page (if exists)
- `server/src/services/landing-page.service.ts` - Landing page CRUD
- `server/src/agent-v2/deploy/storefront/src/tools/` - Storefront update tools
- `packages/contracts/src/lib/tenant.ts` - Data contracts

---

## Screenshots Needed

1. Build mode preview showing landing page About section
2. Live site `/about` page (separate multi-page version)
3. Live site navigation header showing Home/Services/About/FAQ/Contact
4. Side-by-side comparison of both About sections with different content

---
