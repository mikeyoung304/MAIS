---
status: resolved
priority: p2
issue_id: '262'
tags: [code-review, security, validation, tenant-dashboard]
dependencies: []
resolved_at: '2025-12-23'
resolved_by: 'client already had validation, added backend 50KB limit validation'
---

# Missing File Upload Size Validation

## Problem Statement

CalendarConfigCard accepts JSON file uploads without size validation. A malicious actor could upload a multi-MB JSON file causing client-side DoS or memory exhaustion.

**Why it matters:**

- Client-side DoS potential
- Memory exhaustion from parsing large JSON
- Wasted bandwidth on invalid uploads

## Findings

### Agent: security-sentinel

- **Location:** CalendarConfigCard.tsx:129-149
- **Evidence:** `reader.readAsText(file)` with no size check
- **Impact:** IMPORTANT - Client-side DoS prevention

### Agent: security-sentinel (backend)

- **Location:** tenant-admin-calendar.routes.ts:102-112
- **Evidence:** Backend also lacks JSON size validation
- **Impact:** IMPORTANT - Backend DoS, database bloat

## Proposed Solutions

### Option A: Add Client + Backend Validation (Recommended)

**Description:** Validate file size on both client and server

**Client (CalendarConfigCard.tsx):**

```typescript
const MAX_FILE_SIZE = 50 * 1024; // 50KB
if (file.size > MAX_FILE_SIZE) {
  setConfigErrors((prev) => ({
    ...prev,
    serviceAccountJson: 'File too large. Maximum size is 50KB.',
  }));
  return;
}
```

**Backend (tenant-admin-calendar.routes.ts):**

```typescript
const MAX_JSON_SIZE = 50 * 1024;
if (serviceAccountJson.length > MAX_JSON_SIZE) {
  res.status(400).json({ error: 'Service account JSON too large' });
  return;
}
```

**Pros:**

- Defense in depth
- Better UX (early validation)
- Prevents backend abuse

**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

**Choose Option A** - Add validation on both client and server.

## Technical Details

### Affected Files

- `client/src/features/tenant-admin/TenantDashboard/CalendarConfigCard.tsx`
- `server/src/routes/tenant-admin-calendar.routes.ts`

## Acceptance Criteria

- [ ] Client validates file size before reading (50KB limit)
- [ ] Backend validates JSON string length (50KB limit)
- [ ] User-friendly error messages displayed
- [ ] Valid service account JSON still works (~2KB typical)

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2025-12-05 | Created from code review | Google service account JSON is typically ~2KB |

## Resources

- **Google Service Account Format:** https://cloud.google.com/iam/docs/keys-list-get
