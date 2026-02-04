# PostMessage Message Registry

**Central registry of all PostMessage protocols in MAIS codebase.**

Last audited: 2026-02-04

## Build Mode Protocol

**File:** `apps/web/src/lib/build-mode/protocol.ts`
**Participants:** `PreviewPanel.tsx` (parent) ↔ `useBuildModeSync.ts` (iframe)

### Parent → Iframe Messages

| Type                                 | Status        | Schema | Handler                      | Sender                  | Purpose                                        | Notes                                              |
| ------------------------------------ | ------------- | ------ | ---------------------------- | ----------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `BUILD_MODE_INIT`                    | ✅ Active     | ✓      | ✓ `useBuildModeSync:187`     | `PreviewPanel:217`      | Send initial draft config to iframe on connect | Sent during handshake after iframe reports ready   |
| `BUILD_MODE_CONFIG_UPDATE`           | ✅ Active     | ✓      | ✓ `useBuildModeSync:192`     | `PreviewPanel:180, 193` | Notify iframe of draft config changes          | Sent when parent form updates draft                |
| `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID` | ✅ Active     | ✓      | ✓ `useBuildModeSync:205`     | `PreviewPanel:269`      | Highlight section by stable ID                 | Preferred over index-based (stable across reorder) |
| `BUILD_MODE_CLEAR_HIGHLIGHT`         | ✅ Active     | ✓      | ✓ `useBuildModeSync:225`     | `PreviewPanel:274`      | Remove section highlight                       | Sent when user deselects section                   |
| `BUILD_MODE_HIGHLIGHT_SECTION`       | ⚠️ Deprecated | ✓      | ✓ `useBuildModeSync:214-218` | None                    | Highlight section by index                     | Use ID-based instead; kept for backward compat     |

**Protocols:**

- Origin validation: ✓ (line 179: `isSameOrigin()`)
- Zod validation: ✓ (line 182: `parseParentMessage()`)
- Timeout handling: ✓ (10s handshake timeout, retry logic)

### Iframe → Parent Messages

| Type                          | Status    | Schema | Handler              | Sender                       | Purpose                          | Notes                                               |
| ----------------------------- | --------- | ------ | -------------------- | ---------------------------- | -------------------------------- | --------------------------------------------------- |
| `BUILD_MODE_READY`            | ✅ Active | ✓      | ✓ `PreviewPanel:220` | ✓ `useBuildModeSync:134`     | Iframe ready for communication   | Sent on load with retry logic (1s interval, 4x max) |
| `BUILD_MODE_SECTION_SELECTED` | ✅ Active | ✓      | ✓ `PreviewPanel:226` | ✓ `useBuildModeSync:237-244` | Notify parent of section click   | Data: `{ pageId, sectionIndex }`                    |
| `BUILD_MODE_PAGE_CHANGE`      | ✅ Active | ✓      | ✓ `PreviewPanel:229` | ✓ `useBuildModeSync:249-257` | Notify parent of page navigation | Data: `{ pageId }`                                  |

**Protocols:**

- Origin validation: ✓ (line 251: listener checks origin on parent side)
- Zod validation: ✓ (line 232: `parseChildMessage()`)

## Service Worker Protocol

**File:** `apps/web/src/components/pwa/ServiceWorkerRegistration.tsx`
**Participants:** `ServiceWorkerRegistration.tsx` (main) → Service Worker (worker)

### Main Thread → Service Worker Messages

| Type           | Status    | Schema | Handler                           | Sender                                | Purpose                             | Notes                                                  |
| -------------- | --------- | ------ | --------------------------------- | ------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| `SKIP_WAITING` | ✅ Active | Custom | ✓ SW listener (service-worker.ts) | ✓ `ServiceWorkerRegistration:40, 189` | Activate new service worker version | Sent when new version available, user confirms upgrade |

**Protocols:**

- Origin validation: ✓ (Service Workers are same-origin only)
- Zod validation: Manual (custom object, not Zod)
- Error handling: ✓ (line 40: `registration.waiting?.postMessage()`)

---

## Audit Results

**Total message types:** 8
**Active:** 7 ✅
**Deprecated:** 1 ⚠️
**Dead (handler no sender):** 0
**Orphaned (sender no handler):** 0

**Last verification:** 2026-02-04

### Deprecated Messages (Pending Removal)

