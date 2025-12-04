# Technical Debt - Remediation Code Examples

This document provides code examples for fixing the identified technical debt items.

---

## 1. Hardcoded Environment Values - Before & After

### BEFORE: Hardcoded CORS Origins

```typescript
// server/src/app.ts
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mais.com',
        'https://widget.mais.com',
      ];

      if (allowed.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);
```

### AFTER: Configurable CORS Origins

```typescript
// server/src/lib/core/config.ts
const configSchema = z.object({
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((o) => o.trim()))
    .default('http://localhost:5173,http://localhost:3000'),
  // ... other config
});

// server/src/services/configuration.service.ts
export class ConfigurationService {
  private corsOrigins: Set<string> = new Set();
  private cache = new Map<string, any>();

  constructor(
    private config: Config,
    private tenantRepo: TenantRepository
  ) {
    this.initializeOrigins();
  }

  private initializeOrigins() {
    // Load from env
    this.config.CORS_ORIGINS.forEach((origin) => this.corsOrigins.add(origin));
  }

  async getTenantOrigins(tenantId: string): Promise<string[]> {
    const cached = this.cache.get(`tenant-origins:${tenantId}`);
    if (cached) return cached;

    const tenant = await this.tenantRepository.findById(tenantId);
    const origins = tenant?.config?.allowedOrigins || [];

    this.cache.set(`tenant-origins:${tenantId}`, origins, 900000); // 15 min
    return origins;
  }

  isCorsOriginAllowed(origin: string | undefined, tenantId?: string): boolean {
    if (!origin) return true; // Allow requests without origin

    // Check default origins
    if (this.corsOrigins.has(origin)) return true;

    // Production: allow all HTTPS
    if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
      return true;
    }

    return false;
  }
}

// server/src/app.ts
const configService = container.get(ConfigurationService);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = configService.isCorsOriginAllowed(origin);
      callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
    },
  })
);
```

---

## 2. Type-Safe JSON Columns - Before & After

### BEFORE: Unsafe JSON Casting

```typescript
// server/src/routes/tenant-admin.routes.ts
async getBranding(req: Request, res: Response): Promise<void> {
  try {
    const tenant = await this.tenantRepository.findById(tenantId);
    // DANGER: No type safety!
    const branding = (tenant.branding as any) || {};

    res.status(200).json({
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      fontFamily: branding.fontFamily,
      logo: branding.logo,
    });
  } catch (error) {
    // ...
  }
}
```

### AFTER: Type-Safe JSON Parsing

```typescript
// server/src/types/branding.ts
import { z } from 'zod';

export const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
}).strict();

export type Branding = z.infer<typeof brandingSchema>;

// server/src/lib/json-parsers.ts
export function parseBranding(data: unknown): Branding {
  try {
    return brandingSchema.parse(data || {});
  } catch (error) {
    logger.warn({ error, data }, 'Invalid branding data, using defaults');
    return {}; // Return empty object for backward compatibility
  }
}

// server/src/routes/tenant-admin.routes.ts
async getBranding(req: Request, res: Response): Promise<void> {
  try {
    const tenant = await this.tenantRepository.findById(tenantId);
    const branding = parseBranding(tenant.branding); // Type-safe!

    res.status(200).json(branding);
  } catch (error) {
    logger.error({ error }, 'Error getting branding');
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## 3. Deprecated Dependencies - Before & After

### BEFORE: Using Deprecated node-cache

```typescript
// server/src/lib/cache.ts
import NodeCache from 'node-cache'; // DEPRECATED - memory leaks!

export class CacheService {
  private cache: NodeCache;

  constructor(ttlSeconds = 300) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false,
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 0);
  }
}
```

### AFTER: Using LRU Cache

```typescript
// server/src/lib/cache.ts
import { LRUCache } from 'lru-cache';

export class CacheService {
  private cache: LRUCache<string, any>;

