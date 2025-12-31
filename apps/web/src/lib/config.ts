/**
 * Application configuration constants
 *
 * This file centralizes environment-dependent configuration values
 * to avoid duplication across the codebase.
 */

/**
 * Base URL for the Express API server
 *
 * Uses NEXT_PUBLIC_API_URL for both client and server-side code.
 * Defaults to localhost:3001 for local development.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
