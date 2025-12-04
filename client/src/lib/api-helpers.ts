/**
 * Shared API client utilities
 */

import { logger } from './logger';

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }

  logger.error('API Error', { error });
  throw new Error('An unexpected error occurred');
}

/**
 * Format currency for API (dollars to cents)
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format currency for display (cents to dollars)
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Validate required fields
 */
export function validateRequired<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): void {
  const missing = requiredFields.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Check if HTTP status code indicates success
 */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Check if HTTP status code indicates client error
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Check if HTTP status code indicates server error
 */
export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}
