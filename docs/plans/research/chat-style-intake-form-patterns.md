# Chat-Style Intake Form Patterns (Research 2025-2026)

Stack: React 18 + Next.js 14 + TypeScript. ~10 questions, one-at-a-time chat bubble UI.

## 1. Chat-Style vs Multi-Step Wizard

Chat forms outperform wizards when questions feel conversational and answers affect next questions. Key difference: wizards show all fields per step; chat shows one field inside a message bubble. Use a scrollable message log (not paginated steps) so users see prior answers above.

## 2. Progressive Per-Question Validation (Zod + React Hook Form)

Validate on submit of each bubble, not on blur. Each question has its own Zod schema.

```typescript
const questionSchemas = {
  businessName: z.object({ businessName: z.string().min(2, 'Required') }),
  serviceType: z.object({ serviceType: z.enum(['photography', 'coaching', 'therapy']) }),
  logo: z.object({ logo: z.instanceof(File).refine((f) => f.size < 5_000_000, 'Max 5MB') }),
} satisfies Record<string, z.ZodSchema>;

// On Enter/button click per question:
const result = questionSchemas[currentQ].safeParse(answer);
if (!result.success) setError(result.error.issues[0].message);
else advanceToNext(result.data);
```

## 3. Server-Side Per-Answer Persistence

Fire `useMutation` immediately after each answer is validated. Store partial progress keyed by `tenantId + onboardingSessionId`. Never batch — save each answer atomically so refresh recovery works.

```typescript
const saveAnswer = useMutation({
  mutationFn: (data: { questionId: string; answer: unknown }) =>
    apiClient.onboarding.saveAnswer({ body: data }),
  onError: () => toast('Failed to save, retrying...'),
  retry: 2,
});
// After validation passes:
saveAnswer.mutate({ questionId: currentQ, answer: validatedValue });
```

## 4. Resume-From-Where-You-Left-Off

On mount, fetch saved progress via `useQuery`. Replay all answered questions as read-only bubbles, then show the first unanswered question. Store `lastCompletedQuestionId` server-side.

```typescript
const { data: progress } = useQuery({
  queryKey: ['onboarding', 'progress', tenantId],
  queryFn: () => apiClient.onboarding.getProgress(),
});
// On load: render answered questions as disabled bubbles, scroll to first unanswered
useEffect(() => {
  if (progress?.answers) {
    setAnsweredQuestions(progress.answers);
    setCurrentIndex(progress.answers.length);
  }
}, [progress]);
```

## 5. Conditional Question Branching

Model the question graph as a simple map, not a state machine (XState is overkill for ~10 questions). Each question defines a `next` function that reads prior answers.

```typescript
type Question = {
  id: string; type: 'text' | 'select' | 'file' | 'multi-select';
  prompt: string; options?: string[];
  next: (answers: Record<string, unknown>) => string | null; // null = done
};
const questions: Question[] = [
  { id: 'hasTeam', type: 'select', prompt: 'Do you have a team?', options: ['Yes', 'No'],
    next: (a) => a.hasTeam === 'Yes' ? 'teamSize' : 'soloWorkflow' },
  { id: 'teamSize', type: 'text', prompt: 'How many team members?', next: () => 'nextQ' },
  { id: 'soloWorkflow', type: 'select', prompt: 'How do you manage bookings?', ...},
];
```

## 6. Input Type Switching Per Question

Render a different input component per `question.type`. Keep the chat bubble wrapper consistent; only the inner input changes.

```tsx
function QuestionInput({ question, onSubmit }: Props) {
  switch (question.type) {
    case 'text':
      return <TextBubbleInput onSubmit={onSubmit} />;
    case 'select':
      return <SelectBubbleInput options={question.options!} onSubmit={onSubmit} />;
    case 'multi-select':
      return <MultiSelectBubble options={question.options!} onSubmit={onSubmit} />;
    case 'file':
      return <FileUploadBubble accept={question.accept} onSubmit={onSubmit} />;
  }
}
```

## 7. Keyboard Accessibility

- `Enter` submits the current answer (except multi-line text: use `Shift+Enter` for newlines).
- `Tab` moves focus between option chips in select/multi-select.
- `Escape` clears current input.
- Auto-focus the active input after each new question appears (with 300ms delay for animation).

## 8. Screen Reader: aria-live Regions

Wrap the chat log in `role="log"` with `aria-live="polite"`. Keep the container mounted at all times — never unmount/remount or screen readers lose tracking.

```tsx
<div role="log" aria-live="polite" aria-label="Onboarding conversation">
  {messages.map((msg) => (
    <ChatBubble key={msg.id} {...msg} />
  ))}
</div>;
{
  /* Separate assertive region for errors only */
}
<div aria-live="assertive" className="sr-only">
  {errorMessage}
</div>;
```

## 9. Animation: Chat Bubble Appearance + Scroll

Use `motion.div` (Framer Motion) with `initial={{ opacity: 0, y: 20 }}` and `animate={{ opacity: 1, y: 0 }}`. Auto-scroll to the newest bubble using `scrollIntoView({ behavior: 'smooth', block: 'end' })` in a `useEffect` triggered by message count. Add a 150ms stagger between the "question bubble" appearing and the "input area" appearing.

## 10. React Query: Per-Answer Mutation + Progress

One `useMutation` for saving answers. One `useQuery` for loading progress on mount. Invalidate progress query `onSettled` of save mutation. Do NOT use optimistic updates here — the UI already shows the answer; the mutation is fire-and-forget with retry.

## 11. Mobile Responsiveness

- Chat bubbles: `max-w-[85vw]` on mobile, `max-w-md` on desktop.
- Pin the input area to the bottom with `sticky bottom-0` to avoid keyboard push-up issues.
- Use `visualViewport` API to handle iOS virtual keyboard resizing.
- Select options render as full-width tap targets (min 44px height per WCAG).

## 12. File Upload in Chat

Render a compact drop zone inside the chat bubble. Show upload progress inline. After upload completes, display a thumbnail preview in the answered bubble. Use presigned URLs — upload directly to cloud storage, save the URL as the answer.

## 13. Progress Indicator

Show a subtle top bar: `Question 3 of 10` or a thin progress bar. Update after each answered question. On conditional branches where total changes, show `Question 3 of ~10` or hide the total and show only current count with a progress ring.
