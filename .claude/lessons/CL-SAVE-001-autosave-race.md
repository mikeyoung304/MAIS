# CL-SAVE-001: Auto-Save Race Conditions

**Severity:** P1 | **Category:** Data Integrity | **Impact:** Data loss, stale overwrites

## Problem

Auto-save features that debounce user input can lose data when multiple saves fire in rapid succession, or when network latency causes out-of-order responses.

## Bug Pattern

```typescript
// BROKEN: No version tracking - last write wins (even if stale)
const handleChange = async (field: string, value: string) => {
  setConfig({ ...config, [field]: value });
  debouncedSave({ ...config, [field]: value });  // Race condition!
};

// BROKEN: Fire-and-forget saves lose user's recent changes
const debouncedSave = debounce(async (data) => {
  await api.saveDraft(data);  // No version check
}, 1000);
```

## Fix Pattern

```typescript
// CORRECT: Version-based optimistic concurrency
const [version, setVersion] = useState(initialVersion);

const handleSave = async (data: DraftConfig) => {
  try {
    const result = await api.saveDraft({
      ...data,
      expectedVersion: version  // Conflict detection
    });
    setVersion(result.newVersion);
  } catch (error) {
    if (error.code === 'VERSION_CONFLICT') {
      // Merge or prompt user
      handleConflict(error.serverData, data);
    }
  }
};

// CORRECT: Server-side version check
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

## Prevention Checklist

- [ ] Draft entities have `version: Int` column
- [ ] Save operations include `expectedVersion`
- [ ] Server validates version in transaction
- [ ] Client handles VERSION_CONFLICT errors
- [ ] Debounce uses latest state (not closure-captured)

## Detection

- User reports "my changes disappeared"
- Rapid typing loses characters
- Browser refresh shows older data
- Network slow → edits overwritten
