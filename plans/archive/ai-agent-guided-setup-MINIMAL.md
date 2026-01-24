# AI Agent: Guided Section-by-Section Setup (Minimal)

**Version:** 2.0 (Simplified per reviewer feedback)
**Created:** 2026-01-08
**Status:** Ready for Implementation
**Estimated Time:** 1-2 days

---

## Overview

Transform the onboarding AI agent into a friendly, guided assistant that walks tenants through website setup **one section at a time**.

**Scope:** Prompt engineering + QuickReplyChips component only. No new backend tools, no progress bars, no polling.

---

## The Problem

Current MARKETING phase has powerful tools but no guidance. Users get:

> "Here are the tools to edit your site. What would you like to do?"

They should get:

> "Let's start with your headline. What's one sentence that captures who you help?"

---

## The Solution (Two Parts)

### Part 1: System Prompt Update

**File:** `server/src/agent/prompts/onboarding-system-prompt.ts`

Update MARKETING phase guidance to:

1. Follow a defined section sequence (Hero → About → FAQ → Contact → Review)
2. Ask ONE question at a time
3. Include inline examples for when users hesitate
4. End messages with quick reply format: `[Quick Replies: Option 1 | Option 2 | Option 3]`

### Part 2: Quick Reply UI

**Files:**

- `apps/web/src/lib/parseQuickReplies.ts` (NEW - ~20 lines)
- `apps/web/src/components/agent/QuickReplyChips.tsx` (NEW - ~40 lines)
- `apps/web/src/components/agent/AgentChat.tsx` (MODIFY - ~10 lines)

Parse `[Quick Replies: ...]` from agent responses and render as clickable buttons.

---

## Implementation

### Task 1: Update System Prompt (~2-3 hours)

**File:** `server/src/agent/prompts/onboarding-system-prompt.ts`

Find the MARKETING phase section (around line 113) and replace with:

```typescript
MARKETING: `## Current Phase: Website Setup

### Your Role
You're a friendly assistant helping set up their website. Be warm, encouraging, and make it feel easy.

### Opening Message
Start with: "Almost done! Now let's make your website shine. This takes about 5-10 minutes, and you can change anything later. Ready to start with your headline?"

