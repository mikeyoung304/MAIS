# AvailabilityRulesManager Component

## Overview

The AvailabilityRulesManager allows tenant admins to define when their services are available by creating weekly schedule rules.

## Features

- Create availability rules for specific days and times
- Apply rules to all services or specific services
- Visual weekly schedule grouped by day of week
- Color-coded day badges
- Delete rules with confirmation dialog
- Support for effective date ranges

## API Endpoints

- **GET** `/v1/tenant-admin/availability-rules` - List all rules (with optional serviceId filter)
- **POST** `/v1/tenant-admin/availability-rules` - Create new rule
- **DELETE** `/v1/tenant-admin/availability-rules/:id` - Delete rule

## Component Structure

```
AvailabilityRulesManager/
├── index.tsx                      # Main orchestrator component
├── types.ts                       # TypeScript type definitions
├── utils.ts                       # Utility functions (time formatting, etc.)
├── useAvailabilityRulesManager.ts # State management hook
├── CreateRuleButton.tsx           # Button to open rule creation form
├── RuleForm.tsx                   # Form for creating new rules
├── RulesList.tsx                  # Weekly schedule display
├── DeleteConfirmationDialog.tsx   # Confirmation dialog
└── SuccessMessage.tsx             # Success notification

```

## Usage

```tsx
import { AvailabilityRulesManager } from '@/features/tenant-admin/scheduling/AvailabilityRulesManager';

function SchedulePage() {
  return <AvailabilityRulesManager />;
}
```

## Rule Fields

### Required Fields

- **dayOfWeek** (0-6): Day of week (0=Sunday, 6=Saturday)
- **startTime** (HH:MM): Start time in 24-hour format (e.g., "09:00")
- **endTime** (HH:MM): End time in 24-hour format (e.g., "17:00")

### Optional Fields

- **serviceId**: Specific service ID (null = applies to all services)
- **effectiveFrom**: Start date for rule (defaults to today)
- **effectiveTo**: End date for rule (null = indefinite)

## Time Format

All times are stored in 24-hour format (HH:MM) but displayed in 12-hour format with AM/PM.

## Examples

### Create a rule for all services

- Service: "All Services"
- Day: Monday
- Time: 9:00 AM - 5:00 PM
- Effective: Today onwards

### Create a rule for specific service

- Service: "Strategy Session"
- Day: Friday
- Time: 1:00 PM - 4:00 PM
- Effective: 2025-01-01 to 2025-12-31

## Design Patterns

### Following MAIS Conventions

- Multi-tenant data isolation (all API calls scoped by tenantId)
- ts-rest API client for type-safe API calls
- Component composition pattern (similar to BlackoutsManager, ServicesManager)
- Radix UI for accessible components
- TailwindCSS for styling with macon-navy theme

### Architecture Layers

1. **index.tsx**: Orchestrates components, fetches data
2. **useAvailabilityRulesManager.ts**: Manages state and API calls
3. **UI Components**: Presentational components
4. **utils.ts**: Pure utility functions

## Styling

Uses the MAIS design system:

- Dark theme: `bg-macon-navy-800`, `border-white/20`
- Day colors: Color-coded badges for visual distinction
- Responsive grid: 1/2/3 columns based on screen size

## Accessibility

- ARIA labels on delete buttons
- Form labels properly associated
- Alert dialogs for destructive actions
- Keyboard navigation support via Radix UI
