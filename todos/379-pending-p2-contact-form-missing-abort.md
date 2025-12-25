---
status: pending
priority: p2
issue_id: '379'
tags: [code-review, performance, react]
dependencies: []
---

# P2: Missing AbortController in ContactForm Submit

**Priority:** P2 (Important)
**Category:** Performance / Memory Safety
**Source:** Code Review - Performance Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The ContactForm component doesn't use AbortController for its simulated API call. If the user navigates away during submission, the promise will continue running and potentially update state on an unmounted component.

## Location

- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx` - handleSubmit function

## Risk

- Memory leak if component unmounts during submission
- React "Can't perform state update on unmounted component" warning
- Poor resource management
- When Phase 2 adds real API calls, this becomes more critical

## Solution

Add AbortController and cleanup:

```typescript
// ContactForm.tsx
const [isSubmitting, setIsSubmitting] = useState(false);
const abortControllerRef = useRef<AbortController | null>(null);

// Cleanup on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Cancel any in-flight request
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  setIsSubmitting(true);

  try {
    // Phase 1: Simulated delay
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, 1500);
      abortControllerRef.current!.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

    // Don't update state if aborted
    if (abortControllerRef.current?.signal.aborted) return;

    setSubmitState('success');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return; // Silently ignore aborted requests
    }
    setSubmitState('error');
  } finally {
    setIsSubmitting(false);
  }
};
```

## Acceptance Criteria

- [ ] Add AbortController to ContactForm
- [ ] Cleanup on component unmount
- [ ] Verify no React warnings when navigating during submission
- [ ] Test rapid submit → navigate away → verify no memory leak

## Related Files

- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx`
