/**
 * Intake Question Configuration
 *
 * Defines the ~10 onboarding intake questions shown in the chat-style form.
 * Shared between backend (validation) and frontend (rendering).
 *
 * Architecture:
 * - Each question has its own Zod validation schema (per-answer validation, not submit-time)
 * - Question IDs map directly to DISCOVERY_FACT_KEYS for storage
 * - Conditional branching via `next()` function (simple graph, not state machine)
 * - Questions are ordered but can branch based on prior answers
 */

import { z } from 'zod';
import { BusinessTypeSchema, TargetMarketSchema } from './onboarding.schema';

// ============================================================================
// Question Type Definitions
// ============================================================================

export type IntakeQuestionType = 'text' | 'textarea' | 'select' | 'url';

export interface IntakeQuestionOption {
  value: string;
  label: string;
}

export interface IntakeQuestion {
  /** Must match a DISCOVERY_FACT_KEY for storage */
  id: string;
  /** Input type rendered in the chat bubble */
  type: IntakeQuestionType;
  /** The question prompt shown to the user */
  prompt: string;
  /** Optional subtext below the prompt */
  subtext?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Options for select type */
  options?: IntakeQuestionOption[];
  /** Whether the question must be answered to complete intake */
  required: boolean;
  /** Zod schema for validating this question's answer */
  validation: z.ZodSchema;
  /** Returns the next question ID, or null if this is the last question */
  next: (answers: Record<string, unknown>) => string | null;
}

// ============================================================================
// Per-Question Validation Schemas
// ============================================================================

export const intakeValidationSchemas = {
  businessName: z.string().min(2, 'At least 2 characters').max(100, 'Max 100 characters'),

  businessType: BusinessTypeSchema,

  servicesOffered: z.string().min(5, 'Tell us a bit more').max(500, 'Max 500 characters'),

  targetMarket: TargetMarketSchema,

  location: z.string().min(2, 'At least 2 characters').max(200, 'Max 200 characters'),

  priceRange: z.enum(['under_500', '500_2000', '2000_5000', '5000_plus', 'varies']),

  yearsInBusiness: z.enum(['less_than_1', '1_3', '3_5', '5_10', '10_plus']),

  uniqueValue: z
    .string()
    .min(10, 'Tell us a bit more about what makes you stand out')
    .max(500, 'Max 500 characters'),

  websiteUrl: z
    .string()
    .url('Enter a valid URL (e.g. https://example.com)')
    .max(500, 'Max 500 characters')
    .or(z.literal('')),

  approach: z
    .string()
    .min(10, 'Tell us a bit more about your approach')
    .max(500, 'Max 500 characters'),
} as const;

export type IntakeQuestionId = keyof typeof intakeValidationSchemas;

