---
status: deferred
priority: p2
issue_id: "527"
tags: [code-review, agent-ecosystem, security]
dependencies: []
---

# Prompt Injection Detection Only in CustomerChatOrchestrator

## Problem Statement

Prompt injection detection is only implemented in `CustomerChatOrchestrator`, not in `AdminOrchestrator` or `OnboardingOrchestrator`. Authenticated users could potentially inject prompts.

## Findings

**Security Sentinel:**
> "Only `CustomerChatOrchestrator` has prompt injection detection. Admin and Onboarding orchestrators do not."

**Recommendation:** Add prompt injection detection to `BaseOrchestrator.chat()` method so all orchestrators inherit it.

## Proposed Solutions

### Option A: Move to BaseOrchestrator
Move `detectPromptInjection()` to base class with configurable severity per agent type.

### Option B: Keep Separate with Documentation
Document that admin/onboarding users are trusted.

## Acceptance Criteria

- [ ] Injection detection strategy documented or implemented for all orchestrators
- [ ] Tests pass
