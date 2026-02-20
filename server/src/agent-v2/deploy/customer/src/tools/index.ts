/**
 * Customer Agent Tools Index
 *
 * Exports all tools organized by capability area:
 * - Booking tools (service discovery, availability, booking creation)
 * - Project tools (status, prep, timeline, requests)
 * - Calendar tools (Google Calendar availability)
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

// Booking tools (migrated from booking-agent)
export {
  getServicesTool,
  getServiceDetailsTool,
  checkAvailabilityTool,
  getBusinessInfoTool,
  answerFaqTool,
  recommendTierTool,
  createBookingTool,
} from './booking.js';

// Project tools (migrated from project-hub-agent customer view)
export {
  bootstrapCustomerSessionTool,
  getProjectStatusTool,
  getPrepChecklistTool,
  answerPrepQuestionTool,
  getTimelineTool,
  submitRequestTool,
} from './project.js';

// Calendar tools (Google Calendar integration)
export { getAvailableDatesTool } from './calendar.js';
