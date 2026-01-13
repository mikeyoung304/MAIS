/**
 * Unit Tests for Gemini Error Classification
 *
 * Tests error classification logic to ensure correct handling
 * strategies are applied to different Vertex AI error types.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyGeminiError,
  GeminiErrorType,
  requiresAlert,
  isTemporaryFailure,
  needsUserAction,
} from '../../src/llm/errors';

describe('Gemini Error Classification', () => {
  describe('classifyGeminiError', () => {
    describe('RATE_LIMITED', () => {
      it('should classify 429 status code as rate limited', () => {
        const error = { status: 429, message: 'Too many requests' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.RATE_LIMITED);
        expect(result.isRetryable).toBe(true);
        expect(result.retryAfterMs).toBe(60000);
      });

      it('should classify RESOURCE_EXHAUSTED as rate limited', () => {
        const error = new Error('RESOURCE_EXHAUSTED: Quota exceeded');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.RATE_LIMITED);
        expect(result.isRetryable).toBe(true);
      });

      it('should classify "rate limit" message as rate limited', () => {
        const error = new Error('Rate limit reached, please retry');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.RATE_LIMITED);
        expect(result.isRetryable).toBe(true);
      });

      it('should have user-friendly message for rate limiting', () => {
        const error = { status: 429 };
        const result = classifyGeminiError(error);

        expect(result.userMessage).toBe(
          'Our AI assistant is temporarily busy. Please try again in a moment.'
        );
      });
    });

    describe('QUOTA_EXCEEDED', () => {
      it('should classify billing errors as quota exceeded', () => {
        const error = new Error('Billing account not configured');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.QUOTA_EXCEEDED);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify quota errors as quota exceeded', () => {
        const error = new Error('Daily quota limit exceeded');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.QUOTA_EXCEEDED);
        expect(result.isRetryable).toBe(false);
      });

      it('should not be retryable', () => {
        const error = new Error('Budget limit exceeded');
        const result = classifyGeminiError(error);

        expect(result.isRetryable).toBe(false);
      });
    });

    describe('CONTENT_BLOCKED', () => {
      it('should classify safety filter blocks as content blocked', () => {
        const error = new Error('Content blocked by safety filter');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.CONTENT_BLOCKED);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify harm detection as content blocked', () => {
        const error = new Error('Harmful content detected');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.CONTENT_BLOCKED);
      });

      it('should have helpful user message', () => {
        const error = new Error('Safety: blocked');
        const result = classifyGeminiError(error);

        expect(result.userMessage).toBe(
          "I can't help with that request. Please rephrase your question."
        );
      });
    });

    describe('CONTEXT_TOO_LONG', () => {
      it('should classify token limit errors', () => {
        const error = new Error('Token limit exceeded');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.CONTEXT_TOO_LONG);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify context too long errors', () => {
        const error = new Error('Input context too long');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.CONTEXT_TOO_LONG);
      });

      it('should classify max_tokens errors', () => {
        const error = new Error('max_tokens exceeded');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.CONTEXT_TOO_LONG);
      });
    });

    describe('SERVICE_UNAVAILABLE', () => {
      it('should classify 503 as service unavailable', () => {
        const error = { status: 503, message: 'Service unavailable' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.SERVICE_UNAVAILABLE);
        expect(result.isRetryable).toBe(true);
        expect(result.retryAfterMs).toBe(5000);
      });

      it('should classify 502 as service unavailable', () => {
        const error = { status: 502, message: 'Bad gateway' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.SERVICE_UNAVAILABLE);
        expect(result.isRetryable).toBe(true);
      });

      it('should classify timeout errors', () => {
        const error = new Error('Request timeout');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.SERVICE_UNAVAILABLE);
        expect(result.isRetryable).toBe(true);
      });

      it('should classify deadline exceeded errors', () => {
        const error = new Error('Deadline exceeded');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.SERVICE_UNAVAILABLE);
      });
    });

    describe('AUTHENTICATION_ERROR', () => {
      it('should classify 401 as auth error', () => {
        const error = { status: 401, message: 'Unauthorized' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.AUTHENTICATION_ERROR);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify 403 as auth error', () => {
        const error = { status: 403, message: 'Forbidden' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.AUTHENTICATION_ERROR);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify credentials errors', () => {
        const error = new Error('Invalid credentials');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.AUTHENTICATION_ERROR);
      });

      it('should classify permission errors', () => {
        const error = new Error('Permission denied');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.AUTHENTICATION_ERROR);
      });
    });

    describe('MODEL_NOT_FOUND', () => {
      it('should classify 404 with model message', () => {
        const error = { status: 404, message: 'Model not found' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.MODEL_NOT_FOUND);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify unknown model errors', () => {
        const error = new Error('Unknown model: gemini-99');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.MODEL_NOT_FOUND);
      });
    });

    describe('INVALID_REQUEST', () => {
      it('should classify 400 as invalid request', () => {
        const error = { status: 400, message: 'Bad request' };
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.INVALID_REQUEST);
        expect(result.isRetryable).toBe(false);
      });

      it('should classify INVALID_ARGUMENT errors', () => {
        const error = new Error('INVALID_ARGUMENT: Missing field');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.INVALID_REQUEST);
      });

      it('should classify malformed request errors', () => {
        const error = new Error('Malformed request body');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.INVALID_REQUEST);
      });
    });

    describe('UNKNOWN', () => {
      it('should classify unrecognized errors as unknown', () => {
        const error = new Error('Something completely unexpected');
        const result = classifyGeminiError(error);

        expect(result.type).toBe(GeminiErrorType.UNKNOWN);
        expect(result.isRetryable).toBe(false);
      });

      it('should preserve original error', () => {
        const originalError = new Error('Mystery error');
        const result = classifyGeminiError(originalError);

        expect(result.originalError).toBe(originalError);
      });
    });

    describe('retry-after extraction', () => {
      it('should use API-provided retry-after hint', () => {
        const error = {
          status: 429,
          message: 'Rate limited',
          headers: { 'retry-after': '30' },
        };
        const result = classifyGeminiError(error);

        expect(result.retryAfterMs).toBe(30000); // 30s in ms
      });

      it('should use retryDelay from error body', () => {
        const error = {
          status: 429,
          message: 'Rate limited',
          retryDelay: 45,
        };
        const result = classifyGeminiError(error);

        expect(result.retryAfterMs).toBe(45000);
      });
    });

    describe('status code extraction', () => {
      it('should extract direct status', () => {
        const error = { status: 500, message: 'Server error' };
        const result = classifyGeminiError(error);

        expect(result.statusCode).toBe(500);
      });

      it('should extract code property', () => {
        const error = { code: 503, message: 'Unavailable' };
        const result = classifyGeminiError(error);

        expect(result.statusCode).toBe(503);
      });

      it('should extract nested response.status', () => {
        const error = { response: { status: 429 }, message: 'Rate limited' };
        const result = classifyGeminiError(error);

        expect(result.statusCode).toBe(429);
      });
    });
  });

  describe('helper functions', () => {
    describe('requiresAlert', () => {
      it('should return true for quota exceeded', () => {
        expect(requiresAlert(GeminiErrorType.QUOTA_EXCEEDED)).toBe(true);
      });

      it('should return true for auth errors', () => {
        expect(requiresAlert(GeminiErrorType.AUTHENTICATION_ERROR)).toBe(true);
      });

      it('should return true for model not found', () => {
        expect(requiresAlert(GeminiErrorType.MODEL_NOT_FOUND)).toBe(true);
      });

      it('should return false for rate limiting', () => {
        expect(requiresAlert(GeminiErrorType.RATE_LIMITED)).toBe(false);
      });

      it('should return false for temporary failures', () => {
        expect(requiresAlert(GeminiErrorType.SERVICE_UNAVAILABLE)).toBe(false);
      });
    });

    describe('isTemporaryFailure', () => {
      it('should return true for rate limiting', () => {
        expect(isTemporaryFailure(GeminiErrorType.RATE_LIMITED)).toBe(true);
      });

      it('should return true for service unavailable', () => {
        expect(isTemporaryFailure(GeminiErrorType.SERVICE_UNAVAILABLE)).toBe(true);
      });

      it('should return false for content blocked', () => {
        expect(isTemporaryFailure(GeminiErrorType.CONTENT_BLOCKED)).toBe(false);
      });

      it('should return false for auth errors', () => {
        expect(isTemporaryFailure(GeminiErrorType.AUTHENTICATION_ERROR)).toBe(false);
      });
    });

    describe('needsUserAction', () => {
      it('should return true for content blocked', () => {
        expect(needsUserAction(GeminiErrorType.CONTENT_BLOCKED)).toBe(true);
      });

      it('should return true for context too long', () => {
        expect(needsUserAction(GeminiErrorType.CONTEXT_TOO_LONG)).toBe(true);
      });

      it('should return false for rate limiting', () => {
        expect(needsUserAction(GeminiErrorType.RATE_LIMITED)).toBe(false);
      });

      it('should return false for service unavailable', () => {
        expect(needsUserAction(GeminiErrorType.SERVICE_UNAVAILABLE)).toBe(false);
      });
    });
  });
});
