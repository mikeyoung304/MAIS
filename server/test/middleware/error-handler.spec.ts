/**
 * Error handler middleware unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/error-handler';
import {
  DomainError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  UnprocessableEntityError,
} from '../../src/lib/errors';
import { BookingConflictError } from '../../src/lib/errors';

describe('Error Handler Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    // Mock Express request/response
    req = {
      get: vi.fn().mockReturnValue('test-user-agent'),
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      locals: {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
        },
      },
    };

    next = vi.fn();
  });

  describe('Domain Error Mapping', () => {
    it('should map NotFoundError to 404', () => {
      const error = new NotFoundError('Resource not found');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: undefined,
      });
    });

    it('should map ValidationError to 400', () => {
      const error = new ValidationError('Invalid input');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Invalid input',
        requestId: undefined,
      });
    });

    it('should map UnauthorizedError to 401', () => {
      const error = new UnauthorizedError('Invalid token');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Invalid token',
        requestId: undefined,
      });
    });

    it('should map ForbiddenError to 403', () => {
      const error = new ForbiddenError('Access denied');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 403,
        error: 'FORBIDDEN',
        message: 'Access denied',
        requestId: undefined,
      });
    });

    it('should map ConflictError to 409', () => {
      const error = new ConflictError('Resource already exists');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 409,
        error: 'CONFLICT',
        message: 'Resource already exists',
        requestId: undefined,
      });
    });

    it('should map UnprocessableEntityError to 422', () => {
      const error = new UnprocessableEntityError('Invalid webhook signature');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 422,
        error: 'UNPROCESSABLE_ENTITY',
        message: 'Invalid webhook signature',
        requestId: undefined,
      });
    });

    it('should map custom DomainError to specified status code', () => {
      const error = new DomainError('Custom error', 'CUSTOM_ERROR', 418);

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 418,
        error: 'CUSTOM_ERROR',
        message: 'Custom error',
        requestId: undefined,
      });
    });
  });

  describe('Booking-specific Errors', () => {
    it('should map BookingConflictError to 409', () => {
      const error = new BookingConflictError('2025-12-25');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 409,
        error: 'BOOKING_CONFLICT',
        message: 'Date 2025-12-25 is already booked',
        requestId: undefined,
      });
    });
  });

  describe('Unknown Error Handling', () => {
    it('should map generic Error to 500', () => {
      const error = new Error('Something went wrong');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        requestId: undefined,
      });
    });

    it('should log unknown errors with full details', () => {
      const error = new Error('Database connection failed');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.locals!.logger.error).toHaveBeenCalledWith({ err: error }, 'Unhandled error');
    });

    it('should hide unknown error details from client', () => {
      const error = new Error('Secret internal details');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Secret internal details',
        requestId: undefined,
      });
    });
  });

  describe('Logging Behavior', () => {
    it('should log domain errors at info level', () => {
      const error = new ConflictError('Duplicate booking');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.locals!.logger.info).toHaveBeenCalledWith(
        {
          err: {
            name: 'ConflictError',
            message: 'Duplicate booking',
            code: 'CONFLICT',
          },
          requestId: undefined,
        },
        'Application error'
      );
    });

    it('should log unknown errors at error level', () => {
      const error = new Error('Unexpected failure');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.locals!.logger.error).toHaveBeenCalledWith({ err: error }, 'Unhandled error');
    });

    it('should use fallback logger if res.locals.logger is missing', () => {
      res.locals = {}; // No logger

      const error = new NotFoundError('Not found');

      // Should not throw
      expect(() => {
        errorHandler(error, req as Request, res as Response, next);
      }).not.toThrow();

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Response Format', () => {
    it('should always return JSON format', () => {
      const error = new ValidationError('Bad request');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should include error code and message in response', () => {
      const error = new ConflictError('Already exists');

      errorHandler(error, req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: expect.any(String),
        })
      );
    });
  });
});