  constructor(maxSize = 500, ttlMs = 300000) {
    // 5 minutes default
    this.cache = new LRUCache<string, any>({
      max: maxSize, // 500 items max
      ttl: ttlMs,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      updateAgeOnGetWithOptions: true,
      updateAgeOnHasWithOptions: true,
    });

    // Log stats periodically
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        const stats = this.getStats();
        logger.debug(stats, 'Cache statistics');
      }, 60000);
    }
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get(key) as T | undefined;
    if (value !== undefined) {
      logger.debug({ key }, 'Cache HIT');
    } else {
      logger.debug({ key }, 'Cache MISS');
    }
    return value;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      if (ttl) {
        this.cache.set(key, value, { ttl });
      } else {
        this.cache.set(key, value);
      }
      logger.debug({ key }, 'Cache SET');
      return true;
    } catch (error) {
      logger.error({ error, key }, 'Cache SET failed');
      return false;
    }
  }

  del(key: string): number {
    const had = this.cache.has(key) ? 1 : 0;
    this.cache.delete(key);
    if (had) logger.debug({ key }, 'Cache DELETE');
    return had;
  }

  getStats() {
    return {
      size: this.cache.size,
      max: this.cache.max,
      hitRate: this.cache.getRatio ? `${(this.cache.getRatio() * 100).toFixed(2)}%` : 'N/A',
    };
  }
}
```

---

## 4. Request Correlation & Error Context - Before & After

### BEFORE: Lost Error Context

```typescript
// server/src/routes/tenant-admin.routes.ts
async uploadLogo(req: Request, res: Response): Promise<void> {
  try {
    const result = await uploadService.uploadLogo(req.file as any, tenantId);
    res.status(200).json(result);
  } catch (error) {
    // Error context is lost!
    logger.error({ error }, 'Error uploading logo');
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

### AFTER: With Request ID & Error Context

```typescript
// server/src/types/error.ts
import { z } from 'zod';

export interface ErrorContext {
  requestId: string;
  tenantId?: string;
  operation: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public context: ErrorContext
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// server/src/middleware/request-context.ts
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.locals.requestStart = Date.now();

  // Add to logger context
  res.locals.logger = logger.child({ requestId });

  res.on('finish', () => {
    const duration = Date.now() - res.locals.requestStart;
    res.locals.logger.info(
      {
        statusCode: res.statusCode,
        duration,
        path: req.path,
        method: req.method,
      },
      'Request completed'
    );
  });

  next();
}

// server/src/middleware/error-handler.ts
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = res.locals.requestId;
  const logger = res.locals.logger || logger;

  // Handle AppError with context
  if (error instanceof AppError) {
    logger.error(
      {
        error: error.message,
        context: error.context,
        stack: error.stack,
      },
      'AppError occurred'
    );

    return res.status(error.statusCode).json({
      error: error.message,
      requestId,
      ...(process.env.NODE_ENV === 'development' && {
        context: error.context
      }),
    });
  }

  // Handle generic errors
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      requestId,
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: 'Internal server error',
    requestId,
    ...(process.env.NODE_ENV === 'development' && {
      message: error.message
    }),
  });
}

// server/src/routes/tenant-admin.routes.ts
async uploadLogo(req: Request, res: Response): Promise<void> {
  const logger = res.locals.logger;
  const requestId = res.locals.requestId;

  try {
    const tenantId = res.locals.tenantId;

    if (!req.file) {
      throw new AppError('No file uploaded', 400, {
        requestId,
        tenantId,
        operation: 'uploadLogo',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await uploadService.uploadLogo(req.file as any, tenantId);

    logger.info({ filename: result.filename }, 'Logo uploaded successfully');
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      throw error; // Re-throw to error handler
    }

    if (error instanceof Error) {
      throw new AppError(error.message, 400, {
        requestId,
        tenantId: res.locals.tenantId,
        operation: 'uploadLogo',
        timestamp: new Date().toISOString(),
        metadata: { originalError: error.message },
      });
    }

    throw new AppError('Internal server error', 500, {
      requestId,
      operation: 'uploadLogo',
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 5. Centralized Auth Middleware - Before & After

### BEFORE: Repeated Auth Logic

```typescript
// server/src/routes/tenant-admin.routes.ts
router.get('/branding', (req, res) => {
  // Repeated 8+ times!
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  const tenantId = tenantAuth.tenantId;

  // ... actual handler code
});

router.put('/branding', (req, res) => {
  // Repeated 8+ times!
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  const tenantId = tenantAuth.tenantId;

  // ... actual handler code
});
```

### AFTER: Centralized Middleware

```typescript
// server/src/middleware/tenant-auth.ts
import { Request, Response, NextFunction } from 'express';

export interface TenantAuthRequest extends Request {
  tenantId: string;
  tenantAuth: {
    tenantId: string;
    tenantKey: string;
  };
}

export function requireTenantAuth(req: Request, res: Response, next: NextFunction): void {
  const tenantAuth = res.locals.tenantAuth;

  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }

  // Attach to locals for easy access
  res.locals.tenantId = tenantAuth.tenantId;
  res.locals.logger = res.locals.logger?.child({ tenantId: tenantAuth.tenantId });

  next();
}

// server/src/routes/tenant-admin.routes.ts
const router = Router();

// Apply middleware to all routes
router.use(requireTenantAuth);

// Now handlers are clean!
router.get('/branding', (req, res) => {
  const tenantId = res.locals.tenantId;
  // ... actual handler code - no auth check needed
});

router.put('/branding', (req, res) => {
  const tenantId = res.locals.tenantId;
  // ... actual handler code - no auth check needed
});
```

---

## 6. Type-Safe Error Handlers - Before & After

### BEFORE: Type Unsafe

```typescript
// server/src/routes/tenant-admin.routes.ts
function handleMulterError(
  error: any, // Type unsafe!
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large (max 5MB)' });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}
```

### AFTER: Type Safe

```typescript
// server/src/middleware/file-upload.ts
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

export type FileUploadErrorHandler = (
  error: Error | multer.MulterError,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

export const handleFileUploadError: FileUploadErrorHandler = (error, req, res, next): void => {
  const logger = res.locals.logger;

  // Type guard for multer errors
  if (error instanceof multer.MulterError) {
    logger.warn({ code: error.code }, 'Multer error');

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          error: 'File too large (max 5MB)',
          code: 'FILE_SIZE_EXCEEDED',
        });
        return;

      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Too many files',
          code: 'FILE_COUNT_EXCEEDED',
        });
        return;

      case 'LIMIT_FIELD_KEY':
        res.status(400).json({
          error: 'Field name too long',
          code: 'FIELD_NAME_TOO_LONG',
        });
        return;

      case 'LIMIT_FIELD_VALUE':
        res.status(400).json({
          error: 'Field value too long',
          code: 'FIELD_VALUE_TOO_LONG',
        });
        return;

      default:
        res.status(400).json({
          error: error.message,
          code: 'FILE_UPLOAD_ERROR',
        });
        return;
    }
  }

  // Type guard for generic errors
  if (error instanceof Error) {
    logger.error({ message: error.message }, 'File upload error');
    res.status(400).json({
      error: error.message,
      code: 'UPLOAD_ERROR',
    });
    return;
  }

  // Unknown error type
  logger.error({ error }, 'Unknown error in file upload');
  next(error);
};

