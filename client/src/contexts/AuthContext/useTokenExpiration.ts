/**
 * Token Expiration Check Hook
 *
 * Periodically checks if the authentication token has expired and triggers logout if needed.
 */

import { useEffect } from 'react';
import { checkTokenExpiration } from './services';

/**
 * Token expiration check interval in milliseconds
 */
const TOKEN_CHECK_INTERVAL = 60000; // 60 seconds

/**
 * Hook to periodically check for token expiration
 *
 * @param token - JWT token to monitor
 * @param onExpired - Callback to execute when token expires
 */
export function useTokenExpiration(token: string | null, onExpired: () => void): void {
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (token && checkTokenExpiration(token)) {
        // Token expired, trigger callback
        onExpired();
      }
    }, TOKEN_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [token, onExpired]);
}
