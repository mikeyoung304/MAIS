# ✨ AI Agent: Friendly Section-by-Section Website Setup

**Version:** 1.0
**Created:** 2026-01-08
**Status:** Draft - Awaiting Review
**Type:** Enhancement

---

## Overview

Transform the onboarding AI agent into a friendly, guided assistant that walks tenants through website setup **one section at a time**, asking clear questions and building their storefront in real-time. The goal: make the experience feel like chatting with a helpful friend, not configuring software.

### The Vision

```
Current Experience:                    Ideal Experience:
┌─────────────────────┐               ┌─────────────────────┐
│ "Here are the tools │               │ "Hi! I'm here to    │
│  to edit your site" │      →        │  help you set up    │
│                     │               │  your website. It's │
│ [User figures it    │               │  easy - just answer │
│  out on their own]  │               │  a few questions!"  │
└─────────────────────┘               └─────────────────────┘
```

---

## Problem Statement

### Current State

The MARKETING phase of onboarding provides powerful storefront editing tools (`list_section_ids`, `update_page_section`, `get_unfilled_placeholders`) but lacks:

1. **Structured guidance** - No defined section sequence
2. **One-question-at-a-time** - Agent may ask multiple questions
3. **Quick reply options** - Users must type all responses
4. **Section progress visibility** - Only phase-level dots shown
5. **Reassurance language** - No "don't worry, it's easy" messaging
6. **Starter suggestions** - No help when users hesitate

### Impact

- Users feel overwhelmed by open-ended "what do you want?"
- Setup takes longer than necessary
- Drop-off during MARKETING phase
- Inconsistent storefront quality

---

## Proposed Solution