// server/src/routes/tenant-admin.routes.ts
import { handleFileUploadError } from '../middleware/file-upload';

router.post(
  '/packages/:id/photos',
  uploadPackagePhoto.single('photo'),
  handleFileUploadError, // Now type-safe!
  async (req: Request, res: Response, next: NextFunction) => {
    // Handler logic...
  }
);
```

---

## 7. Configuration Service - Before & After

### BEFORE: Hardcoded Constants

```typescript
// server/src/routes/tenant-admin.routes.ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // MAGIC NUMBER!
  },
});

// server/src/lib/cache.ts
const cacheService = new CacheService(300); // MAGIC NUMBER!

// server/src/middleware/rateLimiter.ts
export const adminLimiter = rateLimit({
  max: 300, // MAGIC NUMBER!
  windowMs: 15 * 60 * 1000,
});
```

### AFTER: Configurable Service

```typescript
// server/src/services/configuration.service.ts
export interface AppConfiguration {
  // File uploads
  logoMaxSizeMB: number;
  packagePhotoMaxSizeMB: number;
  maxPhotosPerPackage: number;

  // Cache
  defaultCacheTTLSeconds: number;
  maxCacheEntries: number;

  // Rate limiting
  globalRequestsPerWindow: number;
  tenantRequestsPerWindow: number;
  rateLimitWindowMs: number;

  // Stripe
  stripeMinFeePercent: number;
  stripeMaxFeePercent: number;
}

export class ConfigurationService {
  private config: AppConfiguration = {
    logoMaxSizeMB: 2,
    packagePhotoMaxSizeMB: 5,
    maxPhotosPerPackage: 5,
    defaultCacheTTLSeconds: 300,
    maxCacheEntries: 500,
    globalRequestsPerWindow: 300,
    tenantRequestsPerWindow: 100,
    rateLimitWindowMs: 15 * 60 * 1000,
    stripeMinFeePercent: 0.5,
    stripeMaxFeePercent: 50,
  };

  constructor(private configRepo: ConfigRepository) {
    this.loadFromDatabase();
  }

  private async loadFromDatabase() {
    try {
      const dbConfig = await this.configRepo.getConfig();
      if (dbConfig) {
        this.config = { ...this.config, ...dbConfig };
        logger.info('Configuration loaded from database');
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to load config from database, using defaults');
    }
  }

  getConfig(): AppConfiguration {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<AppConfiguration>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.configRepo.saveConfig(this.config);
    logger.info(updates, 'Configuration updated');
  }

  getTenantConfig(tenantId: string): Partial<AppConfiguration> {
    // Allow tenants to override certain settings
    return this.configRepo.getTenantConfig(tenantId) || {};
  }
}

// server/src/routes/tenant-admin.routes.ts
const configService = container.get(ConfigurationService);

const uploadConfig = configService.getConfig();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadConfig.logoMaxSizeMB * 1024 * 1024,
  },
});

// server/src/di.ts
const config = container.get(ConfigurationService);
const cacheService = new CacheService(
  config.getConfig().maxCacheEntries,
  config.getConfig().defaultCacheTTLSeconds * 1000
);
```

---

## Summary

These examples show how to fix the most impactful technical debt items. Implementing these patterns will:

1. Enable dynamic configuration for config-driven pivot
2. Provide type safety throughout the codebase
3. Improve production debugging and monitoring
4. Remove deprecated dependencies
5. Reduce code duplication
6. Follow consistent architectural patterns
