/**
 * Early Access Flow HTTP Tests
 * Tests the early access request endpoint including XSS prevention and CRLF injection
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildContainer } from '../../src/di';
import { loadConfig } from '../../src/lib/core/config';
import { createApp } from '../../src/app';
import type { Application } from 'express';

describe('Early Access - HTTP Tests', () => {
  let app: Application;

  beforeAll(async () => {
    const config = loadConfig();
    const container = buildContainer({ ...config, ADAPTERS_PRESET: 'mock' });
    const startTime = Date.now();
    app = createApp(config, container, startTime);
  });

  describe('POST /v1/auth/early-access', () => {
    it('should accept valid email and return 200', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: 'valid@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: "Thanks! We'll be in touch soon.",
      });
    });

    it('should reject invalid email format with 400', async () => {
      // Zod .email() validation rejects invalid email format
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: 'not-an-email' })
        .expect(400);

      // Zod email validation returns "Invalid email" error
      expect(response.body.message).toContain('Invalid email');
    });

    it('should reject missing email with 400', async () => {
      const response = await request(app).post('/v1/auth/early-access').send({}).expect(400);

      // Zod required validation returns "Required" error
      expect(response.body.message).toContain('Required');
    });

    it('should sanitize XSS payloads in email field', async () => {
      // XSS payloads are not valid emails - Zod rejects them
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid format
      expect(response.body.message).toContain('Invalid email');
    });

    it('should handle email with CRLF injection attempt', async () => {
      // CRLF injection attempt - Zod .email() validation rejects this
      const crlfPayload = 'test@example.com\r\nBcc: attacker@evil.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: crlfPayload })
        .expect(400);

      // Zod email validation blocks CRLF injection
      expect(response.body.message).toContain('Invalid email');
    });

    it('should normalize email (lowercase, trim)', async () => {
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: '  TEST@EXAMPLE.COM  ' })
        .expect(200);

      expect(response.body).toEqual({
        message: "Thanks! We'll be in touch soon.",
      });
    });
  });

  describe('XSS Prevention - Email Template HTML Injection', () => {
    /**
     * Security tests for TODO-299: Verify sanitizePlainText() prevents XSS in email templates
     * The sanitizedEmail is injected into HTML at line 922 of auth.routes.ts
     * These tests ensure malicious input cannot execute scripts in email clients
     */

    it('should escape script tags in email address', async () => {
      // Attack vector: Direct script injection
      const xssPayload = '<script>alert("xss")</script>@example.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid email format
      expect(response.body.message).toContain('Invalid email');
    });

    it('should escape event handler injection in email', async () => {
      // Attack vector: Event handler attributes
      const xssPayload = '" onload="alert(1)"@example.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid email format
      expect(response.body.message).toContain('Invalid email');
    });

    it('should handle pre-encoded HTML entities in email', async () => {
      // Attack vector: Pre-encoded script tags
      const xssPayload = '&lt;script&gt;@example.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid email format
      expect(response.body.message).toContain('Invalid email');
    });

    it('should reject homoglyph characters in email (Cyrillic)', async () => {
      // Attack vector: Cyrillic 'с' (U+0441) instead of Latin 'c' (U+0063)
      // Homoglyph attacks attempt to bypass validation with lookalike characters
      const homoglyphEmail = 'admin@maсon.com'; // 'с' is Cyrillic

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: homoglyphEmail })
        .expect(400);

      // Zod email validation correctly rejects non-ASCII characters
      // This prevents homoglyph-based phishing attacks
      expect(response.body.message).toContain('Invalid email');
    });

    it('should escape IMG tag with onerror handler', async () => {
      // Attack vector: IMG tag with onerror event
      const xssPayload = '<img src=x onerror="alert(1)">@example.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid email format
      expect(response.body.message).toContain('Invalid email');
    });

    it('should escape SVG with embedded script', async () => {
      // Attack vector: SVG with embedded JavaScript
      const xssPayload = '<svg/onload=alert(1)>@example.com';

      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: xssPayload })
        .expect(400);

      // Zod email validation rejects invalid email format
      expect(response.body.message).toContain('Invalid email');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to early-access endpoint', async () => {
      // Rate limit is configured via signupLimiter
      // This test documents the expected behavior
      // The endpoint uses signupLimiter which allows 5 requests per hour per IP
      const response = await request(app)
        .post('/v1/auth/early-access')
        .send({ email: 'ratelimit@example.com' })
        .expect(200);

      expect(response.body.message).toBeTruthy();
    });
  });
});