[Quick Replies: Let's do it! | Show me what it looks like first]

### Section Sequence (FOLLOW THIS ORDER)
Complete sections one at a time in this order:

1. **Hero Section** (Required)
   - First ask: "What headline captures who you help?" (wait for response)
   - Then ask: "Great! What tagline should go underneath?" (wait for response)
   - Then ask: "What should the button say? Default is 'View Packages'" (wait for response)
   - Save with update_page_section, then: "I've updated your hero! Want to preview it?"
   [Quick Replies: Preview it | Looks good, next section | Change something]

2. **About Section** (Recommended)
   - Ask: "Tell me your story in 2-3 sentences. Who do you serve and why?"
   - If they hesitate, offer examples (see below)
   - Save and move on
   [Quick Replies: Next section | Preview | Skip About for now]

3. **FAQ Section** (Optional)
   - Ask: "What's a question clients ask you all the time?"
   - After they answer: "And what do you tell them?"
   - After saving: "Got it! Want to add another FAQ, or move on?"
   [Quick Replies: Add another FAQ | That's enough | Skip FAQs]
   - Stop at 5 max

4. **Contact Info** (Recommended)
   - Ask: "Let's add your contact details. What's your business email?"
   - Then phone, then hours (one at a time)
   [Quick Replies: Next field | Skip contact info]

5. **Review & Publish**
   - Summarize: "Here's your website! You have: [list sections completed]"
   - Offer: "Ready to make it live? Or want to make more changes?"
   [Quick Replies: Publish now! | Preview first | Make changes]

### CRITICAL RULES

**ONE QUESTION AT A TIME**
Never ask multiple things in one message.
❌ "What's your headline? And tagline? And CTA text?"
✅ "What headline captures who you help?"

**ALWAYS END WITH QUICK REPLIES**
Every message must end with suggested responses:
[Quick Replies: Option 1 | Option 2 | Option 3]

**WHEN USERS HESITATE**
If they say "I don't know" or seem stuck, offer examples:

For Headlines (by business type):
- Photographer: "Moments worth remembering" / "Your story, beautifully told" / "See yourself differently"
- Coach: "Unlock what's next" / "Your breakthrough starts here" / "From stuck to unstoppable"
- Therapist: "A safe space to grow" / "You don't have to do this alone" / "Healing happens here"
- Wedding Planner: "Your perfect day, handled" / "Stress-free celebrations" / "Dream weddings, made real"
- Default: "Welcome to [Business Name]" / "Professional [service] you can trust" / "[Location]'s trusted [business type]"

"Here are some examples other ${businessType}s use:
- '[Example 1]'
- '[Example 2]'
- '[Example 3]'

Pick one, tweak it, or tell me what vibe you're going for!"
[Quick Replies: Use first one | Use second one | Let me write my own]

**CONFIRM BEFORE MOVING ON**
After each section: "That's saved! Ready for [next section]?"

**PREVIEW PROMPTS**
After updates, remind them they can preview: "Want to see how it looks?"
`;
```

### Task 2: Create Quick Reply Parser (~30 min)

**File:** `apps/web/src/lib/parseQuickReplies.ts` (NEW)

```typescript
/**
 * Parse quick reply suggestions from agent message
 * Format: [Quick Replies: Option 1 | Option 2 | Option 3]
 */
export interface ParsedMessage {
  message: string;
  quickReplies: string[];
}

export function parseQuickReplies(content: string): ParsedMessage {
  // Match [Quick Replies: ...] at end of message
  const pattern = /\[Quick Replies:\s*(.+?)\]\s*$/i;
  const match = content.match(pattern);

  if (!match) {
    return { message: content.trim(), quickReplies: [] };
  }

  const message = content.replace(pattern, '').trim();
  const quickReplies = match[1]
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { message, quickReplies };
}
```

### Task 3: Create QuickReplyChips Component (~1 hour)

**File:** `apps/web/src/components/agent/QuickReplyChips.tsx` (NEW)

```typescript
'use client';

import { cn } from '@/lib/utils';

interface QuickReplyChipsProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

export function QuickReplyChips({ replies, onSelect, disabled }: QuickReplyChipsProps) {
  if (replies.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2 mt-3 animate-in fade-in duration-300"
      role="group"
      aria-label="Suggested responses"
    >
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium",
            "bg-sage/10 text-sage-dark border border-sage/20",
            "hover:bg-sage/20 hover:border-sage/40 hover:shadow-sm",
            "active:scale-95",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[44px]" // WCAG touch target
          )}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
```

### Task 4: Integrate into AgentChat (~30 min)

**File:** `apps/web/src/components/agent/AgentChat.tsx` (MODIFY)

Add import at top:

```typescript
import { parseQuickReplies } from '@/lib/parseQuickReplies';
import { QuickReplyChips } from './QuickReplyChips';
```

In the message rendering loop, update to parse and show quick replies:

```typescript
{messages.map((msg, index) => {
  const isLastAssistantMessage =
    msg.role === 'assistant' &&
    index === messages.length - 1;

  // Parse quick replies from assistant messages
  const { message: displayMessage, quickReplies } =
    msg.role === 'assistant'
      ? parseQuickReplies(msg.content)
      : { message: msg.content, quickReplies: [] };

  return (
    <div key={msg.id || index}>
      {/* Existing ChatMessage component */}
      <ChatMessage
        role={msg.role}
        content={displayMessage}
        // ... other props
      />

      {/* Quick replies - only on last assistant message */}
      {isLastAssistantMessage && quickReplies.length > 0 && (
        <QuickReplyChips
          replies={quickReplies}
          onSelect={(reply) => {
            setInput(reply);
            inputRef.current?.focus();
          }}
          disabled={isLoading}
        />
      )}
    </div>
  );
})}
```

---

## Testing Checklist

### Manual Testing

- [ ] Start new onboarding → reach MARKETING phase
- [ ] Agent greets with friendly message + quick replies
- [ ] Agent asks ONE question at a time
- [ ] Quick reply chips appear and are clickable
- [ ] Clicking chip pre-fills input
- [ ] Agent follows Hero → About → FAQ → Contact sequence
- [ ] "I don't know" triggers example suggestions
- [ ] Preview links work
- [ ] Can skip sections
- [ ] Can go back and change things
- [ ] Mobile: chips are tappable (44px targets)

### Unit Tests (Optional - add if time permits)

- [ ] `parseQuickReplies` handles: normal case, no replies, malformed, edge cases
- [ ] `QuickReplyChips` renders correct number of buttons
- [ ] Click handler fires with correct value

---

## Files Changed

| File                                                   | Action | Lines               |
| ------------------------------------------------------ | ------ | ------------------- |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | MODIFY | ~100 lines replaced |
| `apps/web/src/lib/parseQuickReplies.ts`                | CREATE | ~25 lines           |
| `apps/web/src/components/agent/QuickReplyChips.tsx`    | CREATE | ~40 lines           |
| `apps/web/src/components/agent/AgentChat.tsx`          | MODIFY | ~15 lines added     |

**Total new code:** ~80 lines
**Total modified:** ~115 lines

---

## Success Criteria

1. ✅ Agent greets user warmly and explains the process
2. ✅ Agent asks ONE question per message
3. ✅ Quick reply buttons appear after each agent message
4. ✅ Clicking a quick reply pre-fills the input
5. ✅ Agent follows section sequence (Hero → About → FAQ → Contact)
6. ✅ Agent offers examples when user hesitates
7. ✅ Setup can be completed in < 10 minutes

---

## What's NOT In Scope (Deferred)

- ❌ Progress bar / section indicators
- ❌ New backend tools (`get_section_examples`, `get_setup_progress`)
- ❌ Polling for progress updates
- ❌ Dedicated PreviewButton component
- ❌ E2E Playwright tests

These can be added later if the core experience proves valuable.

---

## Rollback

If issues occur:

1. Revert prompt changes (git)
2. Remove QuickReplyChips import from AgentChat
3. Everything else continues to work as before
