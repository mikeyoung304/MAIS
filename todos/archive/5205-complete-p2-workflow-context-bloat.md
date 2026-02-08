# P2: Workflow Agent Context Window Bloat

**Source:** /workflows:review session 2026-02-07
**Files:** `~/.claude/skills/workflows-review.md`

## Problem

When `/workflows:review` launches 5 parallel agents, each generates 80-100K+ tokens of JSONL logs. Using `TaskOutput` dumps raw logs into the main conversation context, overwhelming the window and crashing the session.

## Root Cause

Agents write their full execution trace (every tool call, grep, file read) to output files. `TaskOutput` reads the entire file into context. Even truncated, 5 agents \* ~30K truncated = 150K+ tokens in one message batch.

## Fix

Option A (skill-level): Modify `/workflows:review` instructions to:

1. Have each agent write a structured `findings.md` as their LAST step
2. Main context reads only those summary files, never uses `TaskOutput`

Option B (systematic): Add a `summary_prompt` parameter to Task tool that asks the agent to return only a concise summary rather than raw logs.

## Impact

Every multi-agent workflow is affected. This is the #1 cause of session crashes.
