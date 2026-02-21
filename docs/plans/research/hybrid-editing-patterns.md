# Hybrid Editing Patterns: AI Chat + Inline Editing Coexistence

> Phase 7 (V2) research. Deferred until core onboarding is validated.
> Last updated: 2026-02-20

## 1. Wix Harmony Pattern: Unified Workspace (Not Toggle)

Wix Harmony (Jan 2026) merges AI agent "Aria" with pixel-level manual editing in a single canvas. Key lesson: **never force a mode switch**. AI chat sits in a persistent side panel; the canvas is always directly editable. AI changes land on the same canvas the user manually edits -- no separate "AI preview" mode. Webflow's AI assistant follows the same pattern: hover a section to access AI replace/reorder/delete, then hand-edit inline without leaving the canvas.

**Recommendation:** Keep our chat panel and iframe preview. Add click-to-edit overlays on the iframe. AI writes to the same `SectionContent` rows the user edits.

## 2. Rich Text Editor: TipTap over Lexical

TipTap (ProseMirror wrapper) is the pragmatic choice for 2025-2026 inline editing in React:

- Extension-based architecture (bold, images, mentions) is clean and composable
- First-class React/Vue/Angular support; Lexical still pre-1.0
- Collaboration-ready (Yjs binding) for future real-time co-editing
- Sufficient performance for single-user editing (Lexical's edge only matters at Facebook scale)

**Recommendation:** Use TipTap for inline text regions. Mount inside iframe via PostMessage bridge. Keep Lexical on the radar for post-1.0 re-evaluation.

## 3. Click-to-Edit Interaction Layers

Standard pattern from Webflow/Framer/Squarespace:

1. **Hover:** Light border + toolbar appears (move, delete, AI-edit, duplicate)
2. **Single click:** Select section -- shows resize handles, section toolbar
3. **Double click:** Enter inline text editing (TipTap instance activates)
4. **Escape / click-away:** Exit edit mode, commit changes

**Recommendation:** Implement as an overlay layer in the iframe. Parent sends `ENTER_EDIT_MODE` via PostMessage; iframe highlights the target `data-section-id` element.

## 4. Cross-Frame Communication (PostMessage)

For iframe-based preview, use a typed message protocol:

```typescript
type EditorMessage =
  | { type: 'SECTION_UPDATED'; sectionId: string; content: SectionContent }
  | { type: 'ENTER_EDIT_MODE'; sectionId: string }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'SECTION_REORDERED'; order: string[] }
  | { type: 'AI_STREAMING_CHUNK'; sectionId: string; html: string };
```

Always validate `event.origin`. Never use `"*"` as targetOrigin in production. Use a shared `EditorMessageSchema` (Zod) in `@macon/contracts`.

## 5. Optimistic Locking for Concurrent AI + Manual Edits

Add a `version` integer field to `SectionContent`. Every write increments it. Pattern:

1. Client reads section + version
2. On save: `UPDATE ... WHERE id = ? AND version = ?`
3. If 0 rows updated -> conflict -> reload + show diff
4. AI edits carry the version they read; if user edited first, AI change is rejected

Manual edits always win. AI retry is cheap; lost human work is not.

**Recommendation:** Add `version Int @default(0)` to `SectionContent` in Prisma schema. Increment on every `updateSection()` call.

## 6. AI Change Visualization

Three proven patterns from 2025 AI builder UX research:

- **Section highlight:** Blue border + surrounding sections dim to 40% opacity during AI generation
- **Streaming text:** Inject HTML chunks into the iframe via `AI_STREAMING_CHUNK` PostMessage as tokens arrive. Use `requestAnimationFrame` batching (not per-token DOM writes)
- **Review bar:** Sticky bottom bar per AI-modified section: `Keep | Undo | Try Again`. Auto-dismiss after 30s or next user action

Respect `prefers-reduced-motion`: skip border animations, show changes instantly without fade/slide, replace streaming with a single content swap + "New content from AI" badge.

## 7. Conflict Resolution: Manual Edits as Source of Truth

Rule: if a user is actively editing a section (TipTap is focused), block AI writes to that section. Queue AI changes and show "AI wants to update this section" toast. User decides: Apply | Dismiss.

If user is NOT editing, AI writes land immediately with the review bar (Keep/Undo/Try Again).

## 8. Auto-Save with Version Tracking

- Debounce saves at 1500ms after last keystroke (TipTap `onUpdate`)
- Each save increments `version` and stores `lastEditedBy: 'human' | 'ai'`
- Race condition guard: use `AbortController` to cancel in-flight saves when a new save triggers
- Persist draft state to `SectionContent` (isDraft: true) -- already supported in our schema

## 9. Drag-and-Drop Section Reorder

Use **@dnd-kit/sortable** (MIT, actively maintained, accessibility-first):

- `useSortable` hook per section in the sidebar section list
- On drop: update `SectionContent.order` field, send `SECTION_REORDERED` to iframe
- Keyboard support built-in (Space to grab, arrows to move, Space to drop)
- Works with our existing section model -- just needs an `order` integer column

## 10. Image Upload/Replace Picker

Click image in preview -> overlay shows Replace button -> opens file picker or AI image generation panel. Store via existing upload pipeline. Show placeholder skeleton during upload.

## 11. Accessibility for Contenteditable

- Use `role="textbox"` + `aria-multiline="true"` on TipTap containers
- `aria-label="Edit [section name] content"` for screen reader context
- Keyboard: Tab into section list, Enter to select, F2 or Enter to edit text, Escape to exit
- Focus trap inside TipTap when editing; Escape releases focus back to section list
- All toolbar buttons need `aria-label` and keyboard shortcuts

## 12. Undo/Redo Stack with Attribution

Maintain a single undo stack with entries tagged `{ source: 'human' | 'ai', sectionId, timestamp, patch }`. Use JSON patches (RFC 6902) for efficient storage. Benefits:

- "Undo last AI change" skips human edits in the stack
- "Undo all AI changes" filters by source
- Stack cap: 50 entries, oldest evicted first

## 13. Performance During Streaming

- Batch DOM updates with `requestAnimationFrame` -- never write per-token
- Debounce PostMessage to iframe: max 60fps (16ms throttle)
- During AI streaming, disable auto-save until stream completes
- Use `React.memo` / `useMemo` on non-streaming sections to avoid re-renders
- Virtualize section list if >20 sections (unlikely but defensive)

## 14. Reference Implementations

| Project                                           | What to Study                                                             | License     |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| [Puck](https://puckeditor.com)                    | Open-source React page builder with AI generation, drag-drop, JSON output | MIT         |
| [Wix Harmony](https://wix.com/harmony)            | AI + manual editing coexistence UX, Aria agent                            | Proprietary |
| [Webflow AI](https://webflow.com/ai-site-builder) | Section-level AI editing, hover toolbars                                  | Proprietary |
| [TipTap](https://tiptap.dev)                      | Rich text editor with collaboration extensions                            | MIT core    |
| [@dnd-kit](https://dndkit.com)                    | Drag-and-drop toolkit for React                                           | MIT         |
