# MAIS Onboarding Flow Test Report

**Date:** 2026-01-09
**Tester:** Playwright MCP Automated Testing
**Environment:** localhost:3000 (Next.js) + localhost:3001 (Express API)
**Mode:** Mock adapters

---

## Executive Summary

| Category | Status | Score |
|----------|--------|-------|
| **Signup Flow** | ✅ Working | 9/10 |
| **Build Mode Layout** | 🔴 Critical Issues | 3/10 |
| **Agent Conversation** | ✅ Working | 8/10 |
| **Tool Execution** | 🔴 BROKEN | 1/10 |
| **Preview Sync** | 🔴 BROKEN | 0/10 |
| **Onboarding Tour** | ❌ Missing | 0/10 |
| **Overall** | 🔴 Not Production Ready | 35% |

---

## Detailed Findings

### 1. Signup Flow (/signup) ✅

**Status:** Working

**What Works:**
- Dark theme signup form renders correctly
- Form validation (email, password 8+ chars)
- Password visibility toggle
- "14-day free trial" badge
- Form submission creates tenant
- Redirect to /tenant/build after signup

**Minor Issues:**
- None found

**Screenshots:** `01-signup-page.png`

---

### 2. Build Mode Layout (/tenant/build) 🔴

**Status:** Critical UI/UX Issues

#### Issue 2.1: Massive Dead Space (P0)
- **Severity:** Critical
- **Description:** ~40% of the screen is empty dark space when Build Mode Chat panel is collapsed
- **Impact:** Unusable at common viewport sizes (1200-1440px)
- **Root Cause:** Resizable panel has no minimum width, collapses to near-zero

#### Issue 2.2: Two Confusing Chat Interfaces (P1)
- **Severity:** High
- **Description:** Both "Build Mode Assistant" (center) AND "Growth Assistant" (right sidebar) exist
- **Impact:** Users don't know which chat to use
- **Recommendation:** Consolidate into single chat or make purpose clearer

#### Issue 2.3: Preview Clipping (P1)
- **Severity:** High
- **Description:** Hero text shows "[Hero H..." and "[Hero Subhea..." - content cut off
- **Impact:** Cannot see full preview at smaller viewports
- **Affected Viewports:** 1440x900 and below

#### Issue 2.4: No Onboarding Tour (P1)
- **Severity:** High
- **Description:** No guided tour for new users
- **Impact:** Users don't understand the interface
- **Expected:** Step-by-step tour highlighting key features

**Screenshots:** `02-build-mode-layout.png`, `03-build-mode-1920x1080.png`, `04-build-mode-1440x900.png`

---

### 3. Agent Conversation ✅

**Status:** Working (with caveats)

**What Works:**
- Agent responds to messages
- Discovery phase collects business info
- Market research provides pricing data
- Natural conversation flow
- Tool pills show which tools were called
- Brand voice guidance is helpful

**Tools Verified Working:**
| Tool | Trust Tier | Status |
|------|------------|--------|
| `get_market_research` | T1 | ✅ Working |
| `update_onboarding_state` | T1 | ✅ Working |
| `upsert_services` | T2 | ⚠️ Shows as called (unverified) |
| `list_section_ids` | T1 | ✅ Working |
| `update_page_section` | T2 | 🔴 BROKEN - No effect |
| `publish_draft` | T3 | 🔴 BROKEN - No effect |

**Screenshots:** `05-market-research-response.png`, `06-services-created.png`

---

### 4. Tool Execution 🔴

**Status:** CRITICAL - Tools Not Executing

#### Issue 4.1: update_page_section Not Working (P0)
- **Severity:** Critical
- **Description:** Agent shows tool was called but content never updates
- **Evidence:**
  - Agent said "Your hero section is now in draft with that perfect headline"
  - Preview still shows `[Hero Headline]` placeholder
  - Public storefront still shows `[Hero Headline]` placeholder
- **Root Cause:** Unknown - executor may not be called, or draft not saving

#### Issue 4.2: publish_draft Not Working (P0)
- **Severity:** Critical
- **Description:** Agent claims content is "live" but nothing changed
- **Evidence:**
  - Agent said "Your hero section... is now live on your storefront"
  - No `publish_draft` tool pill appeared
  - Public storefront unchanged
- **Root Cause:** Tool may not be registered, or T3 flow bypassed incorrectly

#### Issue 4.3: T3 Approval Flow Missing (P1)
- **Severity:** High
- **Description:** Publish should require explicit T3 approval but agent just announced it was done
- **Expected:** Confirmation dialog or approval button
- **Actual:** Agent announced publish without user confirmation

---

### 5. Preview Synchronization 🔴

**Status:** BROKEN

#### Issue 5.1: Preview Never Updates (P0)
- **Severity:** Critical
- **Description:** Build Mode preview iframe never reflects draft changes
- **Evidence:**
  - Agent called `update_page_section`
  - Preview still shows placeholder text throughout entire session
  - Even after "publish", preview unchanged
- **Root Cause:** PostMessage sync broken, or draft not being saved

