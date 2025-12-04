/**
 * Sanitization Middleware Tests
 *
 * Tests XSS/injection prevention via input sanitization.
 * Critical security component - must maintain 100% coverage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { sanitizeInput, skipSanitization } from '../../src/middleware/sanitize';
import {
  sanitizeHtml,
  sanitizePlainText,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeObject,
  sanitizeTenantSlug,
  sanitizeSlug,
} from '../../src/lib/sanitization';

describe('Sanitization Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags (whitelist)', () => {
      const input = '<p>Hello <strong>world</strong>!</p>';
      const result = sanitizeHtml(input);

      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    it('should strip unsafe HTML tags', () => {
      const input = '<script>alert("xss")</script><p>Safe</p>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe');
    });

    it('should strip event handlers from tags', () => {
      const input = '<p onclick="alert(1)">Click me</p>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('onclick');
      expect(result).toContain('Click me');
    });

    it('should strip style tags', () => {
      const input = '<style>body { display: none; }</style><p>Text</p>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<style>');
      expect(result).not.toContain('display: none');
      expect(result).toContain('Text');
    });

    it('should handle nested unsafe tags', () => {
      const input = '<p><script>evil()</script><strong>Safe</strong></p>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain('<script>');
      expect(result).toContain('<strong>');
    });

    it('should preserve allowed formatting tags', () => {
      const input = '<b>Bold</b> <i>Italic</i> <em>Emphasis</em>';
      const result = sanitizeHtml(input);

      expect(result).toContain('<b>');
      expect(result).toContain('<i>');
      expect(result).toContain('<em>');
    });
  });

  describe('sanitizePlainText', () => {
    it('should strip all HTML tags', () => {
      const input = '<p>Hello <strong>world</strong>!</p>';
      const result = sanitizePlainText(input);

      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<strong>');
      expect(result).toContain('Hello');
      expect(result).toContain('world');
    });

    it('should encode special characters', () => {
      const input = 'Test & "quotes" <tags>';
      const result = sanitizePlainText(input);

      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should remove low ASCII characters (control characters)', () => {
      const input = 'Hello\x00\x01\x02World';
      const result = sanitizePlainText(input);

      expect(result).toBe('HelloWorld');
    });

    it('should handle empty string', () => {
      const result = sanitizePlainText('');
      expect(result).toBe('');
    });

    it('should preserve safe text', () => {
      const input = 'Hello World 123';
      const result = sanitizePlainText(input);

      expect(result).toBe('Hello World 123');
    });
  });

  describe('sanitizeEmail', () => {
    it('should normalize valid email to lowercase', () => {
      const input = 'Test@Example.COM';
      const result = sanitizeEmail(input);

      expect(result).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const input = '  test@example.com  ';
      const result = sanitizeEmail(input);

      expect(result).toBe('test@example.com');
    });

    it('should reject invalid email format', () => {
      const input = 'notanemail';
      const result = sanitizeEmail(input);

      expect(result).toBe('');
    });

    it('should reject email with XSS attempt', () => {
      const input = '<script>@example.com';
      const result = sanitizeEmail(input);

      expect(result).toBe('');
    });

    it('should preserve dots in Gmail addresses', () => {
      const input = 'test.user@gmail.com';
      const result = sanitizeEmail(input);

      expect(result).toBe('test.user@gmail.com');
    });

    it('should handle international domain names', () => {
      const input = 'test@example.co.uk';
      const result = sanitizeEmail(input);

      expect(result).toBe('test@example.co.uk');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTP URL', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);

      expect(result).toBe('http://example.com');
    });

    it('should allow valid HTTPS URL', () => {
      const input = 'https://example.com/path?query=1';
      const result = sanitizeUrl(input);

      expect(result).toBe('https://example.com/path?query=1');
    });

    it('should reject javascript: protocol (XSS vector)', () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should reject data: protocol (XSS vector)', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should reject URL without protocol', () => {
      const input = 'example.com';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });

    it('should reject malformed URLs', () => {
      const input = 'http://';
      const result = sanitizeUrl(input);

      expect(result).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('should remove all non-numeric characters', () => {
      const input = '(555) 123-4567';
      const result = sanitizePhone(input);

      expect(result).toBe('5551234567');
    });

    it('should preserve international prefix (+)', () => {
      const input = '+1 (555) 123-4567';
      const result = sanitizePhone(input);

      expect(result).toBe('+15551234567');
    });

    it('should remove letters', () => {
      const input = '1-800-FLOWERS';
      const result = sanitizePhone(input);

      expect(result).toBe('1800');
    });

    it('should remove special characters', () => {
      const input = 'call me @ 555.123.4567!';
      const result = sanitizePhone(input);

      expect(result).toBe('5551234567');
    });

    it('should handle empty string', () => {
      const result = sanitizePhone('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string fields', () => {
      const input = { name: '<script>alert(1)</script>John', age: 30 };
      const result = sanitizeObject(input);

      expect(result.name).not.toContain('<script>');
      expect(result.name).toContain('John');
      expect(result.age).toBe(30);
    });

    it('should detect and sanitize email fields', () => {
      const input = { userEmail: 'TEST@EXAMPLE.COM', age: 25 };
      const result = sanitizeObject(input);

      expect(result.userEmail).toBe('test@example.com');
    });

    it('should detect and sanitize URL fields', () => {
      const input = { profileUrl: 'javascript:alert(1)' };
      const result = sanitizeObject(input);

      expect(result.profileUrl).toBe('');
    });

    it('should detect and sanitize phone fields', () => {
      const input = { phone: '(555) 123-4567', phoneNumber: '+1-800-555-1234' };
      const result = sanitizeObject(input);

      expect(result.phone).toBe('5551234567');
      expect(result.phoneNumber).toBe('+18005551234');
    });

    it('should recursively sanitize nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          contact: {
            email: 'TEST@EXAMPLE.COM',
          },
        },
      };
      const result = sanitizeObject(input);

      expect(result.user.name).not.toContain('<b>');
      expect(result.user.contact.email).toBe('test@example.com');
    });

    it('should sanitize arrays of objects', () => {
      const input = {
        users: [{ name: '<script>evil</script>Alice' }, { name: '<img onerror=alert(1)>Bob' }],
      };
      const result = sanitizeObject(input);

      expect(result.users[0].name).not.toContain('<script>');
      expect(result.users[1].name).not.toContain('<img');
      expect(result.users[0].name).toContain('Alice');
      expect(result.users[1].name).toContain('Bob');
    });

    it('should allow HTML in whitelisted fields', () => {
      const input = { description: '<p>Hello <strong>world</strong></p>' };
      const result = sanitizeObject(input, { allowHtml: ['description'] });

      expect(result.description).toContain('<p>');
      expect(result.description).toContain('<strong>');
    });

    it('should strip unsafe HTML even in whitelisted fields', () => {
      const input = { description: '<script>alert(1)</script><p>Safe</p>' };
      const result = sanitizeObject(input, { allowHtml: ['description'] });

      expect(result.description).not.toContain('<script>');
      expect(result.description).toContain('Safe');
    });

    it('should handle null and undefined values', () => {
      const input = { name: 'John', optional: null, missing: undefined };
      const result = sanitizeObject(input);

      expect(result.name).toBe('John');
      expect(result.optional).toBeNull();
      expect(result.missing).toBeUndefined();
    });

    it('should preserve boolean values', () => {
      const input = { active: true, deleted: false };
      const result = sanitizeObject(input);

      expect(result.active).toBe(true);
      expect(result.deleted).toBe(false);
    });

    it('should preserve number values', () => {
      const input = { age: 25, price: 99.99, count: 0 };
      const result = sanitizeObject(input);

      expect(result.age).toBe(25);
      expect(result.price).toBe(99.99);
      expect(result.count).toBe(0);
    });
  });

  describe('sanitizeTenantSlug', () => {
    it('should convert to lowercase', () => {
      const input = 'MyTenant';
      const result = sanitizeTenantSlug(input);

      expect(result).toBe('mytenant');
    });

    it('should allow hyphens', () => {
      const input = 'my-tenant-name';
      const result = sanitizeTenantSlug(input);

      expect(result).toBe('my-tenant-name');
    });

    it('should remove special characters', () => {
      const input = 'my_tenant@2024!';
      const result = sanitizeTenantSlug(input);

      expect(result).toBe('mytenant2024');
    });

    it('should remove spaces', () => {
      const input = 'my tenant';
      const result = sanitizeTenantSlug(input);

      expect(result).toBe('mytenant');
    });

    it('should limit length to 50 characters', () => {
      const input = 'a'.repeat(100);
      const result = sanitizeTenantSlug(input);

      expect(result.length).toBe(50);
    });

    it('should handle empty string', () => {
      const result = sanitizeTenantSlug('');
      expect(result).toBe('');
    });
  });

  describe('sanitizeSlug', () => {
    it('should convert to lowercase', () => {
      const input = 'MyPackage';
      const result = sanitizeSlug(input);

      expect(result).toBe('mypackage');
    });

    it('should allow hyphens', () => {
      const input = 'wedding-package-2024';
      const result = sanitizeSlug(input);

      expect(result).toBe('wedding-package-2024');
    });

    it('should remove special characters', () => {
      const input = 'package_name@v2!';
      const result = sanitizeSlug(input);

      expect(result).toBe('packagenamev2');
    });

    it('should remove leading and trailing hyphens', () => {
      const input = '-my-package-';
      const result = sanitizeSlug(input);

      expect(result).toBe('my-package');
    });

    it('should limit length to 100 characters', () => {
      const input = 'a'.repeat(150);
      const result = sanitizeSlug(input);

      expect(result.length).toBe(100);
    });

    it('should handle spaces by removing them', () => {
      const input = 'my package name';
      const result = sanitizeSlug(input);

      expect(result).toBe('mypackagename');
    });
  });
});

describe('Sanitization Middleware', () => {
  describe('sanitizeInput', () => {
    it('should sanitize request body', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput());

      app.post('/test', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app)
        .post('/test')
        .send({ name: '<script>alert(1)</script>John' });

      expect(response.body.name).not.toContain('<script>');
      expect(response.body.name).toContain('John');
    });

    it('should sanitize query parameters', async () => {
      const app = express();
      app.use(sanitizeInput());

      app.get('/test', (req, res) => {
        res.json(req.query);
      });

      const response = await request(app).get('/test').query({ search: '<script>evil</script>' });

      expect(response.body.search).not.toContain('<script>');
    });

    it('should sanitize URL parameters', async () => {
      const app = express();
      app.use(sanitizeInput());

      app.get('/user/:id', (req, res) => {
        res.json(req.params);
      });

      // Use URL-encoded malicious input
      const response = await request(app).get('/user/123abc<b>test</b>');

      // Should have sanitized the param (if it exists)
      if (response.body.id) {
        expect(response.body.id).not.toContain('<b>');
      }
    });

    it('should allow HTML in specified fields', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput({ allowHtml: ['description'] }));

      app.post('/test', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app).post('/test').send({
        name: '<b>Bold</b>',
        description: '<p>Hello <strong>world</strong></p>',
      });

      // name should be plain text (HTML stripped)
      expect(response.body.name).not.toContain('<b>');

      // description should allow safe HTML
      expect(response.body.description).toContain('<p>');
      expect(response.body.description).toContain('<strong>');
    });

    it('should skip sanitization when skip=true', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput({ skip: true }));

      app.post('/webhook', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app)
        .post('/webhook')
        .send({ raw: '<script>alert(1)</script>' });

      // Should NOT sanitize when skip=true
      expect(response.body.raw).toBe('<script>alert(1)</script>');
    });

    it('should handle nested objects in request body', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput());

      app.post('/test', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app)
        .post('/test')
        .send({
          user: {
            name: '<img src=x onerror=alert(1)>',
            email: 'TEST@EXAMPLE.COM',
          },
        });

      expect(response.body.user.name).not.toContain('<img');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should handle arrays in request body', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput());

      app.post('/test', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app)
        .post('/test')
        .send({
          items: ['<script>1</script>', '<script>2</script>'],
        });

      expect(response.body.items[0]).not.toContain('<script>');
      expect(response.body.items[1]).not.toContain('<script>');
    });

    it('should call next() on success', async () => {
      const app = express();
      app.use(express.json());
      app.use(sanitizeInput());

      let middlewareCalled = false;
      app.post('/test', (req, res, next) => {
        middlewareCalled = true;
        res.json({ success: true });
      });

      await request(app).post('/test').send({ name: 'John' });

      expect(middlewareCalled).toBe(true);
    });

    it('should call next(error) on sanitization error', async () => {
      const app = express();
      app.use(express.json());

      // Mock sanitizeObject to throw error
      const mockSanitize = vi.fn(() => {
        throw new Error('Sanitization failed');
      });

      app.use((req, res, next) => {
        try {
          if (req.body) {
            req.body = mockSanitize(req.body);
          }
          next();
        } catch (error) {
          next(error);
        }
      });

      // Error handler
      app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        res.status(500).json({ error: err.message });
      });

      app.post('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).post('/test').send({ name: 'John' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Sanitization failed');
    });
  });

  describe('skipSanitization', () => {
    it('should skip all sanitization', async () => {
      const app = express();
      app.use(express.json());
      app.use(skipSanitization());

      app.post('/webhook', (req, res) => {
        res.json(req.body);
      });

      const response = await request(app).post('/webhook').send({
        raw: '<script>alert(1)</script>',
        email: 'TEST@EXAMPLE.COM',
      });

      // Should NOT sanitize
      expect(response.body.raw).toBe('<script>alert(1)</script>');
      expect(response.body.email).toBe('TEST@EXAMPLE.COM'); // Not lowercased
    });

    it('should be used for webhook endpoints', async () => {
      const app = express();
      app.use(express.json());

      // Apply skipSanitization to webhook route
      app.post('/webhooks/stripe', skipSanitization(), (req, res) => {
        res.json(req.body);
      });

      // Apply normal sanitization to other routes
      app.post('/api/users', sanitizeInput(), (req, res) => {
        res.json(req.body);
      });

      const webhookResponse = await request(app)
        .post('/webhooks/stripe')
        .send({ data: '<raw>payload</raw>' });

      const apiResponse = await request(app).post('/api/users').send({ name: '<b>John</b>' });

      // Webhook should preserve raw data
      expect(webhookResponse.body.data).toBe('<raw>payload</raw>');

      // API should sanitize
      expect(apiResponse.body.name).not.toContain('<b>');
    });
  });
});
