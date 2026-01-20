# Concierge Agent - Tool Calling Fix

**Date:** 2026-01-18
**Session:** Phase 4 Vertex AI Agent System - Continuation
**Status:** ✅ COMPLETE - All fixes deployed and verified
**Priority:** Gate 4 unblocked

---

## What Was Fixed

| Issue                                     | Fix                                      | Status      |
| ----------------------------------------- | ---------------------------------------- | ----------- |
| System prompt had copy-pasteable examples | Rewrote to tool-first with action arrows | ✅ Deployed |
| `callSpecialistAgent` used snake_case     | Changed to camelCase                     | ✅ Deployed |
| Prevention docs said snake_case           | Corrected to camelCase                   | ✅ Updated  |
| CLAUDE.md pitfalls outdated               | Updated pitfalls 32-39                   | ✅ Updated  |

---

## Verification (Successful)

```bash
# Before fix - just text, no tool call
{ "text": "On it. Check the preview →" }

# After fix - proper tool call!
{ "functionCall": { "name": "delegate_to_marketing", "args": { "task": "headline", "tone": "warm", "context": "homepage hero" }}}
```

---

## Next Steps for New Session

### Test End-to-End in Dashboard

1. Start servers:

   ```bash
   cd /Users/mikeyoung/CODING/MAIS
   npm run dev:all
   ```

2. Navigate to tenant dashboard with ConciergeChat

3. Send: "Write me better headlines"

4. **Expected behavior:**
   - Agent calls `delegate_to_marketing` tool
   - Marketing specialist generates headlines
   - Headlines appear in chat and preview panel

### If Marketing Specialist Fails

The Marketing agent may need similar fixes:

- Check `server/src/agent-v2/deploy/marketing/src/agent.ts`
- Verify it's deployed: `gcloud run services describe marketing-agent --region=us-central1`
- Check logs: `gcloud logging read 'resource.labels.service_name="marketing-agent"' --limit=20`

---

## Compound Knowledge Created

| Document                                                   | Purpose                           |
| ---------------------------------------------------------- | --------------------------------- |
| `docs/solutions/patterns/ADK_A2A_ORCHESTRATOR_COMPOUND.md` | Master reference for all 8 issues |
| `docs/solutions/patterns/ADK_QUICK_REFERENCE_CARD.md`      | Printable cheat sheet             |
| `docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md`      | Prevention strategies             |
| `CLAUDE.md` pitfalls 32-39                                 | Quick lookup                      |

---

## One-Liner for Context

**The Concierge agent now calls tools properly. Test end-to-end in dashboard - if Marketing specialist fails, check its deployment and logs.**
