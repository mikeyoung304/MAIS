---
status: pending
priority: p3
issue_id: '11104'
tags: [code-review, agent-ai]
pr: 68
---

# F-040: Prompt example responses risk LLM verbatim parroting (Pitfall #9)

## Problem Statement

The tenant-agent system prompt includes example responses formatted as quoted dialogue (e.g., `You: "On it!"`). Per Pitfall #9, LLMs tend to copy example responses verbatim, resulting in robotic-sounding interactions. This is especially problematic for the onboarding flow where the agent should sound natural and adaptive to each tenant's context.

## Location

`server/src/agent-v2/deploy/tenant/src/prompts/system.ts:40,85,100`

## Proposed Solution

1. Replace quoted example responses with action descriptions: `You: "On it!"` becomes `-> Call update_section() with the requested changes`.
2. Use the format from Pitfall #9 documentation: describe what the agent should DO, not what it should SAY.
3. If tone guidance is needed, use a "Voice" section with principles (e.g., "be concise, use lowercase confirmations like 'got it' or 'done'") rather than scripted examples.
4. Audit all prompt files for similar patterns.

## Effort

Small — ~1 hour. Find-and-replace example quotes with action descriptions across prompt files.
