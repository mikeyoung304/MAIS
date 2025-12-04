/**
 * OpenAPI/Swagger documentation generation
 *
 * Manual OpenAPI spec since @ts-rest/open-api has compatibility issues with Zod v4
 */

import type { OpenAPIV3 } from 'openapi-types';

/**
 * OpenAPI 3.0 specification for MAIS API
 */
export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'MAIS API',
    version: '1.0.0',
    description: `
# MAIS API

API for managing business growth packages, bookings, add-ons, and payments.

## Authentication

Admin endpoints require JWT authentication. Include the JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

To obtain a token, use the \`POST /v1/admin/login\` endpoint.

## Error Responses

All error responses follow this format:

\`\`\`json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
\`\`\`

### Common Error Codes

- \`VALIDATION_ERROR\` (400) - Request validation failed
- \`UNAUTHORIZED\` (401) - Authentication required or invalid credentials
- \`FORBIDDEN\` (403) - Insufficient permissions
- \`NOT_FOUND\` (404) - Resource not found
- \`CONFLICT\` (409) - Resource conflict (e.g., date already booked)
- \`UNPROCESSABLE_ENTITY\` (422) - Request cannot be processed
- \`INTERNAL_ERROR\` (500) - Internal server error

## Rate Limiting

- Public endpoints: 100 requests per 15 minutes per IP
- Admin endpoints: 20 requests per 15 minutes per IP

## Webhooks

The \`POST /v1/webhooks/stripe\` endpoint handles Stripe payment events. It requires a raw body and validates the Stripe signature.
    `.trim(),
    contact: {
      name: 'MAIS Support',
      email: 'support@maconaisolutions.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
    {
      url: 'https://api.maconaisolutions.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /v1/admin/login',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error code',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'Invalid request body',
          },
        },
        required: ['error'],
      },
      AddOn: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          packageId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
          title: { type: 'string', example: 'Professional Photography' },
          priceCents: { type: 'integer', example: 50000, description: 'Price in cents' },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
        required: ['id', 'packageId', 'title', 'priceCents'],
      },
      Package: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
          slug: { type: 'string', example: 'intimate-ceremony' },
          title: { type: 'string', example: 'Intimate Ceremony' },
          description: { type: 'string', example: 'A beautiful intimate wedding ceremony' },
          priceCents: { type: 'integer', example: 150000, description: 'Price in cents' },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
          addOns: {
            type: 'array',
            items: { $ref: '#/components/schemas/AddOn' },
          },
        },
        required: ['id', 'slug', 'title', 'description', 'priceCents', 'addOns'],
      },
      Availability: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            example: '2024-06-15',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          available: { type: 'boolean', example: true },
          reason: { type: 'string', enum: ['booked', 'blackout', 'calendar'], example: 'booked' },
        },
        required: ['date', 'available'],
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174002' },
          packageId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
          coupleName: { type: 'string', example: 'John & Jane Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          phone: { type: 'string', example: '+1-555-123-4567' },
          eventDate: {
            type: 'string',
            format: 'date',
            example: '2024-06-15',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          addOnIds: { type: 'array', items: { type: 'string' } },
          totalCents: { type: 'integer', example: 200000, description: 'Total price in cents' },
          status: { type: 'string', enum: ['PAID', 'REFUNDED', 'CANCELED'], example: 'PAID' },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
        },
        required: [
          'id',
          'packageId',
          'coupleName',
          'email',
          'eventDate',
          'addOnIds',
          'totalCents',
          'status',
          'createdAt',
        ],
      },
      CreateCheckoutRequest: {
        type: 'object',
        properties: {
          packageId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
          eventDate: {
            type: 'string',
            format: 'date',
            example: '2024-06-15',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          coupleName: { type: 'string', example: 'John & Jane Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          addOnIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['packageId', 'eventDate', 'coupleName', 'email'],
      },
      CheckoutResponse: {
        type: 'object',
        properties: {
          checkoutUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://checkout.stripe.com/pay/cs_test_...',
          },
        },
        required: ['checkoutUrl'],
      },
      AdminLoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', example: 'securepassword123' },
        },
        required: ['email', 'password'],
      },
      AdminLoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        },
        required: ['token'],
      },
      Blackout: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            example: '2024-12-25',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          reason: { type: 'string', example: 'Holiday closure' },
        },
        required: ['date'],
      },
      CreatePackageRequest: {
        type: 'object',
        properties: {
          slug: { type: 'string', example: 'intimate-ceremony', minLength: 1 },
          title: { type: 'string', example: 'Intimate Ceremony', minLength: 1 },
          description: {
            type: 'string',
            example: 'A beautiful intimate wedding ceremony',
            minLength: 1,
          },
          priceCents: { type: 'integer', example: 150000, minimum: 0 },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
        required: ['slug', 'title', 'description', 'priceCents'],
      },
      UpdatePackageRequest: {
        type: 'object',
        properties: {
          slug: { type: 'string', example: 'intimate-ceremony', minLength: 1 },
          title: { type: 'string', example: 'Intimate Ceremony', minLength: 1 },
          description: {
            type: 'string',
            example: 'A beautiful intimate wedding ceremony',
            minLength: 1,
          },
          priceCents: { type: 'integer', example: 150000, minimum: 0 },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
      },
      PackageResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
          slug: { type: 'string', example: 'intimate-ceremony' },
          title: { type: 'string', example: 'Intimate Ceremony' },
          description: { type: 'string', example: 'A beautiful intimate wedding ceremony' },
          priceCents: { type: 'integer', example: 150000 },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
        required: ['id', 'slug', 'title', 'description', 'priceCents'],
      },
      CreateAddOnRequest: {
        type: 'object',
        properties: {
          packageId: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174001',
            minLength: 1,
          },
          title: { type: 'string', example: 'Professional Photography', minLength: 1 },
          priceCents: { type: 'integer', example: 50000, minimum: 0 },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
        required: ['packageId', 'title', 'priceCents'],
      },
      UpdateAddOnRequest: {
        type: 'object',
        properties: {
          packageId: {
            type: 'string',
            example: '123e4567-e89b-12d3-a456-426614174001',
            minLength: 1,
          },
          title: { type: 'string', example: 'Professional Photography', minLength: 1 },
          priceCents: { type: 'integer', example: 50000, minimum: 0 },
          photoUrl: { type: 'string', format: 'uri', example: 'https://example.com/photo.jpg' },
        },
      },
    },
  },
  paths: {
    '/v1/packages': {
      get: {
        operationId: 'getPackages',
        summary: 'Get all packages',
        tags: ['Packages'],
        responses: {
          '200': {
            description: 'List of all packages',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Package' },
                },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/packages/{slug}': {
      get: {
        operationId: 'getPackageBySlug',
        summary: 'Get package by slug',
        tags: ['Packages'],
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'intimate-ceremony',
          },
        ],
        responses: {
          '200': {
            description: 'Package details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Package' },
              },
            },
          },
          '404': {
            description: 'Package not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/availability': {
      get: {
        operationId: 'getAvailability',
        summary: 'Check availability for a date',
        tags: ['Availability'],
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            example: '2024-06-15',
            description: 'Date in YYYY-MM-DD format',
          },
        ],
        responses: {
          '200': {
            description: 'Availability information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Availability' },
              },
            },
          },
          '400': {
            description: 'Invalid date format',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/bookings/checkout': {
      post: {
        operationId: 'createCheckout',
        summary: 'Create a checkout session',
        tags: ['Bookings'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCheckoutRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Checkout session created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CheckoutResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Date already booked',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: 'CONFLICT',
                  message: 'Date 2024-06-15 is already booked',
                },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/bookings/{id}': {
      get: {
        operationId: 'getBookingById',
        summary: 'Get booking by ID',
        tags: ['Bookings'],
        description: 'Public endpoint for confirmation page',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174002',
          },
        ],
        responses: {
          '200': {
            description: 'Booking details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Booking' },
              },
            },
          },
          '404': {
            description: 'Booking not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/webhooks/stripe': {
      post: {
        operationId: 'stripeWebhook',
        summary: 'Handle Stripe webhook',
        tags: ['Webhooks'],
        description:
          'Endpoint for Stripe payment events. Requires raw body and Stripe signature validation.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' },
              example: {
                type: 'checkout.session.completed',
                data: {
                  object: {
                    id: 'cs_test_...',
                  },
                },
              },
            },
          },
        },
        responses: {
          '204': {
            description: 'Webhook processed successfully',
          },
          '400': {
            description: 'Invalid webhook signature',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Webhook processing error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/login': {
      post: {
        operationId: 'adminLogin',
        summary: 'Admin login',
        tags: ['Admin'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AdminLoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminLoginResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: 'UNAUTHORIZED',
                  message: 'Invalid email or password',
                },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/bookings': {
      get: {
        operationId: 'adminGetBookings',
        summary: 'Get all bookings',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of all bookings',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Booking' },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/blackouts': {
      get: {
        operationId: 'adminGetBlackouts',
        summary: 'Get all blackout dates',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of blackout dates',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Blackout' },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      post: {
        operationId: 'adminCreateBlackout',
        summary: 'Create a blackout date',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Blackout' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Blackout created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/packages': {
      post: {
        operationId: 'adminCreatePackage',
        summary: 'Create a new package',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePackageRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Package created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PackageResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/packages/{id}': {
      put: {
        operationId: 'adminUpdatePackage',
        summary: 'Update a package',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174001',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePackageRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Package updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PackageResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Package not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        operationId: 'adminDeletePackage',
        summary: 'Delete a package',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174001',
          },
        ],
        responses: {
          '204': {
            description: 'Package deleted',
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Package not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/packages/{packageId}/addons': {
      post: {
        operationId: 'adminCreateAddOn',
        summary: 'Create a new add-on for a package',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'packageId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174001',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateAddOnRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Add-on created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddOn' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Package not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/v1/admin/addons/{id}': {
      put: {
        operationId: 'adminUpdateAddOn',
        summary: 'Update an add-on',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateAddOnRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Add-on updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddOn' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Add-on not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        operationId: 'adminDeleteAddOn',
        summary: 'Delete an add-on',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
        ],
        responses: {
          '204': {
            description: 'Add-on deleted',
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Add-on not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Packages', description: 'Wedding package management' },
    { name: 'Availability', description: 'Date availability checking' },
    { name: 'Bookings', description: 'Booking and checkout operations' },
    { name: 'Webhooks', description: 'External webhook handlers' },
    { name: 'Admin', description: 'Administrative operations (requires authentication)' },
  ],
};
