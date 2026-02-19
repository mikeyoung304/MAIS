/**
 * CloudRunAuthService Unit Tests
 *
 * Tests the 3 critical behaviors:
 * 1. JWT tier returns token, cache hit on second call (no re-fetch)
 * 2. Fallback chain: JWT fails → gcloud CLI
 * 3. Malformed GOOGLE_SERVICE_ACCOUNT_JSON handled gracefully (Zod rejects, falls through)
 *
 * @see docs/plans/2026-02-04-refactor-shared-cloud-run-auth-service-plan.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock google-auth-library before importing the module under test
const mockFetchIdToken = vi.fn();
vi.mock('google-auth-library', () => ({
  JWT: vi.fn().mockImplementation(() => ({
    fetchIdToken: mockFetchIdToken,
  })),
}));

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock logger to suppress output in tests
vi.mock('../../lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// We need to import after mocks are set up
import { CloudRunAuthService } from '../cloud-run-auth.service';
import { resetConfig } from '../../lib/core/config';

describe('CloudRunAuthService', () => {
  const TEST_AUDIENCE = 'https://tenant-agent-123.us-central1.run.app';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars and config singleton so getConfig() re-reads process.env
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.K_SERVICE;
    resetConfig();
  });

  describe('JWT token + cache hit', () => {
    it('should return JWT token and serve from cache on second call', async () => {
      // Arrange: Set up valid credentials
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        client_email: 'test@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake-key\n-----END RSA PRIVATE KEY-----',
      });

      const service = new CloudRunAuthService();
      mockFetchIdToken.mockResolvedValue('fake-jwt-id-token');

      // Act: First call — should invoke JWT
      const token1 = await service.getIdentityToken(TEST_AUDIENCE);

      // Assert: Token returned from JWT
      expect(token1).toBe('fake-jwt-id-token');
      expect(mockFetchIdToken).toHaveBeenCalledTimes(1);
      expect(mockFetchIdToken).toHaveBeenCalledWith(TEST_AUDIENCE);

      // Act: Second call — should return from cache
      const token2 = await service.getIdentityToken(TEST_AUDIENCE);

      // Assert: Same token, no additional fetch
      expect(token2).toBe('fake-jwt-id-token');
      expect(mockFetchIdToken).toHaveBeenCalledTimes(1); // Still 1 — cache hit

      // Verify clearCacheFor works
      service.clearCacheFor(TEST_AUDIENCE);
      const token3 = await service.getIdentityToken(TEST_AUDIENCE);
      expect(token3).toBe('fake-jwt-id-token');
      expect(mockFetchIdToken).toHaveBeenCalledTimes(2); // Now 2 — cache was cleared
    });
  });

  describe('fallback chain: JWT fails → gcloud CLI', () => {
    it('should fall back to gcloud CLI when JWT fails', async () => {
      // Arrange: Set up credentials but make JWT fail
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        client_email: 'test@project.iam.gserviceaccount.com',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\nfake-key\n-----END RSA PRIVATE KEY-----',
      });

      const service = new CloudRunAuthService();
      mockFetchIdToken.mockRejectedValue(new Error('JWT signing failed'));
      mockExecSync.mockReturnValue('gcloud-id-token\n');

      // Act
      const token = await service.getIdentityToken(TEST_AUDIENCE);

      // Assert: Fell through to gcloud CLI
      expect(token).toBe('gcloud-id-token');
      expect(mockFetchIdToken).toHaveBeenCalledTimes(1); // JWT was attempted
      expect(mockExecSync).toHaveBeenCalledWith('gcloud auth print-identity-token', {
        encoding: 'utf-8',
        timeout: 5000,
      });
    });
  });

  describe('malformed GOOGLE_SERVICE_ACCOUNT_JSON', () => {
    it('should handle malformed JSON gracefully and fall through to gcloud', async () => {
      // Arrange: Set up malformed credentials (missing private_key)
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        client_email: 'test@project.iam.gserviceaccount.com',
        // Missing private_key — Zod will reject
      });

      mockExecSync.mockReturnValue('gcloud-fallback-token\n');

      // Act: Constructor should handle the Zod validation failure gracefully
      const service = new CloudRunAuthService();
      const token = await service.getIdentityToken(TEST_AUDIENCE);

      // Assert: JWT was never attempted (credentials were rejected by Zod),
      // fell through directly to gcloud CLI
      expect(token).toBe('gcloud-fallback-token');
      expect(mockFetchIdToken).not.toHaveBeenCalled();
    });

    it('should handle completely invalid JSON gracefully', async () => {
      // Arrange: Set invalid JSON string
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'not-valid-json{{{';
      mockExecSync.mockReturnValue('gcloud-fallback-token\n');

      // Act: Constructor should catch parse error
      const service = new CloudRunAuthService();
      const token = await service.getIdentityToken(TEST_AUDIENCE);

      // Assert: Falls through to gcloud
      expect(token).toBe('gcloud-fallback-token');
      expect(mockFetchIdToken).not.toHaveBeenCalled();
    });
  });
});
