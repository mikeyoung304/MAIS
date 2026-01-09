# Build Mode UX Enhancements (Revised)

## Overview

Enhance Build Mode to deliver a seamless first-time experience where the AI agent guides users through setting up their storefront conversationally. The agent is the interface—we're making it smarter, not building UI scaffolding around it.

**Philosophy:** "Trust the conversation. The agent IS the tour guide, the undo mechanism, and the progress indicator."

**Total Effort:** 2-3 hours
**Lines of Code:** ~50-80 new
**New Files:** 0

---

## Revision Summary

This plan was reviewed by 6 specialized agents (DHH, TypeScript/React, Agent-Native, Architecture, Simplicity, UX) with a focus on quality. **Unanimous feedback:**

1. **Auto-starting tour is wrong** → Make it opt-in via agent conversation
2. **`tour_storefront` is over-engineered** → Replace with inline `[highlight section-id]` parsing
3. **Undo/Redo should be deferred** → Agent handles undo conversationally
4. **forwardRef is unnecessary** → Use declarative props instead

**Original plan:** 5 features, 6-10 hours, ~500 LOC, 2 new files
**Revised plan:** 3 features, 2-3 hours, ~50-80 LOC, 0 new files

---

## Problem Statement

New users landing in Build Mode face a blank canvas with limited guidance. The AI agent exists but doesn't:

- Highlight sections visually when explaining them
- Respond when users click quick action chips
- Provide contextual next-step suggestions

**What we're NOT building (validated by reviewers):**

- Structured tour state machine (agent narrates naturally)
- Undo/redo UI (agent handles conversationally)
- Progress indicators (conversation IS progress)
- localStorage flags (agent context is sufficient)

---

## Proposed Solution

Three focused changes that enhance the agent without building UI crutches:

| Priority | Feature                     | Effort | Description                                      |
| -------- | --------------------------- | ------ | ------------------------------------------------ |
| P0       | Inline Section Highlighting | 1h     | Parse `[highlight section-id]` in agent messages |
| P1       | Wire Static Chips           | 30min  | Chips send messages via prop callback            |
| P1       | Dynamic Quick Chips         | 30min  | Prompt update for context-aware suggestions      |

---

## Technical Approach

### Architecture

```
Agent Message: "Let me show you the hero section. [highlight home-hero-main]"
                                                    ↓
                              PanelAgentChat parses [highlight x]
                                                    ↓
                              Calls onSectionHighlight(pageId, sectionIndex)
                                                    ↓
                              BuildModePage sets highlightedSection state
                                                    ↓
                              BuildModePreview sends PostMessage to iframe
                                                    ↓
                              Section highlights for 3 seconds
```

**Key insight:** No tour state machine. No structured tour steps. The agent controls pacing through natural conversation. Users can interrupt, ask questions, and the agent adapts.

---

## Implementation Details

### Feature 1: Inline Section Highlighting (P0)

**Goal:** When the agent mentions `[highlight section-id]` in a message, that section highlights in the preview.

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

#### Step 1.1: Add highlight parsing utility

```typescript
// Add near top of file or in separate utils file
const HIGHLIGHT_REGEX = /\[highlight ([^\]]+)\]/g;

interface HighlightInstruction {
  sectionId: string;
  match: string; // The full [highlight x] to strip from display
}

function parseHighlightInstructions(content: string): {
  cleanContent: string;
  highlights: HighlightInstruction[];
} {
  const highlights: HighlightInstruction[] = [];
  let cleanContent = content;

  let match;
  while ((match = HIGHLIGHT_REGEX.exec(content)) !== null) {
    highlights.push({
      sectionId: match[1],
      match: match[0],
    });
  }

  // Strip highlight instructions from displayed content
  for (const h of highlights) {
    cleanContent = cleanContent.replace(h.match, '');
  }

  return { cleanContent: cleanContent.trim(), highlights };
}
```

#### Step 1.2: Add prop and handle highlights

```typescript
// Update PanelAgentChatProps interface
interface PanelAgentChatProps {
  // ... existing props
  onSectionHighlight?: (sectionId: string) => void;
}

// In the message rendering logic (around line 480)
// When rendering assistant message content:
const { cleanContent, highlights } = parseHighlightInstructions(message.content);

// Trigger highlights when message appears
useEffect(() => {
  if (highlights.length > 0 && onSectionHighlight) {
    // Highlight each mentioned section with staggered timing
    highlights.forEach((h, index) => {
      setTimeout(() => {
        onSectionHighlight(h.sectionId);
      }, index * 500); // 500ms between multiple highlights
    });
  }
}, [message.id, highlights, onSectionHighlight]);

// Display cleanContent instead of message.content
```

#### Step 1.3: Wire in BuildModeChat

