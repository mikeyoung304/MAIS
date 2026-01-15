# MAIS Onboarding Flow - Manual Playwright Testing Guide

This guide walks through the complete user onboarding journey using Playwright MCP.

## Prerequisites

- Dev server running: `npm run dev:all` (from MAIS root)
- Access to: http://localhost:3000

---

## Phase 1: Signup Flow

### Step 1.1: Navigate to Signup

```
Navigate to http://localhost:3000/signup
```

**Expected UI:**

- Dark theme signup form
- "Start your free trial" heading
- Business name, email, password fields
- "14-day free trial" badge
- "Create account" or "Start free trial" button

### Step 1.2: Fill Signup Form

```
Fill the Business Name field with: "Test Photography Studio"
Fill the Email field with: "test-[use current timestamp]@example.com"
Fill the Password field with: "TestPassword123!"
```

**Expected Behaviors:**

- Password field shows eye icon toggle
- Green checkmark appears when password >= 8 chars
- All fields show validation on blur

### Step 1.3: Submit Form

```
Click the submit button (should say "Start free trial" or "Create account")
Wait for navigation to /tenant/build
```

**Expected:**

- Brief loading state on button
- Redirect to `/tenant/build` (Build Mode)
- URL should be: `http://localhost:3000/tenant/build`

---

## Phase 2: Build Mode Layout

### Step 2.1: Verify Layout Structure

```
Take a screenshot or snapshot of the Build Mode page
```

