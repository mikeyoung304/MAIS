# Quality Skills: When to Use What

> **Purpose**: Simple rules for skill usage during quality remediation
> **Companion To**: `plans/MAIS-quality-remediation-plan.md`

## Default Rule

Just do the work. Only invoke skills when they add clear value.

## When to Use Skills

| Situation | Skill | Why |
|-----------|-------|-----|
| Refactoring >200 lines | `/workflows:plan` | Prevents architectural drift |
| Complex PR to main | `/workflows:review` | Multi-agent catches blind spots |
| Touching tenant queries | `/check` | Security-critical isolation |
| Solved a hard bug | `/workflows:codify` | Prevent re-solving same problem |

## Phase 0 Specifics

- **P0-1 (BookingService)**: Use `/workflows:plan` first - this is the biggest refactor
- **P0-3 (Tenant Isolation)**: Use `/check` - multi-tenant security is critical

## That's It

Don't overthink it. If you're wondering whether to use a skill, probably just do the work directly.

---

## Quick Checklist

Before starting major work:
- [ ] Write down what you're going to do (30 min max)
- [ ] Get a quick sanity check from a teammate

After completing major work:
- [ ] Review your own PR before requesting review
- [ ] Document anything surprising for future reference

---

*The actual quality work is in `plans/MAIS-quality-remediation-plan.md`. This is just guidance on when AI assistance adds value.*
