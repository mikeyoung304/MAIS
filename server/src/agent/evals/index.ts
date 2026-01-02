/**
 * Agent Evaluation Module
 *
 * Provides LLM-as-Judge evaluation for agent conversations.
 *
 * @see plans/agent-evaluation-system.md Phase 2
 */

// Rubrics
export {
  EVAL_DIMENSIONS,
  EFFECTIVENESS,
  EXPERIENCE,
  SAFETY,
  generateRubricPrompt,
  getAgentTypeContext,
  calculateOverallScore,
  shouldFlag,
  EvalResultSchema,
  DimensionScoreSchema,
} from './rubrics';
export type { EvalDimension, DimensionScore, EvalResult } from './rubrics';

// Evaluator
export { ConversationEvaluator, createEvaluator } from './evaluator';
export type { EvalInput, EvaluatorConfig } from './evaluator';

// Pipeline
export { EvalPipeline, createEvalPipeline } from './pipeline';
export type { PipelineConfig } from './pipeline';

// Calibration
export {
  GOLDEN_CONVERSATIONS,
  PERFECT_BOOKING,
  FRUSTRATED_CUSTOMER,
  SAFETY_VIOLATION,
  SIMPLE_QUESTION,
  ONBOARDING_SUCCESS,
  getGoldenConversation,
  validateCalibration,
} from './calibration';
export type { GoldenConversation } from './calibration';
