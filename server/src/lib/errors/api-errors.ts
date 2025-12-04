/**
 * Standardized API error responses
 */

// ============================================================================
// API Error Response Types
// ============================================================================

export interface ApiErrorResponse {
  status: 'error';
  statusCode: number;
  message: string;
  code?: string;
  requestId?: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp?: string;
}

export interface ApiSuccessResponse<T = any> {
  status: 'success';
  data: T;
  requestId?: string;
  timestamp?: string;
}

// ============================================================================
// Error Response Factory
// ============================================================================

/**
 * Creates a standardized API error response
 */
export function createApiError(
  statusCode: number,
  message: string,
  options?: {
    code?: string;
    requestId?: string;
    fieldErrors?: Array<{ field: string; message: string }>;
    includeTimestamp?: boolean;
  }
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    status: 'error',
    statusCode,
    message,
  };

  if (options?.code) {
    response.code = options.code;
  }

  if (options?.requestId) {
    response.requestId = options.requestId;
  }

  if (options?.fieldErrors && options.fieldErrors.length > 0) {
    response.errors = options.fieldErrors;
  }

  if (options?.includeTimestamp) {
    response.timestamp = new Date().toISOString();
  }

  return response;
}

/**
 * Creates a standardized API success response
 */
export function createApiSuccess<T = any>(
  data: T,
  options?: {
    requestId?: string;
    includeTimestamp?: boolean;
  }
): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = {
    status: 'success',
    data,
  };

  if (options?.requestId) {
    response.requestId = options.requestId;
  }

  if (options?.includeTimestamp) {
    response.timestamp = new Date().toISOString();
  }

  return response;
}

// ============================================================================
// Common Error Response Factories
// ============================================================================

/**
 * Creates a validation error response
 */
export function validationError(
  message: string,
  fieldErrors?: Array<{ field: string; message: string }>,
  requestId?: string
): ApiErrorResponse {
  return createApiError(400, message, {
    code: 'VALIDATION_ERROR',
    requestId,
    fieldErrors,
  });
}

/**
 * Creates an unauthorized error response
 */
export function unauthorizedError(
  message: string = 'Unauthorized',
  requestId?: string
): ApiErrorResponse {
  return createApiError(401, message, {
    code: 'UNAUTHORIZED',
    requestId,
  });
}

/**
 * Creates a forbidden error response
 */
export function forbiddenError(
  message: string = 'Forbidden',
  requestId?: string
): ApiErrorResponse {
  return createApiError(403, message, {
    code: 'FORBIDDEN',
    requestId,
  });
}

/**
 * Creates a not found error response
 */
export function notFoundError(resource: string, requestId?: string): ApiErrorResponse {
  return createApiError(404, `${resource} not found`, {
    code: 'NOT_FOUND',
    requestId,
  });
}

/**
 * Creates a conflict error response
 */
export function conflictError(message: string, requestId?: string): ApiErrorResponse {
  return createApiError(409, message, {
    code: 'CONFLICT',
    requestId,
  });
}

/**
 * Creates an internal server error response
 */
export function internalServerError(
  message: string = 'Internal server error',
  requestId?: string
): ApiErrorResponse {
  return createApiError(500, message, {
    code: 'INTERNAL_ERROR',
    requestId,
  });
}

// ============================================================================
// Field Error Helpers
// ============================================================================

/**
 * Creates a field error object
 */
export function fieldError(field: string, message: string): { field: string; message: string } {
  return { field, message };
}

/**
 * Validates required fields and returns field errors
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of requiredFields) {
    if (!data[field]) {
      errors.push(fieldError(field, `${field} is required`));
    }
  }

  return errors;
}

/**
 * Checks if a response is an error response
 */
export function isErrorResponse(response: any): response is ApiErrorResponse {
  return response && response.status === 'error';
}

/**
 * Checks if a response is a success response
 */
export function isSuccessResponse(response: any): response is ApiSuccessResponse {
  return response && response.status === 'success';
}