**Expected Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Header: [Exit] Build Mode | Status | [Discard] [Publish]   │
├─────────────────────┬───────────────────────────────────────┤
│  LEFT: Chat Panel   │  RIGHT: Preview Panel                 │
│  - Assistant title  │  - Viewport toggle (Desktop/Mobile)   │
│  - Quick action     │  - Iframe with storefront preview     │
│    chips            │                                       │
│  - Chat messages    │                                       │
│  - Input field      │                                       │
└─────────────────────┴───────────────────────────────────────┘
```

### Step 2.2: Verify Header Elements

```
Look for these elements in the header:
- "Exit" or back button (left side)
- "Build Mode" text
- Status indicator ("All changes saved" or "Saving...")
- "Discard" button
- "Publish" button
```

### Step 2.3: Verify Chat Panel

```
Look for in the left panel:
- Title: "Build Mode Assistant"
- Subtitle showing: "Editing: home page" or similar
- Quick action chips/buttons
- Welcome message from agent
- Text input at bottom
```

### Step 2.4: Verify Preview Panel

```
Look for in the right panel:
- Desktop/Mobile viewport toggle
- Iframe containing storefront preview
- The iframe should show the tenant's storefront
```

---

## Phase 3: Agent Interaction - Discovery

### Step 3.1: Read Welcome Message

```
Read the first message from the agent in the chat panel
```

**Expected Welcome (onboarding mode):**

- Greeting mentioning the business name
- Question about services/business type
- May include quick reply buttons

### Step 3.2: Send First Message

```
Type in the chat input: "I'm a wedding photographer"
Press Enter or click send
```

**Expected Response:**

- Agent acknowledges wedding photography
- Asks follow-up about location
- Quick replies may appear

### Step 3.3: Continue Discovery

```
Type: "I'm based in Austin, Texas"
Press Enter
```

**Expected:**

- Agent acknowledges Austin market
- Asks about target market/ideal clients
- May mention Austin is great for weddings

### Step 3.4: Complete Discovery

```
Type: "I focus on luxury weddings, high-end clients"
Press Enter
```

**Expected:**

- Agent wraps up discovery
- May transition to market research
- Should see phase indicator change (if visible)

---

## Phase 4: Market Research Phase

### Step 4.1: Watch for Market Research

```
Wait for agent to present market research
```

**Expected Response:**

- Pricing benchmarks for Austin area
- Low/high price ranges
- Recommendation based on positioning
- Quick replies to proceed

### Step 4.2: Proceed to Services

```
If quick replies appear, click "Yes, let's set up packages" or similar
OR type: "Yes, let's create my packages"
```

---

## Phase 5: Services Phase

### Step 5.1: Package Creation

```
Watch for agent's package suggestions
```

**Expected:**

- 3-tier package structure
- Creative names (not "Basic/Standard/Premium")
- Price suggestions based on market research
- Request for confirmation

### Step 5.2: Confirm Packages

```
Type: "Those look great, create them" or click approval button
```

**Expected (T2 Soft-Confirm):**

- Agent confirms creation
- May show "Creating packages..." status
- Success message when complete
- Transition to marketing phase

---

## Phase 6: Marketing Phase (Website Setup)

### Step 6.1: Hero Section

```
Wait for agent to discuss hero section
Watch the preview panel - hero section should highlight
```

**Expected:**

- Agent says something like "[highlight home-hero-main]"
- Preview iframe flashes/highlights the hero section
- Agent asks about headline

### Step 6.2: Set Headline

```
Type: "Use 'Capturing Love Stories Across Texas'"
OR click a quick reply suggestion
```

**Expected:**

- Agent confirms
- Preview may update (if live preview enabled)
- Moves to next section

### Step 6.3: About Section

```
Watch for agent to guide About section
Type a brief about paragraph when prompted
```

### Step 6.4: FAQ Section

```
Agent will ask for FAQ questions
Respond with common questions/answers
```

### Step 6.5: Contact Section

```
Provide contact information when asked
```

---

## Phase 7: Publishing

### Step 7.1: Review Before Publish

```
When agent asks "Ready to publish?", take a snapshot
Verify all sections in preview look correct
```

### Step 7.2: Publish via Header Button

```
Click the "Publish" button in the header
```

**Expected:**

- Confirmation dialog appears
- "Publish Changes" title
- Warning about making changes live
- Cancel and Publish buttons

### Step 7.3: Confirm Publish

```
Click "Publish" in the confirmation dialog
```

**Expected:**

- Loading state
- Success message/toast
- Status changes to "Published" or "All changes saved"

### Step 7.4: Verify Live Site

```
Navigate to /t/[slug] (the tenant's public storefront)
The slug should be based on the business name (e.g., "test-photography-studio-[timestamp]")
```

**Expected:**

- Storefront is live and accessible
- Shows the headline, about, FAQ, contact you configured
- All sections render correctly

---

## Quick Reference: Key Selectors

| Element             | Likely Selector                                 |
| ------------------- | ----------------------------------------------- |
| Business name input | `input[name="businessName"]` or `#businessName` |
| Email input         | `input[name="email"]` or `#email`               |
| Password input      | `input[name="password"]` or `#password`         |
| Submit button       | `button[type="submit"]`                         |
| Chat input          | `textarea`, `input[placeholder*="message"]`     |
| Send button         | Button near chat input                          |
| Publish button      | Button containing "Publish"                     |
| Discard button      | Button containing "Discard"                     |
| Exit button         | Button containing "Exit" or back arrow          |
| Preview iframe      | `iframe[title*="Preview"]`                      |

---

## Troubleshooting

### Chat not responding

- Check browser console for errors
- Verify API is running on port 3001
- Check network tab for failed requests to `/v1/agent/chat`

### Preview not loading

- Iframe may need time to load
- Look for `BUILD_MODE_READY` in console
- Verify tenant exists in database

### Signup fails

- Check for validation errors under fields
- Verify email is unique
- Check server logs for errors

### Section highlighting not working

- Ensure preview iframe is loaded
- Agent must send `[highlight section-id]` format
- Check for PostMessage errors in console

---

## Test Data Cleanup

After testing, you may want to clean up:

1. The test tenant won't affect production
2. For repeated tests, use unique emails (timestamp-based)
3. Database can be reset with `npm run db:reset` (caution: clears all data)

---

## Success Criteria

A successful test run includes:

- [ ] Signup completes and redirects to Build Mode
- [ ] Build Mode shows chat and preview panels
- [ ] Agent responds to messages
- [ ] Discovery phase collects business info
- [ ] Market research provides pricing data
- [ ] Services phase creates packages
- [ ] Marketing phase edits storefront sections
- [ ] Section highlighting works in preview
- [ ] Publish makes changes live
- [ ] Public storefront is accessible
