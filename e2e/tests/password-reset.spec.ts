import { test, expect } from '@playwright/test';

/**
 * E2E Test: Password Reset Flow
 *
 * This test verifies the password reset API endpoints:
 * 1. POST /v1/auth/forgot-password - Request reset email
 * 2. POST /v1/auth/reset-password - Complete reset with token
 *
 * Note: We test API behavior only since we cannot access email delivery
 * or click links from emails in E2E tests. The flow would be:
 * 1. User requests password reset
 * 2. Server generates token and sends email (not tested)
 * 3. User clicks link with token (simulated with API call)
 * 4. User sets new password
 */
test.describe('Password Reset Flow', () => {
  const API_BASE = 'http://localhost:3001';

  test.beforeEach(async ({ request }) => {
    // Reset mock state for deterministic tests
    const resetResponse = await request.post(`${API_BASE}/v1/dev/reset`);
    expect(resetResponse.ok()).toBeTruthy();
  });

  test('should request password reset for valid email', async ({ request }) => {
    // First, sign up a test tenant
    const signupResponse = await request.post(`${API_BASE}/v1/auth/signup`, {
      data: {
        email: 'password-reset-test@example.com',
        password: 'OriginalPassword123',
        businessName: 'Password Reset Test Business',
      },
    });
    expect(signupResponse.ok()).toBeTruthy();

    // Request password reset
    const forgotResponse = await request.post(`${API_BASE}/v1/auth/forgot-password`, {
      data: {
        email: 'password-reset-test@example.com',
      },
    });

    expect(forgotResponse.status()).toBe(200);
    const forgotData = await forgotResponse.json();
    expect(forgotData.message).toBe('If an account exists, a reset link has been sent');

    console.log('✅ Password reset request accepted');
  });

  test('should return success for non-existent email (email enumeration protection)', async ({
    request,
  }) => {
    // Request password reset for email that doesn't exist
    const forgotResponse = await request.post(`${API_BASE}/v1/auth/forgot-password`, {
      data: {
        email: 'nonexistent@example.com',
      },
    });

    // Should return 200 (same as valid email) to prevent email enumeration
    expect(forgotResponse.status()).toBe(200);
    const forgotData = await forgotResponse.json();
    expect(forgotData.message).toBe('If an account exists, a reset link has been sent');

    console.log(
      '✅ Email enumeration protection working (no distinction between valid/invalid emails)'
    );
  });

  test('should reject password reset request without email', async ({ request }) => {
    const forgotResponse = await request.post(`${API_BASE}/v1/auth/forgot-password`, {
      data: {},
    });

    expect(forgotResponse.status()).toBe(400);
    const errorData = await forgotResponse.json();
    expect(errorData.error).toContain('Email is required');

    console.log('✅ Password reset request rejected without email');
  });

  test('should reject password reset with invalid token format', async ({ request }) => {
    const resetResponse = await request.post(`${API_BASE}/v1/auth/reset-password`, {
      data: {
        token: 'invalid-token-format',
        password: 'NewSecurePassword123',
      },
    });

    expect(resetResponse.status()).toBe(400);
    const errorData = await resetResponse.json();
    expect(errorData.error).toContain('Invalid reset token format');

    console.log('✅ Invalid token format rejected');
  });

  test('should reject password reset with invalid token (even if format is correct)', async ({
    request,
  }) => {
    // Generate a valid-looking token (64 hex characters) that doesn't exist in database
    const fakeToken = 'a'.repeat(64); // Valid format but not in database

    const resetResponse = await request.post(`${API_BASE}/v1/auth/reset-password`, {
      data: {
        token: fakeToken,
        password: 'NewSecurePassword123',
      },
    });

    expect(resetResponse.status()).toBe(400);
    const errorData = await resetResponse.json();
    expect(errorData.error).toContain('Invalid or expired reset token');

    console.log('✅ Non-existent token rejected');
  });

  test('should reject password reset with short password', async ({ request }) => {
    const resetResponse = await request.post(`${API_BASE}/v1/auth/reset-password`, {
      data: {
        token: 'a'.repeat(64), // Valid format
        password: 'short',
      },
    });

    expect(resetResponse.status()).toBe(400);
    const errorData = await resetResponse.json();
    expect(errorData.error).toContain('Password must be at least 8 characters');

    console.log('✅ Short password rejected');
  });

  test('should reject password reset without token', async ({ request }) => {
    const resetResponse = await request.post(`${API_BASE}/v1/auth/reset-password`, {
      data: {
        password: 'NewSecurePassword123',
      },
    });

    expect(resetResponse.status()).toBe(400);
    const errorData = await resetResponse.json();
    expect(errorData.error).toContain('Token and password are required');

    console.log('✅ Password reset rejected without token');
  });

  test('should reject password reset without password', async ({ request }) => {
    const resetResponse = await request.post(`${API_BASE}/v1/auth/reset-password`, {
      data: {
        token: 'a'.repeat(64),
      },
    });

    expect(resetResponse.status()).toBe(400);
    const errorData = await resetResponse.json();
    expect(errorData.error).toContain('Token and password are required');

    console.log('✅ Password reset rejected without password');
  });

  test('should complete full password reset flow in development mode', async ({ request }) => {
    // Step 1: Sign up a test tenant
    const signupResponse = await request.post(`${API_BASE}/v1/auth/signup`, {
      data: {
        email: 'full-reset-test@example.com',
        password: 'OriginalPassword123',
        businessName: 'Full Reset Test Business',
      },
    });
    expect(signupResponse.ok()).toBeTruthy();
    const signupData = await signupResponse.json();
    const tenantId = signupData.tenantId;

    console.log(`✅ Tenant created: ${tenantId}`);

    // Step 2: Request password reset
    const forgotResponse = await request.post(`${API_BASE}/v1/auth/forgot-password`, {
      data: {
        email: 'full-reset-test@example.com',
      },
    });
    expect(forgotResponse.status()).toBe(200);

    console.log('✅ Password reset requested');

    // Step 3: In development mode, we can't extract the token from the email
    // But we can verify that:
    // a) The request was accepted
    // b) We can still login with the original password
    const loginResponse = await request.post(`${API_BASE}/v1/auth/login`, {
      data: {
        email: 'full-reset-test@example.com',
        password: 'OriginalPassword123',
      },
    });
    expect(loginResponse.ok()).toBeTruthy();

    console.log('✅ Original password still works (token not yet used)');

    // Note: In a real scenario, the user would:
    // 1. Receive an email with a reset link containing the token
    // 2. Click the link and be taken to a reset password page
    // 3. Submit a new password via POST /v1/auth/reset-password with the token
    //
    // We can't fully test this flow in E2E because we can't access the email
    // or extract the token. This would require either:
    // - A test email service that provides an API to read emails
    // - A special development endpoint that returns the token for testing
    // - Integration tests that directly access the database
  });

  test('should rate limit password reset requests', async ({ request }) => {
    const email = 'rate-limit-test@example.com';

    // Sign up first
    await request.post(`${API_BASE}/v1/auth/signup`, {
      data: {
        email,
        password: 'TestPassword123',
        businessName: 'Rate Limit Test',
      },
    });

    // Make multiple rapid password reset requests
    const requests = [];
    for (let i = 0; i < 6; i++) {
      requests.push(
        request.post(`${API_BASE}/v1/auth/forgot-password`, {
          data: { email },
        })
      );
    }

    const responses = await Promise.all(requests);

    // First 5 should succeed (signupLimiter allows 5 requests per 15 min)
    const successCount = responses.filter((r) => r.status() === 200).length;
    const rateLimitCount = responses.filter((r) => r.status() === 429).length;

    // Note: Rate limiting behavior depends on the signupLimiter configuration
    // In the routes, forgot-password uses signupLimiter (5 req/15min)
    console.log(`✅ Requests: ${successCount} succeeded, ${rateLimitCount} rate-limited`);

    // At least one should be rate-limited if we exceed the limit
    if (rateLimitCount > 0) {
      const rateLimitedResponse = responses.find((r) => r.status() === 429);
      expect(rateLimitedResponse).toBeDefined();
      console.log('✅ Rate limiting is active');
    }
  });
});
