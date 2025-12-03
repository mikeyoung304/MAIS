/**
 * Express application setup
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { randomUUID } from 'crypto';
import swaggerUi from 'swagger-ui-express';
import type { Config } from './lib/core/config';
import { logger } from './lib/core/logger';
import type { Container } from './di';
import { createV1Router } from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { skipIfHealth, adminLimiter } from './middleware/rateLimiter';
import { openApiSpec } from './api-docs';
import { uploadService } from './services/upload.service';
import { sentryRequestHandler, sentryErrorHandler } from './lib/errors/sentry';
import { registerHealthRoutes } from './routes/health.routes';
import { sanitizeInput } from './middleware/sanitize';
import { cspViolationsRouter } from './routes/csp-violations.routes';

export function createApp(
  config: Config,
  container: Container,
  startTime: number
): express.Application {
  const app = express();

  // Sentry request tracking (MUST be first)
  app.use(sentryRequestHandler());

  // Security middleware with custom CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // TODO: Replace with nonce in Phase 3 if needed
            "https://js.stripe.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Tailwind CSS
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:", // Allow HTTPS images (package photos, logos)
            "blob:",
          ],
          connectSrc: [
            "'self'",
            "https://api.stripe.com",
            "https://uploads.stripe.com",
          ],
          frameSrc: [
            "https://js.stripe.com",
            "https://hooks.stripe.com",
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"], // Prevent clickjacking
          baseUri: ["'self'"],
          reportUri: "/v1/csp-violations", // CSP violation reporting
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },
    })
  );

  // CORS - Environment-aware origin validation
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);

        // In development, allow all origins
        if (process.env.NODE_ENV === 'development') {
          return callback(null, true);
        }

        // In production, use explicit allowlist from environment variable
        const allowedOrigins = config.ALLOWED_ORIGINS || [];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, 'CORS request blocked - origin not in allowlist');
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Key'],
      exposedHeaders: ['X-Tenant-Key'], // Allow clients to read this header
    })
  );

  // Rate limiting (skip health/ready endpoints, apply globally)
  app.use(skipIfHealth);

  // Stricter rate limiting for admin routes
  app.use('/v1/admin', adminLimiter);

  // Body parsing
  // IMPORTANT: Stripe webhook needs raw body for signature verification
  // Apply raw body parser to webhook endpoint BEFORE json() middleware
  app.use(
    '/v1/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    requestLogger
  );

  // Apply JSON parsing to all other routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request ID + logging middleware (for non-webhook routes)
  app.use(requestLogger);

  // Apply input sanitization globally (except webhooks which need raw body)
  app.use((req, res, next) => {
    // Skip sanitization for webhook endpoints (need raw body)
    if (req.path.startsWith('/v1/webhooks')) {
      return next();
    }
    sanitizeInput()(req, res, next);
  });

  // Serve uploaded files (static)
  const logoUploadDir = uploadService.getLogoUploadDir();
  app.use('/uploads/logos', express.static(logoUploadDir));
  logger.info({ uploadDir: logoUploadDir }, 'Serving uploaded logos from static directory');

  const packagePhotoUploadDir = uploadService.getPackagePhotoUploadDir();
  app.use('/uploads/packages', express.static(packagePhotoUploadDir));
  logger.info({ uploadDir: packagePhotoUploadDir }, 'Serving package photos from static directory');

  const segmentImageUploadDir = uploadService.getSegmentImageUploadDir();
  app.use('/uploads/segments', express.static(segmentImageUploadDir));
  logger.info({ uploadDir: segmentImageUploadDir }, 'Serving segment images from static directory');

  // Serve public files (security.txt, etc.)
  const publicDir = path.join(__dirname, '..', 'public');
  app.use('/.well-known', express.static(path.join(publicDir, '.well-known')));
  logger.info({ publicDir }, 'Serving public files from static directory');

  // Register health check routes (BEFORE all other routes)
  registerHealthRoutes(app, {
    prisma: container.prisma,
    config,
    startTime,
  });

  // Register CSP violation reporting endpoint
  app.use('/v1', cspViolationsRouter);

  // API Documentation endpoints
  // Serve OpenAPI spec as JSON
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiSpec);
  });

  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'MAIS API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    })
  );

  // Mount v1 router (container passed as parameter now)
  createV1Router(container.controllers, container.services.identity, app, {
    catalog: container.services.catalog,
    booking: container.services.booking,
    tenantAuth: container.services.tenantAuth,
    segment: container.services.segment,
    stripeConnect: container.services.stripeConnect,
    schedulingAvailability: container.services.schedulingAvailability,
    packageDraft: container.services.packageDraft,
    tenantOnboarding: container.services.tenantOnboarding,
    reminder: container.services.reminder,
  }, container.mailProvider, container.prisma, container.repositories);

  // Mount dev routes (mock mode only)
  if (config.ADAPTERS_PRESET === 'mock' && container.controllers.dev) {
    logger.info('🧪 Mounting dev simulator routes');

    // POST /v1/dev/simulate-checkout-completed
    app.post('/v1/dev/simulate-checkout-completed', async (req, res, next) => {
      try {
        const reqLogger = res.locals.logger || logger;
        reqLogger.info({ body: req.body }, 'simulate-checkout-completed requested');
        const result = await container.controllers.dev!.simulateCheckoutCompleted(req.body);
        reqLogger.info({ bookingId: result.bookingId }, 'simulate-checkout-completed completed');
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    });

    // GET /v1/dev/debug-state
    app.get('/v1/dev/debug-state', async (_req, res, next) => {
      try {
        const state = await container.controllers.dev!.getDebugState();
        res.json(state);
      } catch (error) {
        next(error);
      }
    });

    // POST /v1/dev/reset
    app.post('/v1/dev/reset', async (_req, res, next) => {
      try {
        const reqLogger = res.locals.logger || logger;
        reqLogger.info('reset requested');
        await container.controllers.dev!.reset();
        reqLogger.info('reset completed');
        res.status(200).json({ ok: true });
      } catch (error) {
        next(error);
      }
    });

    // POST /v1/dev/generate-booking-token - Generate a booking management token
    app.post('/v1/dev/generate-booking-token', async (req, res, next) => {
      try {
        const reqLogger = res.locals.logger || logger;
        reqLogger.info({ body: req.body }, 'generate-booking-token requested');
        const result = await container.controllers.dev!.generateBookingToken(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // POST /v1/dev/create-booking-with-token - Create booking and return management token
    app.post('/v1/dev/create-booking-with-token', async (req, res, next) => {
      try {
        const reqLogger = res.locals.logger || logger;
        reqLogger.info({ body: req.body }, 'create-booking-with-token requested');
        const result = await container.controllers.dev!.createBookingWithToken(req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
  }

  // 404 handler (must come after all routes)
  app.use(notFoundHandler);

  // Sentry error handler (MUST be before custom error handler)
  app.use(sentryErrorHandler());

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
