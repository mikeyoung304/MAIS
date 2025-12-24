---
module: MAIS
date: 2025-12-04
problem_type: logic_error
component: client/features/visual-editor
symptoms:
  - User changes disappear after rapid editing
  - Browser refresh shows older data than expected
  - Slow network causes edits to be overwritten
  - Rapid typing loses characters
root_cause: Debounced auto-save without version tracking allows stale writes to overwrite recent changes
resolution_type: fix_with_pattern
severity: P1
related_files:
  - client/src/features/landing-page/hooks/useAutoSave.ts
  - client/src/features/visual-editor/hooks/useVisualEditor.ts
  - server/src/services/landing-page.service.ts
tags: [data-integrity, auto-save, race-condition, optimistic-concurrency]
---

# Auto-Save Race Conditions

## Problem

Auto-save features that debounce user input can lose data when saves fire out-of-order due to network latency, or when debounce captures stale state.

## Anti-Pattern

```typescript
// BAD: No version tracking - last write wins (even if stale)
const handleChange = async (field: string, value: string) => {
  setConfig({ ...config, [field]: value });
  debouncedSave({ ...config, [field]: value }); // Closure captures stale config!
};

// BAD: Fire-and-forget without conflict detection
const debouncedSave = debounce(async (data) => {
  await api.saveDraft(data); // No version check - overwrites blindly
}, 1000);
```

## Solution Pattern

```typescript
// GOOD: Version-based optimistic concurrency
const [version, setVersion] = useState(initialVersion);

// Use ref for latest state (avoids stale closure)
const configRef = useRef(config);
useEffect(() => { configRef.current = config; }, [config]);

const handleSave = useCallback(async () => {
  const currentConfig = configRef.current;  // Always latest
  try {
    const result = await api.saveDraft({
      ...currentConfig,
      expectedVersion: version  // Server validates this
    });
    setVersion(result.newVersion);
  } catch (error) {
    if (error.code === 'VERSION_CONFLICT') {
      handleConflict(error.serverData, currentConfig);
    }
  }
}, [version]);

// Server-side version validation
async saveDraft(tenantId: string, data: DraftInput) {
  return await prisma.$transaction(async (tx) => {
    const current = await tx.draft.findUnique({ where: { id: data.id } });
    if (current.version !== data.expectedVersion) {
      throw new VersionConflictError(current);
    }
    return tx.draft.update({
      where: { id: data.id },
      data: { ...data, version: { increment: 1 } }
    });
  });
}
```

## Implementation Checklist

- [ ] Draft entities have `version: Int` column in schema
- [ ] Save operations include `expectedVersion` parameter
- [ ] Server validates version inside transaction
- [ ] Client handles VERSION_CONFLICT error gracefully
- [ ] Use refs or functional updates to avoid stale closures

## Conflict Resolution Strategies

1. **Last-write-wins with warning:** Show user what was overwritten
2. **Server-wins:** Refresh client state from server
3. **Merge:** Combine changes field-by-field (complex)
4. **User prompt:** Ask user to resolve manually

## Detection Signals

- User reports "my changes disappeared"
- Rapid typing loses characters intermittently
- Console shows multiple concurrent save requests
- Network slow → recent edits overwritten by older save

## Reference Implementation

See `useVisualEditor.ts` for functional state updates pattern.