#### Issue 5.2: No Preview Refresh Mechanism (P1)
- **Severity:** High
- **Description:** No way to manually refresh preview
- **Expected:** Refresh button or auto-refresh on draft save

---

### 6. Onboarding Progress Indicator 🔴

**Status:** BROKEN

#### Issue 6.1: Progress Stuck at 1/4 (P1)
- **Severity:** High
- **Description:** "Getting Started (1/4)" never advances despite completing phases
- **Evidence:**
  - Completed Discovery, Market Research, Services, Marketing
  - Progress indicator still shows "Getting Started (1/4)"
- **Root Cause:** `update_onboarding_state` not updating phase, or UI not reflecting state

---

### 7. Missing Features

#### 7.1: No Onboarding Tour (P1)
- **Description:** First-time users get no guided tour
- **Expected:** Interactive tour showing:
  - Build Mode Chat panel
  - Preview panel
  - Quick action chips
  - Publish/Discard buttons
  - How to switch pages

#### 7.2: Section Highlighting Not Observed (P2)
- **Description:** Agent system prompt mentions `[highlight section-id]` but not observed
- **Expected:** Sections flash/highlight when agent references them

#### 7.3: Quick Replies Not Dynamic (P2)
- **Description:** Quick action chips are static, not contextual from agent
- **Expected:** Agent provides dynamic quick reply options

---

## Test Flow Summary

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to /signup | Form renders | Form rendered | ✅ |
| 2 | Fill form and submit | Create tenant, redirect | Created, redirected | ✅ |
| 3 | Build Mode loads | Split panel layout | Layout broken | 🔴 |
| 4 | Agent greets | Welcome message | Welcome received | ✅ |
| 5 | Discovery conversation | Collect business info | Info collected | ✅ |
| 6 | Market research | Pricing data shown | Data shown | ✅ |
| 7 | Create packages | Packages created | Tool called (unverified) | ⚠️ |
| 8 | Edit hero section | Preview updates | Preview unchanged | 🔴 |
| 9 | Publish | Goes live | Still placeholders | 🔴 |
| 10 | View public site | Shows content | Shows placeholders | 🔴 |

---

## Screenshots Captured

1. `01-signup-page.png` - Signup form
2. `02-build-mode-layout.png` - Initial Build Mode (default viewport)
3. `03-build-mode-1920x1080.png` - Build Mode at 1920x1080
4. `04-build-mode-1440x900.png` - Build Mode at 1440x900
5. `05-market-research-response.png` - Agent market research
6. `06-services-created.png` - Services phase complete
7. `07-storefront-update.png` - After update_page_section
8. `08-published-announcement.png` - Agent announces publish
9. `09-public-storefront-STILL-PLACEHOLDERS.png` - Public site still broken

---

## Priority Bug List

### P0 - Critical (Blocking Launch)

1. **Tool Execution Broken** - `update_page_section` and `publish_draft` don't actually work
2. **Preview Never Syncs** - Draft changes not reflected in preview
3. **Public Storefront Unchanged** - Published content not appearing

### P1 - High Priority

4. **Build Mode Layout Broken** - Unusable at common viewports
5. **Two Chat Interfaces** - Confusing UX
6. **Progress Indicator Stuck** - Always shows 1/4
7. **No Onboarding Tour** - Users don't know how to use it
8. **T3 Approval Missing** - Publish happens without explicit approval

### P2 - Medium Priority

9. **Section Highlighting** - Not working or not triggered
10. **Dynamic Quick Replies** - Static instead of contextual
11. **Preview Text Clipping** - Content cut off at edges

---

## Recommendations

### Immediate (Before Any Launch)

1. **Debug tool executors** - Check if `update_page_section` and `publish_draft` executors are registered and being called
2. **Verify draft system** - Ensure drafts are actually being saved to database
3. **Fix preview PostMessage sync** - Debug iframe communication
4. **Test end-to-end in real mode** - May be mock adapter issue

### Short-term

5. **Fix Build Mode layout** - Set minimum widths on panels
6. **Consolidate or clarify chat panels** - Users shouldn't have two chats
7. **Fix onboarding progress** - State machine may not be transitioning
8. **Add onboarding tour** - Use react-joyride or similar

### Medium-term

9. **Add preview refresh button** - Manual fallback
10. **Implement section highlighting** - Visual feedback for agent actions
11. **Dynamic quick replies** - Context-aware suggestions

---

## Test Environment Notes

- Next.js: 14.2.35 with Turbopack
- Express API: Running on port 3001
- Adapter Mode: Mock (ADAPTERS_PRESET=mock)
- Browser: Chromium via Playwright
- Viewports Tested: 1920x1080, 1440x900

---

## Conclusion

The onboarding agent **conversation flow works well** - the AI provides helpful, contextual responses with good brand voice. However, the **tool execution is completely broken** - content edits and publish operations have no effect. Combined with significant UI/UX issues in the Build Mode layout and missing onboarding tour, the system is **not ready for production**.

**Next Steps:**
1. Debug tool execution pipeline (highest priority)
2. Fix preview synchronization
3. Address Build Mode layout issues
4. Add onboarding tour

---

*Report generated by Playwright MCP automated testing*
