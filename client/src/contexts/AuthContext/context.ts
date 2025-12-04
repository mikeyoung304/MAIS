/**
 * Authentication Context Definition
 *
 * Creates the React context for authentication state and methods.
 */

import { createContext } from 'react';
import type { AuthContextType } from '../../types/auth';

/**
 * Authentication Context
 *
 * Provides unified authentication state and methods for both platform admins and tenant admins.
 * Handles JWT token management, role-based access control, and automatic token refresh.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