### Core Concept: Guided Conversation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  MARKETING Phase: Section-by-Section Flow                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. GREETING                                                 │
│     "Almost done! Let's set up your website.                │
│      This takes about 5-10 minutes. Ready?"                 │
│     [Let's go!] [Show me what it looks like first]          │
│                                                              │
│  2. HERO SECTION                                            │
│     "What headline captures who you help?"                  │
│     → User responds                                          │
│     "Love it! And what tagline should go underneath?"       │
│     → User responds                                          │
│     [Preview Hero] [Change headline] [Next section →]       │
│                                                              │
│  3. ABOUT SECTION                                           │
│     "Tell me your story in 2-3 sentences..."                │
│     → User responds                                          │
│     [Preview About] [Make it shorter] [Next section →]      │
│                                                              │
│  4. FAQ SECTION                                             │
│     "What's a question clients ask all the time?"           │
│     → User responds with Q&A                                 │
│     "Got it! Another question? Or move on?"                 │
│     [Add another] [That's enough] [Skip FAQs]               │
│                                                              │
│  5. CONTACT INFO                                            │
│     "Let's add your contact details..."                     │
│     → Confirm email, phone, hours                            │
│     [Preview Contact] [Next section →]                      │
│                                                              │
│  6. REVIEW & PUBLISH                                        │
│     "Here's your complete website! 🎉"                      │
│     [Preview Full Site] [Make Changes] [Publish Now!]       │
│                                                              │
│     Progress: ████████████░░ 80% complete                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│  GrowthAssistantPanel                                        │
│  ├── SectionProgressBar (NEW)      # Shows section progress │
│  ├── AgentChat                                               │
│  │   ├── ChatMessage                                         │
│  │   └── QuickReplyChips (NEW)     # Clickable suggestions  │
│  └── PreviewButton (NEW)           # Open/refresh preview   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  OnboardingOrchestrator                                      │
│  ├── Enhanced System Prompt        # Section sequence rules │
│  ├── Section Tracker Context       # Track current focus    │
│  └── Example Provider              # Industry-specific copy │
│                                                              │
│  Tools (Enhanced):                                           │
│  ├── list_section_ids + completion_status                   │
│  ├── update_page_section + preview_prompt                   │
│  ├── get_section_examples (NEW)    # Starter suggestions    │
│  └── get_setup_progress (NEW)      # Section completion     │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Prompt Engineering (Foundation)

**Estimated Time:** 1-2 days
**Files:** `server/src/agent/prompts/onboarding-system-prompt.ts`

#### 1.1 Add Section Sequence to MARKETING Phase

```typescript
// server/src/agent/prompts/onboarding-system-prompt.ts
MARKETING: `## Current Phase: Website Setup

### Your Role
You're a friendly assistant helping ${businessName} set up their website.
Be warm, encouraging, and make it feel easy.

### Opening Message
Start with: "Almost done! Now let's make your website shine. This takes about 5-10 minutes, and you can change anything later. Ready to start?"

### Section Sequence (FOLLOW THIS ORDER)
Complete sections one at a time:

1. **Hero Section** (Required)
   - Ask for headline (one question)
   - Then ask for tagline (one question)
   - Confirm CTA text or use default
   - Save and offer preview

2. **About Section** (Recommended)
   - Ask for 2-3 sentence story
   - If hesitant, offer examples
   - Save and move on

3. **FAQ Section** (Optional)
   - Ask for one Q&A at a time
   - After each: "Add another? Or move on?"
   - Stop at 5 max

4. **Contact Info** (Recommended)
   - Confirm email, phone, hours
   - Pre-fill from Discovery if available

5. **Review & Publish**
   - Show summary of all changes
   - Offer full preview
   - T3 approval for publish

### Conversation Rules

**ONE QUESTION AT A TIME**
❌ "What's your headline? And tagline? And CTA text?"
✅ "What headline captures who you help?"

**CONFIRM BEFORE MOVING ON**
After each section: "That's saved! Ready for [next section]?"

**OFFER QUICK REPLIES**
End every message with suggested responses:
"[Quick Replies: Yes, looks good | Let me change it | Skip this | Show example]"

**WHEN USERS HESITATE**
If they say "I don't know" or pause:
"No problem! Here are some examples for ${businessType}s:
- '[Example 1]'
- '[Example 2]'
- '[Example 3]'
Pick one, tweak it, or tell me your vibe and I'll write something."

**SHOW PROGRESS**
After every 2 sections: "Quick check-in: You've done Hero ✓ and About ✓. Two more to go!"

**PREVIEW PROMPTS**
After updates: "I've updated your [section]. Want to preview it?"
`;
```

#### 1.2 Add Industry-Specific Examples

```typescript
// server/src/agent/prompts/section-examples.ts
export const HERO_EXAMPLES: Record<string, string[]> = {
  photographer: [
    'Moments that deserve to last forever',
    'Your story, beautifully told',
    'Capturing the real you',
  ],
  coach: ['Unlock your potential', 'Your transformation starts here', 'From stuck to unstoppable'],
  therapist: ['A safe space to grow', 'Healing happens here', "You don't have to do this alone"],
  // ... 14 more business types from industry-benchmarks.ts
};
```

#### 1.3 Acceptance Criteria - Phase 1

- [ ] System prompt includes section sequence
- [ ] One-question-at-a-time rule enforced
- [ ] Quick reply format documented
- [ ] Example headlines for all 17 business types
- [ ] Progress check-in prompts included

---

### Phase 2: Quick Reply UI Components

**Estimated Time:** 2-3 days
**Files:** `apps/web/src/components/agent/`

#### 2.1 QuickReplyChips Component

```typescript
// apps/web/src/components/agent/QuickReplyChips.tsx
interface QuickReplyChipsProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

export function QuickReplyChips({ replies, onSelect, disabled }: QuickReplyChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Quick replies">
      {replies.map((reply) => (
        <button
          key={reply}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium",
            "bg-sage/10 text-sage-dark border border-sage/20",
            "hover:bg-sage/20 hover:border-sage/40",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[44px]" // Accessibility: touch target
          )}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
```

#### 2.2 Parse Quick Replies from Agent Response

```typescript
// apps/web/src/lib/parseQuickReplies.ts
export function parseQuickReplies(content: string): {
  message: string;
  quickReplies: string[];
} {
  // Pattern: [Quick Replies: "Option 1" | "Option 2" | "Option 3"]
  const pattern = /\[Quick Replies:\s*(.+?)\]/i;
  const match = content.match(pattern);

  if (!match) {
    return { message: content, quickReplies: [] };
  }

  const message = content.replace(pattern, '').trim();
  const quickReplies = match[1].split('|').map((s) => s.trim().replace(/^["']|["']$/g, ''));

  return { message, quickReplies };
}
```

#### 2.3 Integrate into AgentChat

```typescript
// apps/web/src/components/agent/AgentChat.tsx
// In the message rendering:

{messages.map((msg, i) => {
  const { message, quickReplies } = parseQuickReplies(msg.content);
  const isLastMessage = i === messages.length - 1;

  return (
    <div key={msg.id}>
      <ChatMessage role={msg.role} content={message} />

      {/* Show quick replies only on last assistant message */}
      {msg.role === 'assistant' && isLastMessage && quickReplies.length > 0 && (
        <QuickReplyChips
          replies={quickReplies}
          onSelect={(reply) => {
            setInput(reply);
            // Optionally auto-submit
          }}
          disabled={isLoading}
        />
      )}
    </div>
  );
})}
```

#### 2.4 Acceptance Criteria - Phase 2

- [ ] QuickReplyChips renders 2-4 suggestions
- [ ] Clicking chip pre-fills input (or auto-sends)
- [ ] Chips match HANDLED brand (sage accent, rounded-full)
- [ ] Touch targets ≥ 44px for mobile
- [ ] Chips hidden when user is typing
- [ ] ARIA labels for accessibility

---

### Phase 3: Section Progress Indicator

**Estimated Time:** 1-2 days
**Files:** `apps/web/src/components/onboarding/`

#### 3.1 SectionProgressBar Component

```typescript
// apps/web/src/components/onboarding/SectionProgressBar.tsx
interface SectionProgress {
  name: string;
  status: 'complete' | 'current' | 'pending';
}

interface SectionProgressBarProps {
  sections: SectionProgress[];
  currentIndex: number;
}

export function SectionProgressBar({ sections, currentIndex }: SectionProgressBarProps) {
  const completedCount = sections.filter(s => s.status === 'complete').length;
  const percentage = Math.round((completedCount / sections.length) * 100);

  return (
    <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-secondary">
          Setting up your website
        </span>
        <span className="text-sm text-sage font-medium">
          {percentage}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage transition-all duration-500"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Section indicators */}
      <div className="flex justify-between mt-2">
        {sections.map((section, i) => (
          <div
            key={section.name}
            className={cn(
              "text-xs",
              section.status === 'complete' && "text-sage",
              section.status === 'current' && "text-sage font-medium",
              section.status === 'pending' && "text-neutral-400"
            )}
          >
            {section.status === 'complete' ? '✓' : ''} {section.name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3.2 Track Progress via API

```typescript
// apps/web/src/hooks/useSectionProgress.ts
export function useSectionProgress(tenantId: string) {
  const { data } = useSWR(`/api/agent/section-progress`, fetcher, { refreshInterval: 5000 });

  const sections: SectionProgress[] = [
    { name: 'Hero', status: data?.hero ? 'complete' : 'pending' },
    { name: 'About', status: data?.about ? 'complete' : 'pending' },
    { name: 'FAQ', status: data?.faq ? 'complete' : 'pending' },
    { name: 'Contact', status: data?.contact ? 'complete' : 'pending' },
  ];

  // Mark current based on which is first incomplete
  const currentIndex = sections.findIndex((s) => s.status === 'pending');
  if (currentIndex >= 0) {
    sections[currentIndex].status = 'current';
  }

  return { sections, currentIndex };
}
```

#### 3.3 Acceptance Criteria - Phase 3

- [ ] Progress bar shows in GrowthAssistantPanel during MARKETING
- [ ] Visual progress updates after each section saved
- [ ] Current section highlighted
- [ ] Percentage calculation accurate
- [ ] Accessible (aria-valuenow)

---

### Phase 4: Tool Enhancements

**Estimated Time:** 2-3 days
**Files:** `server/src/agent/tools/`

#### 4.1 New Tool: `get_section_examples`

```typescript
// server/src/agent/tools/example-tools.ts
export const getSectionExamplesTool: AgentTool = {
  name: 'get_section_examples',
  trustTier: 'T1', // Read-only
  description:
    'Get industry-specific example content for a section type. Use when user hesitates or asks for help.',
  inputSchema: {
    type: 'object',
    properties: {
      sectionType: {
        type: 'string',
        enum: ['hero', 'about', 'faq', 'cta'],
        description: 'Which section type to get examples for',
      },
      businessType: {
        type: 'string',
        description: 'Business type from discovery (e.g., "photographer", "coach")',
      },
    },
    required: ['sectionType', 'businessType'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { sectionType, businessType } = params as { sectionType: string; businessType: string };

    const examples = getExamplesForBusinessType(sectionType, businessType);

    return {
      success: true,
      data: {
        sectionType,
        businessType,
        examples,
        usage: 'Present these as options: "Here are some examples..."',
      },
    };
  },
};
```

#### 4.2 New Tool: `get_setup_progress`

```typescript
// server/src/agent/tools/progress-tools.ts
export const getSetupProgressTool: AgentTool = {
  name: 'get_setup_progress',
  trustTier: 'T1', // Read-only
  description:
    'Get current website setup progress. Call this to know which sections are complete vs pending.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true, landingPageConfigDraft: true },
    });

    const config = (tenant?.landingPageConfigDraft ||
      tenant?.landingPageConfig) as LandingPageConfig;
    const sections = analyzeSectionCompletion(config);

    return {
      success: true,
      data: {
        sections,
        nextSection: sections.find((s) => !s.complete)?.name || 'review',
        percentComplete: Math.round(
          (sections.filter((s) => s.complete).length / sections.length) * 100
        ),
      },
    };
  },
};
```

#### 4.3 Enhance `update_page_section` Response

```typescript
// Add to update_page_section return:
return {
  success: true,
  proposalId: proposal.id,
  preview: {
    // ... existing fields
    previewPrompt: `I've updated your ${sectionType} section. Want to preview it before we move on?`,
    quickReplies: ['Preview it', 'Looks good, next section', 'Let me change it'],
  },
};
```

#### 4.4 Acceptance Criteria - Phase 4

- [ ] `get_section_examples` returns 3 examples per business type
- [ ] `get_setup_progress` returns accurate completion status
- [ ] `update_page_section` includes preview prompt
- [ ] All new tools registered in tool registry
- [ ] Unit tests for each new tool

---

### Phase 5: Preview Integration

**Estimated Time:** 1-2 days
**Files:** `apps/web/src/components/agent/`

#### 5.1 PreviewButton Component

```typescript
// apps/web/src/components/agent/PreviewButton.tsx
interface PreviewButtonProps {
  tenantSlug: string;
  page?: string;
  isDraft?: boolean;
}