| Type                           | Reason                           | Replacement                          | Planned Removal |
| ------------------------------ | -------------------------------- | ------------------------------------ | --------------- |
| `BUILD_MODE_HIGHLIGHT_SECTION` | Index unstable across reordering | `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID` | 2026-03-01      |

No code currently sends this message type. Safe to remove on 2026-03-01 if no regression testing needed.

---

## Addition Workflow

When adding a new PostMessage protocol:

### 1. Before Coding

```typescript
// Add to this registry:
// - Message type name
// - Schema definition location
// - Handler location
// - Sender location
// - Purpose description
```

### 2. After Merge

Update this file:

```markdown
| NEW_MESSAGE_TYPE | ✅ Active | ✓ | ✓ location:line | location:line | Purpose | Notes |
```

Commit with: `docs: add NEW_MESSAGE_TYPE to PostMessage registry`

### 3. Quarterly Audit

Run:

```bash
# Verify all types in this file have senders
grep "✅\|✔" docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md | \
  grep -v "^|" | while read line; do
    type=$(echo "$line" | cut -d'|' -f2 | xargs)
    echo "Checking: $type"
    git grep "$type" apps/web/src --include="*.ts" --include="*.tsx" | \
      grep -v "protocol.ts" | grep -v "case '" | head -1
  done
```

---

## Query Examples

### Find all messages sent by PreviewPanel

```bash
grep -n "postMessage" apps/web/src/components/preview/PreviewPanel.tsx
```

**Result:**

- Line 180: `BUILD_MODE_CONFIG_UPDATE`
- Line 193: `BUILD_MODE_CONFIG_UPDATE` (update on page change)
- Line 217: `BUILD_MODE_INIT`
- Line 269: `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID`
- Line 274: `BUILD_MODE_CLEAR_HIGHLIGHT`

### Find all handlers in useBuildModeSync

```bash
grep -n "case '" apps/web/src/hooks/useBuildModeSync.ts
```

**Result:**

- Line 186: BUILD_MODE_INIT
- Line 192: BUILD_MODE_CONFIG_UPDATE
- Line 205: BUILD_MODE_HIGHLIGHT_SECTION_BY_ID
- Line 225: BUILD_MODE_CLEAR_HIGHLIGHT

### Check if a message type is used

```bash
MESSAGE_TYPE="BUILD_MODE_INIT"
echo "Protocol definition:"
grep "$MESSAGE_TYPE" apps/web/src/lib/build-mode/protocol.ts | head -1

echo -e "\nHandlers:"
grep -r "case '$MESSAGE_TYPE'" apps/web/src --include="*.ts" --include="*.tsx"

echo -e "\nSenders:"
git grep "$MESSAGE_TYPE" apps/web/src --include="*.ts" --include="*.tsx" | \
  grep -v "protocol.ts" | grep -v "case '"
```

---

## Security Checklist

For each protocol:

- [ ] **Origin validation:** All listeners check `event.origin` before processing
- [ ] **Zod validation:** All listeners validate message schema with `safeParse()`
- [ ] **Timeout handling:** Handshakes have timeout + error handling
- [ ] **Error recovery:** Failed sends don't crash the app
- [ ] **Logging:** Message send/receive is logged for debugging
- [ ] **Tests:** Round-trip tests verify sender → handler → verification

### Build Mode Protocol Security Status

✅ Origin validation: `isSameOrigin()` called in listeners
✅ Zod validation: `parseParentMessage()` and `parseChildMessage()` used
✅ Timeout handling: 10s handshake timeout + 1s retry (4x max)
✅ Error recovery: Logger warns if iframe missing or send fails
✅ Logging: `logger.warn()` for connection issues
⚠️ Tests: Some coverage, could expand round-trip tests

---

## Historical Changes

| Date       | Change             | Details                                                           |
| ---------- | ------------------ | ----------------------------------------------------------------- |
| 2026-02-04 | Created registry   | Initial catalog of all PostMessage protocols                      |
| 2026-02-04 | Removed dead types | BUILD_MODE_SECTION_EDIT, BUILD_MODE_SECTION_RENDERED (Issue #821) |

---

## Related Documentation

- **Prevention Guide:** `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`
- **Quick Reference:** `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
- **Issue #821:** `todos/archive/821-complete-p2-dead-postmessage-types.md`