```typescript
// apps/web/src/components/build-mode/BuildModeChat.tsx

// Update to pass onSectionHighlight to PanelAgentChat
<PanelAgentChat
  // ... existing props
  onSectionHighlight={(sectionId) => {
    // Resolve sectionId to pageId + sectionIndex
    const resolved = resolveSectionId(sectionId, draftConfig);
    if (resolved && onSectionHighlight) {
      onSectionHighlight(resolved.pageId, resolved.sectionIndex);
    }
  }}
/>

// Add helper to resolve section IDs
function resolveSectionId(
  sectionId: string,
  config: PagesConfig | null
): { pageId: PageName; sectionIndex: number } | null {
  if (!config) return null;

  // Section IDs follow pattern: {page}-{type}-{qualifier}
  // e.g., "home-hero-main", "about-text-intro"
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;

  const pageId = parts[0] as PageName;
  const page = config.pages?.find(p => p.type === pageId);
  if (!page?.sections) return null;

  const sectionIndex = page.sections.findIndex(s => s.id === sectionId);
  if (sectionIndex === -1) {
    // Fallback: try matching by type
    const sectionType = parts[1];
    const fallbackIndex = page.sections.findIndex(s => s.type === sectionType);
    return fallbackIndex >= 0 ? { pageId, sectionIndex: fallbackIndex } : null;
  }

  return { pageId, sectionIndex };
}
```

#### Step 1.4: Update system prompt for highlighting

**File:** `server/src/agent/prompts/onboarding-system-prompt.ts`

Add to MARKETING phase section:

```markdown
## Visual Highlighting

When explaining or updating sections, you can highlight them in the preview:

- Use `[highlight section-id]` anywhere in your message
- Section IDs follow the pattern: `{page}-{type}-{qualifier}` (e.g., `home-hero-main`)
- The highlight appears for 3 seconds, then clears automatically
- You can use multiple highlights in one message (they'll stagger)

Example:
"Let me show you where your headline lives. [highlight home-hero-main] This is your hero section—the first thing visitors see. It should answer 'Am I in the right place?' in 3 seconds."

When giving tours or explaining the site:

- Highlight ONE section at a time
- Explain in 1-2 sentences
- Ask "Want to see the next section?" or offer quick replies
- Let the user control pacing through conversation
```

---

### Feature 2: Wire Static Chips (P1)

**Goal:** When users click quick action chips, the corresponding prompt is sent to the agent.

**Current problem:** Chips just call `logger.debug` (line 52-65 of BuildModeChat.tsx)

#### Step 2.1: Add callback prop to PanelAgentChat

```typescript
// apps/web/src/components/agent/PanelAgentChat.tsx

interface PanelAgentChatProps {
  // ... existing props
  onQuickAction?: (prompt: string) => void;
}

// Expose setInputValue through the callback
// When onQuickAction is called, set input and focus
useEffect(() => {
  // This is handled through the parent passing the callback
}, []);

// The parent will call this when chips are clicked
// PanelAgentChat doesn't need to change much - the parent handles it
```

Actually, simpler approach - just use a ref to the input:

#### Step 2.2: Simpler - lift input control up

```typescript
// apps/web/src/components/build-mode/BuildModeChat.tsx

// Add state for programmatic input
const [pendingMessage, setPendingMessage] = useState<string | null>(null);

// Update handleQuickAction
const handleQuickAction = useCallback((action: string) => {
  const prompts: Record<string, string> = {
    headline: 'Help me improve my headline on the home page',
    section: 'I want to add a new section to my page',
    text: 'Help me improve the copy on my website',
    image: 'I need help choosing images for my site',
    testimonials: 'I want to add a customer testimonial',
  };

  const prompt = prompts[action];
  if (prompt) {
    setPendingMessage(prompt);
  }
}, []);

// Pass to PanelAgentChat
<PanelAgentChat
  // ... existing props
  initialMessage={pendingMessage}
  onMessageConsumed={() => setPendingMessage(null)}
/>
```

#### Step 2.3: Handle in PanelAgentChat

```typescript
// apps/web/src/components/agent/PanelAgentChat.tsx

interface PanelAgentChatProps {
  // ... existing props
  initialMessage?: string | null;
  onMessageConsumed?: () => void;
}

// Add effect to handle incoming message
useEffect(() => {
  if (initialMessage && !isLoading) {
    setInputValue(initialMessage);
    inputRef.current?.focus();
    onMessageConsumed?.();

    // Optionally auto-send after a brief delay
    // Or let user review and press Enter
  }
}, [initialMessage, isLoading, onMessageConsumed]);
```

---

### Feature 3: Dynamic Quick Chips (P1)

**Goal:** Agent includes contextual quick reply suggestions in responses.

**File:** `server/src/agent/prompts/onboarding-system-prompt.ts`

Add/update in MARKETING phase section:

```markdown
## Quick Reply Suggestions

After each response, include 2-4 contextual quick replies based on what the user might want to do next.

Format: `[Quick Replies: Action 1 | Action 2 | Action 3]`

**Context-aware suggestions by scenario:**

After explaining a section:
[Quick Replies: Edit this section | Show me the next one | I have a question]

After making a change:
[Quick Replies: Looks good! | Change something | Preview the site]

When user seems stuck:
[Quick Replies: Show me around | Just update my headline | What should I do first?]

After updating hero:
[Quick Replies: Update subheadline | Move to About section | Preview changes]

**Rules:**

1. Maximum 4 options per message
2. First option = most likely next action
3. Always include an escape hatch ("I have a question", "Something else")
4. Use action verbs: "Update", "Show", "Add" - not "Would you like to..."
5. If user asks a question, skip quick replies for that response
```

