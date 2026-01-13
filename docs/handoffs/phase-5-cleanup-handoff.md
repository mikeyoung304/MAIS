# Vertex AI Migration - Phase 5 Cleanup Handoff

## Context

Branch: `migrate-to-google`
Latest Commit: `34859a34` (docs update for Vertex AI environment)

Phase 4 is complete:

- ✅ All automated tests pass (TypeScript, unit, integration, E2E)
- ✅ Manual smoke tests pass (customer chatbot + tenant dashboard agent)
- ✅ Both orchestrators work with Gemini tool calling
- ✅ CLAUDE.md updated with new environment variables

## Phase 5 Objective

Remove all Anthropic artifacts and update remaining documentation for a clean codebase.

## Tasks

### 1. Remove Anthropic SDK

```bash
npm uninstall @anthropic-ai/sdk
```

### 2. Search and Remove Remaining Anthropic References

```bash
# Find all remaining references (expect mostly docs/plans/todos)
grep -r "anthropic" server/src/ --include="*.ts"
grep -r "ANTHROPIC" server/src/ --include="*.ts"
grep -r "claude" server/src/ --include="*.ts" | grep -v "CLAUDE.md"

# Check test helpers
ls server/test/helpers/ | grep -i anthropic
```

**Expected removals:**

- `server/test/helpers/mock-anthropic.ts` (if exists)
- Any remaining import statements
- Any commented-out Anthropic code

### 3. Update render.yaml

Remove ANTHROPIC_API_KEY references from deployment config:

```bash
grep -n "ANTHROPIC" render.yaml
```

### 4. Update Other Documentation

Check these files for Anthropic references:

- `docs/solutions/` - Solution docs may reference old setup
- `plans/` - Old migration plans (can leave as historical record)

### 5. Final Verification

```bash
# Ensure no runtime Anthropic dependencies
npm run typecheck
npm test

# Verify no accidental imports
grep -r "from '@anthropic" server/src/
grep -r "from \"@anthropic" server/src/
```

## Files Changed in Phase 4

| File                                               | Change                                    |
| -------------------------------------------------- | ----------------------------------------- |
| `server/src/routes/public-customer-chat.routes.ts` | ANTHROPIC_API_KEY → GOOGLE_VERTEX_PROJECT |
| `server/src/routes/agent.routes.ts`                | ANTHROPIC_API_KEY → GOOGLE_VERTEX_PROJECT |
| `server/src/di.ts`                                 | ANTHROPIC_API_KEY → GOOGLE_VERTEX_PROJECT |
| `CLAUDE.md`                                        | Updated environment section               |
| `plans/VERTEX-AI-IMPLEMENTATION-PLAN.md`           | Phase 4 marked complete                   |

## Commit Convention

```
chore: remove Anthropic SDK and references (Phase 5 cleanup)

- Uninstall @anthropic-ai/sdk from package.json
- Remove mock-anthropic.ts test helper
- Update render.yaml environment variables
- Clean up any remaining references

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Success Criteria

- [ ] `@anthropic-ai/sdk` removed from package.json
- [ ] No Anthropic imports in server/src/
- [ ] render.yaml updated
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes (spot check)
