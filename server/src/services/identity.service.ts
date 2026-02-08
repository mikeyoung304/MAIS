/**
 * Identity domain service
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRepository, TokenPayload, UnifiedTokenPayload } from '../lib/ports';
import { UnauthorizedError } from '../lib/errors';

export class IdentityService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtSecret: string
  ) {}

  async login(email: string, password: string): Promise<{ token: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256', // Explicit algorithm prevents confusion attacks
      expiresIn: '7d', // Token expiration (7 days)
    });
    return { token };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'], // Only allow HS256, reject others
      }) as TokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Create a normal admin JWT token without impersonation
   */
  createToken(payload: Omit<UnifiedTokenPayload, 'impersonating'>): string {
    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
  }

  /**
   * Create an impersonation JWT token with tenant context
   */
  createImpersonationToken(payload: UnifiedTokenPayload): string {
    return jwt.sign(
      // NOTE: `type: 'impersonation'` is audit metadata only — NOT used in middleware validation.
      // Future: add claim-based route restrictions if needed.
      { ...payload, type: 'impersonation' },
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '2h',
      }
    );
  }
}