---

## What We're NOT Building

Based on reviewer consensus, these are explicitly deferred:

| Feature                        | Why Deferred                                    |
| ------------------------------ | ----------------------------------------------- |
| `tour_storefront` backend tool | Agent narrates naturally with inline highlights |
| `useBuildModeTour` hook        | No separate tour state needed                   |
| `useDraftHistory` hook         | Agent handles undo: "Undo that" → agent reverts |
| Undo/Redo buttons              | No validated user need yet                      |
| localStorage tour flag         | Agent context is sufficient                     |
| Progress indicators            | Conversation IS progress                        |
| forwardRef/useImperativeHandle | Declarative props are simpler                   |

**If users struggle after shipping:**

1. First: Improve agent prompts (free)
2. Then: Add "Undo last change" quick chip (easy)
3. Last resort: Build UI features (only if data proves need)

---

## Acceptance Criteria

### Feature 1: Inline Section Highlighting

- [ ] Agent message with `[highlight home-hero-main]` highlights hero section
- [ ] Highlight instruction stripped from displayed message
- [ ] Multiple highlights in one message work (staggered 500ms)
- [ ] Highlight clears after 3 seconds
- [ ] Invalid section IDs fail silently (no error shown)
- [ ] Agent uses highlights when explaining sections

### Feature 2: Wire Static Chips

- [ ] Click "Edit headline" → Input shows "Help me improve my headline..."
- [ ] Click "Add section" → Input shows "I want to add a new section..."
- [ ] All 5 static chips work correctly
- [ ] Input focuses after chip click
- [ ] Chips disabled while agent is responding (existing behavior)

### Feature 3: Dynamic Quick Chips

- [ ] Agent responses include `[Quick Replies: X | Y | Z]`
- [ ] Suggestions are contextual to last action
- [ ] Quick replies appear after most responses
- [ ] Static chips remain as fallback if no quick replies parsed

---

## Files to Modify

| File                                                   | Change                                                                      | LOC |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | --- |
| `apps/web/src/components/agent/PanelAgentChat.tsx`     | Add highlight parsing, onSectionHighlight prop, initialMessage prop         | ~40 |
| `apps/web/src/components/build-mode/BuildModeChat.tsx` | Wire highlight callback, add pendingMessage state, update handleQuickAction | ~30 |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | Add highlighting + quick chips guidance                                     | ~40 |

**Total new code:** ~110 lines (including comments)
**New files:** 0
**New hooks:** 0
**New backend tools:** 0

---

## Agent-Native Design Principles Applied

This implementation follows agent-native architecture:

1. **Conversation as Interface** - No UI state machines; agent controls pacing
2. **Primitive Operations** - Highlight is a simple instruction, not a workflow tool
3. **Guidance in Prompts** - Section explanations live in system prompt, not code
4. **User Agency** - User can interrupt, ask questions, skip ahead
5. **Graceful Degradation** - If highlighting fails, conversation continues

---

## Testing Plan

### Manual Testing

1. **Highlighting:**
   - Send message "Show me the hero section [highlight home-hero-main]"
   - Verify section highlights, instruction not shown in chat
   - Verify highlight clears after 3 seconds

2. **Quick Chips:**
   - Click "Edit headline" chip
   - Verify input populates with prompt
   - Press Enter, verify message sends

3. **Dynamic Chips:**
   - Have agent make a change
   - Verify quick reply chips appear below response
   - Click one, verify it sends as message

### Edge Cases

- [ ] Highlight on non-existent section → silently ignored
- [ ] Multiple rapid chip clicks → debounced/queued
- [ ] Quick reply while agent responding → waits for completion

---

## Success Criteria

After shipping, users should:

1. See visual feedback when agent explains sections
2. Click chips to quickly start common tasks
3. Have contextual next-step suggestions available
4. Feel the agent is guiding them, not UI widgets

**The agent is the star. The UI just makes it shine.**

---

## Future Considerations (Only If Data Proves Need)

| Signal                                     | Response                                |
| ------------------------------------------ | --------------------------------------- |
| Users say "what did you change?"           | Add change summary in agent response    |
| Users make mistakes and don't ask for undo | Add "Undo last change" quick chip       |
| Users ask "what's left to do?"             | Add completion summary tool             |
| Users abandon mid-setup frequently         | Consider lightweight progress indicator |

---

## References

### Internal

- `apps/web/src/lib/build-mode/protocol.ts:44-49` - Existing highlight message schema
- `server/src/agent/prompts/onboarding-system-prompt.ts:158-166` - Quick reply format

### Review Feedback Sources

- DHH Philosophy Review - "Trust the conversation"
- Agent-Native Review - Primitive tools over workflow tools
- Simplicity Review - "The agent IS the tour guide"
- UX Review - Accessibility and discoverability concerns

### Commits

- `b87da8bb` - Signup → Build Mode redirect
- `e81e2a34` - Dual-mode orchestrator, quick reply chips
