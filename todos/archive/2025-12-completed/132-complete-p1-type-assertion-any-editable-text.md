---
status: complete
priority: p1
issue_id: '132'
tags: [code-review, visual-editor, typescript, type-safety]
dependencies: []
---

# Type Assertion `as any` in EditableText Component

## Problem Statement

The EditableText component uses `as any` type assertion to bypass TypeScript's type checking for the input ref. This defeats the purpose of strict TypeScript configuration and could hide type errors.

**Why it matters**: Type safety is critical for catching bugs at compile time. Using `as any` creates a potential source of runtime errors that TypeScript cannot detect.

## Findings

### Discovery Source

Code Quality Review Agent - Code Review

### Evidence

Location: `client/src/features/tenant-admin/visual-editor/components/EditableText.tsx` line 130

```typescript
const commonProps = {
  ref: inputRef as any, // <-- Type assertion bypass
  value: editValue,
  // ...
};
```

The `inputRef` is typed as `useRef<HTMLInputElement | HTMLTextAreaElement>(null)` but the `ref` prop expects a more specific type depending on which element is rendered.

## Proposed Solutions

### Option 1: Use Separate Refs (Recommended)

Create separate refs for input and textarea elements.

```typescript
const inputRef = useRef<HTMLInputElement>(null);
const textareaRef = useRef<HTMLTextAreaElement>(null);

// In render
if (multiline) {
  return <textarea ref={textareaRef} {...commonProps} rows={rows} />;
}
return <input ref={inputRef} {...commonProps} type="text" />;
```

**Pros**: Full type safety, no assertions needed
**Cons**: Slight code duplication
**Effort**: Small
**Risk**: Low

### Option 2: Use Generic Ref Type

Use a more permissive but still type-safe ref type.

```typescript
const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
```

**Pros**: Single ref, no duplication
**Cons**: Type intersection may have unexpected behavior
**Effort**: Small
**Risk**: Medium

### Option 3: Use forwardRef with Generics

Refactor component to use forwardRef with proper generic typing.

```typescript
const EditableText = forwardRef<HTMLInputElement | HTMLTextAreaElement, EditableTextProps>(
  (props, ref) => { ... }
);
```

**Pros**: Proper React pattern, full type safety
**Cons**: More complex refactor
**Effort**: Medium
**Risk**: Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

### Affected Files

- `client/src/features/tenant-admin/visual-editor/components/EditableText.tsx`

### Affected Components

- EditableText component
- All components using EditableText (EditablePackageCard)

### Database Changes Required

None

## Acceptance Criteria

- [ ] No `as any` type assertions in EditableText
- [ ] Component still functions correctly for both input and textarea modes
- [ ] TypeScript compiles without errors
- [ ] Focus management still works correctly
- [ ] All keyboard shortcuts (Enter, Escape) still function

## Work Log

| Date       | Action  | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources

- PR: feat(visual-editor) commit 0327dee
- TypeScript strict mode documentation
