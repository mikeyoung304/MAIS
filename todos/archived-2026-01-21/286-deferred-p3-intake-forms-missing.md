---
status: complete
priority: p3
issue_id: '286'
tags: [deferred, code-review, feature-gap, intake-forms, custom-fields, acuity-parity]
dependencies: []
next_review: '2026-01-23'
revisit_trigger: '3 customer requests'
---

# Custom Intake Forms Not Implemented (Acuity Parity)

## Problem Statement

Acuity supports custom intake forms/questionnaires that clients fill during booking. MAIS only collects basic contact info. Service providers need custom questions for their specific needs.

**Why it matters:**

- Therapists need health history before first session
- Photographers need event details (location, style)
- Consultants need project scope information
- Reduces back-and-forth before appointment

## Findings

### Agent: architecture-strategist

- **Location:** Booking model in `schema.prisma`
- **Evidence:** Only `notes` field exists, no structured custom fields
- **Acuity Features:**
  - Custom text fields
  - Dropdown selections
  - Checkboxes
  - File uploads
  - Per-service form configuration

## Proposed Solutions

### Option A: JSON-Based Custom Fields (Recommended for MVP)

**Description:** Store form schema and responses in JSON columns

**Schema:**

```prisma
model Service {
  // Existing fields...
  intakeFormSchema Json? // Form builder schema
}

model Booking {
  // Existing fields...
  intakeFormData Json? // Customer responses
}
```

**Form Schema Structure:**

```json
{
  "fields": [
    {
      "id": "health_conditions",
      "type": "text",
      "label": "Any health conditions we should know about?",
      "required": true
    },
    {
      "id": "session_goals",
      "type": "textarea",
      "label": "What are your goals for this session?"
    },
    {
      "id": "heard_about_us",
      "type": "select",
      "label": "How did you hear about us?",
      "options": ["Google", "Friend", "Social Media", "Other"]
    }
  ]
}
```

**Effort:** Medium (3-5 days)
**Risk:** Low

### Option B: Normalized Form Fields Table

**Description:** Separate tables for form definitions and responses

**Effort:** Large (1 week)
**Risk:** Low (more scalable)

## Recommended Action

Defer to Phase 3. Implement Option A for MVP, migrate to Option B if needed.

## Acceptance Criteria

- [ ] Form schema storage on Service model
- [ ] Form builder UI for tenant admin
- [ ] Form rendering on booking page
- [ ] Response validation
- [ ] View responses in admin dashboard
- [ ] Include in confirmation emails

## Work Log

| Date       | Action                         | Learnings        |
| ---------- | ------------------------------ | ---------------- |
| 2025-12-05 | Created from Acuity comparison | Defer to Phase 3 |

## Resources

- [Acuity Intake Forms](https://help.acuityscheduling.com/hc/en-us/articles/16676922487949)
- [React Hook Form](https://react-hook-form.com/) for form handling