// ============================================================================
// Question Configuration Array
// ============================================================================

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: 'businessName',
    type: 'text',
    prompt: "What's your business called?",
    placeholder: 'e.g. Sarah Chen Photography',
    required: true,
    validation: intakeValidationSchemas.businessName,
    next: () => 'businessType',
  },
  {
    id: 'businessType',
    type: 'select',
    prompt: 'What type of work do you do?',
    options: [
      { value: 'photographer', label: 'Photography' },
      { value: 'videographer', label: 'Videography' },
      { value: 'wedding_planner', label: 'Wedding Planning' },
      { value: 'florist', label: 'Floral Design' },
      { value: 'caterer', label: 'Catering' },
      { value: 'dj', label: 'DJ / Music' },
      { value: 'officiant', label: 'Officiant' },
      { value: 'makeup_artist', label: 'Makeup Artist' },
      { value: 'hair_stylist', label: 'Hair Stylist' },
      { value: 'event_designer', label: 'Event Design' },
      { value: 'venue', label: 'Venue' },
      { value: 'coach', label: 'Coaching' },
      { value: 'therapist', label: 'Therapy / Counseling' },
      { value: 'consultant', label: 'Consulting' },
      { value: 'wellness_practitioner', label: 'Wellness / Holistic' },
      { value: 'personal_trainer', label: 'Personal Training' },
      { value: 'tutor', label: 'Tutoring' },
      { value: 'music_instructor', label: 'Music Instruction' },
      { value: 'other', label: 'Something else' },
    ],
    required: true,
    validation: intakeValidationSchemas.businessType,
    next: () => 'servicesOffered',
  },
  {
    id: 'servicesOffered',
    type: 'textarea',
    prompt: 'What services do you offer?',
    subtext: 'List your main packages or service types.',
    placeholder: 'e.g. Wedding coverage, engagement sessions, elopements...',
    required: true,
    validation: intakeValidationSchemas.servicesOffered,
    next: () => 'targetMarket',
  },
  {
    id: 'targetMarket',
    type: 'select',
    prompt: 'Who do you typically work with?',
    subtext: 'This helps us set the right tone for your site.',
    options: [
      { value: 'luxury', label: 'High-end / Luxury' },
      { value: 'premium', label: 'Premium' },
      { value: 'mid_range', label: 'Mid-range' },
      { value: 'budget_friendly', label: 'Budget-friendly' },
      { value: 'mixed', label: 'Mixed — all price points' },
    ],
    required: true,
    validation: intakeValidationSchemas.targetMarket,
    next: () => 'location',
  },
  {
    id: 'location',
    type: 'text',
    prompt: 'Where are you based?',
    placeholder: 'e.g. Austin, TX',
    required: true,
    validation: intakeValidationSchemas.location,
    next: () => 'priceRange',
  },
  {
    id: 'priceRange',
    type: 'select',
    prompt: "What's your typical starting price?",
    options: [
      { value: 'under_500', label: 'Under $500' },
      { value: '500_2000', label: '$500 – $2,000' },
      { value: '2000_5000', label: '$2,000 – $5,000' },
      { value: '5000_plus', label: '$5,000+' },
      { value: 'varies', label: 'Varies by project' },
    ],
    required: true,
    validation: intakeValidationSchemas.priceRange,
    next: () => 'yearsInBusiness',
  },
  {
    id: 'yearsInBusiness',
    type: 'select',
    prompt: 'How long have you been doing this?',
    options: [
      { value: 'less_than_1', label: 'Less than a year' },
      { value: '1_3', label: '1–3 years' },
      { value: '3_5', label: '3–5 years' },
      { value: '5_10', label: '5–10 years' },
      { value: '10_plus', label: '10+ years' },
    ],
    required: true,
    validation: intakeValidationSchemas.yearsInBusiness,
    next: () => 'uniqueValue',
  },
  {
    id: 'uniqueValue',
    type: 'textarea',
    prompt: 'What sets you apart from others in your space?',
    subtext: "Your clients' words work best here.",
    placeholder: 'e.g. I specialize in intimate elopements with a documentary style...',
    required: true,
    validation: intakeValidationSchemas.uniqueValue,
    next: () => 'approach',
  },
  {
    id: 'approach',
    type: 'textarea',
    prompt: 'How would you describe your approach to working with clients?',
    placeholder: 'e.g. Relaxed and collaborative — I want clients to feel at ease...',
    required: true,
    validation: intakeValidationSchemas.approach,
    next: () => 'websiteUrl',
  },
  {
    id: 'websiteUrl',
    type: 'url',
    prompt: 'Do you have a current website?',
    subtext: "We'll pull inspiration from it. Skip if you don't have one yet.",
    placeholder: 'https://yoursite.com',
    required: false,
    validation: intakeValidationSchemas.websiteUrl,
    next: () => null, // Terminal question
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/** Get question by ID */
export function getIntakeQuestion(id: string): IntakeQuestion | undefined {
  return INTAKE_QUESTIONS.find((q) => q.id === id);
}

/** Get the first question in the sequence */
export function getFirstQuestionId(): string {
  return INTAKE_QUESTIONS[0]!.id;
}

/** Get all required question IDs */
export function getRequiredQuestionIds(): string[] {
  return INTAKE_QUESTIONS.filter((q) => q.required).map((q) => q.id);
}

/** Get the next question ID given current answers */
export function getNextQuestionId(
  currentQuestionId: string,
  answers: Record<string, unknown>
): string | null {
  const question = getIntakeQuestion(currentQuestionId);
  if (!question) return null;
  return question.next(answers);
}

/** Total number of questions (for progress display) */
export const TOTAL_INTAKE_QUESTIONS = INTAKE_QUESTIONS.length;

// ============================================================================
// API Request/Response Schemas
// ============================================================================

/** Request body for POST /intake/answer */
export const IntakeAnswerRequestSchema = z.object({
  questionId: z.string().min(1),
  answer: z.union([z.string(), z.array(z.string())]),
});

export type IntakeAnswerRequest = z.infer<typeof IntakeAnswerRequestSchema>;

/** Response for POST /intake/answer */
export const IntakeAnswerResponseSchema = z.object({
  stored: z.literal(true),
  questionId: z.string(),
  nextQuestionId: z.string().nullable(),
  answeredCount: z.number().int(),
  totalQuestions: z.number().int(),
});

export type IntakeAnswerResponse = z.infer<typeof IntakeAnswerResponseSchema>;

/** Response for GET /intake/progress */
export const IntakeProgressResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  answeredQuestionIds: z.array(z.string()),
  nextQuestionId: z.string().nullable(),
  totalQuestions: z.number().int(),
  completedCount: z.number().int(),
  canComplete: z.boolean(),
});

export type IntakeProgressResponse = z.infer<typeof IntakeProgressResponseSchema>;

/** Response for POST /intake/complete */
export const IntakeCompleteResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('advanced_to_building'),
    redirectTo: z.string(),
  }),
  z.object({
    status: z.literal('missing_required'),
    missingQuestions: z.array(z.string()),
  }),
  z.object({
    status: z.literal('already_completed'),
    currentStatus: z.string(),
  }),
]);

export type IntakeCompleteResponse = z.infer<typeof IntakeCompleteResponseSchema>;
