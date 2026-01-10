---
status: pending
priority: p3
issue_id: '706'
tags: [code-review, documentation, naming, tech-debt]
dependencies: ['697', '704']
---

# Inconsistent Field Naming for Landing Page Config

## Problem Statement

The codebase uses inconsistent terminology for landing page configuration:

| Term                     | Used In            | Meaning                                          |
| ------------------------ | ------------------ | ------------------------------------------------ |
| `draft`                  | repository wrapper | Unpublished changes in `landingPageConfig.draft` |
| `landingPageConfigDraft` | Prisma schema      | Separate column for AI tool edits                |
| `published`              | repository wrapper | Live content in `landingPageConfig.published`    |
| `landingPageConfig`      | executor publish   | Direct write of entire config                    |
| `live`                   | AI tool responses  | What AI thinks is live                           |

## Findings

This confusion contributes to bugs like #697 where different systems use different interpretations.

## Proposed Solution

After consolidating on single system (#697, #704):

1. Document canonical field meanings in CLAUDE.md
2. Update code comments to use consistent terminology
3. Update Prisma schema comments

## Acceptance Criteria

- [ ] CLAUDE.md has "Landing Page Config Terminology" section
- [ ] All code comments use consistent terms
- [ ] Schema comments match actual behavior

## Resources

- Architecture review: agent a31637a
- Depends on: #697, #704 (consolidation first)
