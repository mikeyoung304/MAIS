/**
 * AuthContext exports
 */

export { AuthProvider, useAuth } from './AuthProvider';
export type {
  AuthContextType,
  AuthState,
  User,
  UserRole,
  ImpersonationData,
  LoginResponse,
  SignupResponse,
  TokenPayload,
} from './types';
export {
  AUTH_COOKIES,
  decodeJWT,
  isTokenExpired,
  getCookie,
  setCookie,
  deleteCookie,
  clearAuthCookies,
} from './auth-utils';
