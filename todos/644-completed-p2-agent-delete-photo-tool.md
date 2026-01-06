---
status: completed
priority: p2
issue_id: '644'
tags: [code-review, agent-native, action-parity, tools]
dependencies: []
---

# Missing delete_package_photo Agent Tool

## Problem Statement

The UI can delete photos from packages via `DELETE /v1/tenant-admin/packages/:id/photos/:filename`, but there's no corresponding agent tool. The agent can request uploads but cannot delete photos.

## Findings

**Source:** Agent-Native Reviewer analysis of Legacy-to-Next.js Migration

**UI Capability:**

- Upload photos (multipart form)
- Delete individual photos by filename
- Reorder photos (implicit via order in array)

**Agent Capability:**

- `request_file_upload` provides upload instructions (but doesn't perform upload)
- No delete_package_photo tool exists
- No reorder_package_photos tool exists

## Proposed Solutions

### Option A: Add delete_package_photo write tool (Recommended)

**Pros:** Action parity with UI
**Cons:** New tool + executor to maintain
**Effort:** Medium
**Risk:** Low

```typescript
// In server/src/agent/tools/write-tools.ts
{
  name: 'delete_package_photo',
  description: 'Delete a photo from a package',
  inputSchema: z.object({
    packageId: z.string(),
    filename: z.string(),
  }),
  trustLevel: 'T2', // Soft confirm
  execute: async (input, context) => {
    // Create proposal for deletion
    return createProposal('delete_package_photo', input, context);
  },
}
```

### Option B: Accept UI-only for visual tasks

**Pros:** No new code
**Cons:** Breaks agent-native parity principle
**Effort:** None
**Risk:** Low - but creates inconsistency

## Recommended Action

Option A - Add delete_package_photo tool for action parity.

## Technical Details

### Files to Modify

- `server/src/agent/tools/write-tools.ts` - Add new tool
- `server/src/agent/executors/index.ts` - Add executor
- `server/src/agent/proposals/executor-registry.ts` - Add to REQUIRED_EXECUTOR_TOOLS

### Trust Level

T2 (soft confirm) - Deletion is reversible via re-upload.

## Acceptance Criteria

- [x] `delete_package_photo` tool exists in write-tools.ts
- [x] Tool validates package ownership (tenantId)
- [x] Executor is registered in executor-registry.ts
- [x] Agent can delete photos from packages

## Work Log

| Date       | Action                   | Learnings                                                                   |
| ---------- | ------------------------ | --------------------------------------------------------------------------- |
| 2026-01-05 | Created from code review | Add to REQUIRED_EXECUTOR_TOOLS                                              |
| 2026-01-05 | Completed implementation | T2 tool with executor, verifies tenant ownership, deletes file from storage |

## Resources

- Pattern: `server/src/agent/tools/write-tools.ts`
- UI endpoint: `server/src/routes/tenant-admin.routes.ts` (DELETE /packages/:id/photos/:filename)
- Prevention doc: `docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md`