export function PreviewButton({ tenantSlug, page = 'home', isDraft = true }: PreviewButtonProps) {
  const previewUrl = `/t/${tenantSlug}${isDraft ? '?preview=draft' : ''}${page !== 'home' ? `&page=${page}` : ''}`;

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2",
        "bg-sage text-white rounded-full",
        "hover:bg-sage-dark transition-colors",
        "text-sm font-medium"
      )}
    >
      <EyeIcon className="w-4 h-4" />
      Preview Storefront
    </a>
  );
}
```

#### 5.2 Inline Preview in Chat

```typescript
// When agent mentions preview, show inline button
{message.includes('preview') && (
  <PreviewButton
    tenantSlug={tenant.slug}
    isDraft={true}
  />
)}
```

#### 5.3 Acceptance Criteria - Phase 5

- [ ] Preview button visible after section updates
- [ ] Opens in new tab with draft mode
- [ ] Button matches HANDLED brand
- [ ] Accessible with keyboard

---

### Phase 6: Testing & Polish

**Estimated Time:** 2-3 days

#### 6.1 Unit Tests

```typescript
// test/agent/onboarding/section-flow.test.ts
describe('Section-by-Section Flow', () => {
  it('should follow section sequence', async () => {
    // Test that agent asks about Hero before About
  });

  it('should ask one question at a time', async () => {
    // Test that messages contain single question
  });

  it('should include quick replies', async () => {
    // Test quick reply format in responses
  });

  it('should offer examples when user hesitates', async () => {
    // Test "I don't know" triggers examples
  });
});
```

#### 6.2 E2E Tests with Playwright MCP

```typescript
// e2e/onboarding-section-flow.spec.ts
test('complete section-by-section setup', async ({ page }) => {
  // Navigate to dashboard
  await page.goto('/tenant/dashboard');

  // Verify greeting
  await expect(page.getByText(/ready to start/i)).toBeVisible();

  // Click quick reply
  await page.getByRole('button', { name: "Let's go!" }).click();

  // Answer hero question
  await page.getByRole('textbox').fill('Capturing your best moments');
  await page.keyboard.press('Enter');

  // Verify progress updates
  await expect(page.getByText(/Hero ✓/)).toBeVisible();

  // Continue through flow...
});
```

#### 6.3 Acceptance Criteria - Phase 6

- [ ] Unit tests for section sequence
- [ ] Unit tests for quick reply parsing
- [ ] E2E test for complete flow
- [ ] Mobile responsive testing
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## File Change Summary

| File                                                        | Changes                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `server/src/agent/prompts/onboarding-system-prompt.ts`      | Add section sequence, one-question rule, quick reply format |
| `server/src/agent/prompts/section-examples.ts`              | NEW - Industry-specific example content                     |
| `server/src/agent/tools/example-tools.ts`                   | NEW - `get_section_examples` tool                           |
| `server/src/agent/tools/progress-tools.ts`                  | NEW - `get_setup_progress` tool                             |
| `server/src/agent/tools/storefront-tools.ts`                | Enhance `update_page_section` response                      |
| `apps/web/src/components/agent/QuickReplyChips.tsx`         | NEW - Quick reply UI                                        |
| `apps/web/src/components/agent/AgentChat.tsx`               | Integrate quick replies                                     |
| `apps/web/src/components/agent/PreviewButton.tsx`           | NEW - Preview CTA                                           |
| `apps/web/src/components/onboarding/SectionProgressBar.tsx` | NEW - Section progress                                      |
| `apps/web/src/lib/parseQuickReplies.ts`                     | NEW - Parse quick replies from response                     |
| `apps/web/src/hooks/useSectionProgress.ts`                  | NEW - Track section completion                              |

---

## Success Metrics

| Metric                | Target             | Measurement         |
| --------------------- | ------------------ | ------------------- |
| Setup completion rate | +30% vs baseline   | Funnel analytics    |
| Time to first publish | < 10 minutes       | Session analytics   |
| Section skip rate     | < 20%              | Tool call analytics |
| User satisfaction     | > 4.5/5            | Post-setup survey   |
| Quick reply usage     | > 60% of responses | Click analytics     |

---

## Risks & Mitigations

| Risk                         | Probability | Impact         | Mitigation                               |
| ---------------------------- | ----------- | -------------- | ---------------------------------------- |
| LLM ignores section order    | Medium      | User confusion | Explicit tracking in context; validation |
| Quick replies clutter mobile | Low         | UX degradation | Test on mobile; limit to 4 chips         |
| Examples feel generic        | Medium      | Low engagement | A/B test; add more specificity           |
| Progress tracking lag        | Low         | Trust erosion  | Optimistic UI updates                    |

---

## Rollback Plan

1. **Prompt changes:** Revert to previous system prompt (git)
2. **UI components:** Feature flag to hide quick replies
3. **New tools:** Tools are additive; ignore if not called

---

## Future Enhancements (Out of Scope)

1. **MCP Preview Agent** - Real-time visual validation
2. **Voice input** - "Say your headline"
3. **AI copy suggestions** - Generate options proactively
4. **A/B testing** - Compare agent prompts

---

## References

### Internal

- `server/src/agent/prompts/onboarding-system-prompt.ts` - Current prompt
- `server/src/agent/tools/storefront-tools.ts` - Existing tools
- `apps/web/src/components/agent/AgentChat.tsx` - Chat UI
- `docs/design/BRAND_VOICE_GUIDE.md` - HANDLED voice

### External

- [Botpress: Chatbot Best Practices 2025](https://botpress.com/blog/chatbot-best-practices)
- [Parallel HQ: Chatbot UX Design](https://www.parallelhq.com/blog/chatbot-ux-design)
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
