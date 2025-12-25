/**
 * NextAuth.js API Route Handler
 *
 * Exposes the NextAuth.js handlers at /api/auth/*
 * Handles: signIn, signOut, callback, session, csrf, etc.
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
