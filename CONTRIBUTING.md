# Contributing to MAIS

Thank you for your interest in contributing to MAIS! This guide will help you get started with development and explain our contribution process.

## Table of Contents

- [Welcome](#welcome)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style Requirements](#code-style-requirements)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Getting Help](#getting-help)

## Welcome

We're excited to have you contribute! Whether you're fixing bugs, adding features, or improving documentation, your contributions are valuable.

### Code of Conduct

We expect all contributors to be respectful and professional. Detailed Code of Conduct coming soon.

### Getting Help

- **Questions?** Open a GitHub Discussion or issue with the `question` label
- **Found a bug?** Open an issue with the `bug` label and include reproduction steps
- **Feature ideas?** Open an issue with the `enhancement` label to discuss before implementing

## Development Environment Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** (check with `node --version`)
- **npm 8+** (comes with Node.js, check with `npm --version`)
- **PostgreSQL 14+** (local install or cloud provider)
- **Git** for version control

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/mais.git
   cd mais
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This installs dependencies for all workspaces (server, client, and shared packages).

3. **Set up environment variables**

   ```bash
   cp server/.env.example server/.env
   ```

   Edit `server/.env` and configure:
   - `ADAPTERS_PRESET=mock` (use mock adapters for development)
   - `API_PORT=3001`
   - `CORS_ORIGIN=http://localhost:3000`
   - `JWT_SECRET=your-secret-key-change-in-production`

4. **Set up the database**

   For local PostgreSQL:

   ```bash
   createdb mais_dev
   ```

   Update `DATABASE_URL` in `server/.env`:

   ```bash
   DATABASE_URL="postgresql://username:password@localhost:5432/mais_dev?schema=public"
   ```

   See [SUPABASE.md](./docs/setup/SUPABASE.md) for cloud database setup or [DEVELOPING.md](./DEVELOPING.md) for more details.

5. **Run Prisma migrations**

   ```bash
   cd server
   npm exec prisma migrate dev
   ```

6. **Seed the database**

   ```bash
   cd server
   npm exec prisma db seed
   ```

   This creates:
   - Admin user: `admin@example.com` / password from `ADMIN_DEFAULT_PASSWORD` in `.env`
   - 3 service packages (Basic, Professional, Premium)
   - 4 add-ons (examples for service businesses)
   - Sample blackout date (Dec 25, 2025)

7. **Start development servers**

   ```bash
   # Terminal 1: Start API server (mock mode)
   npm run dev:api

   # Terminal 2: Start web client
   npm run dev:client

   # Or run both together (with Stripe webhook listener)
   npm run dev:all
   ```

8. **Verify setup**
   - API: http://localhost:3001/v1/packages
   - Web: http://localhost:3000

### Database Commands

```bash
# View data in Prisma Studio
cd server && npm exec prisma studio

# Generate Prisma Client after schema changes
cd server && npm run prisma:generate

# Create a new migration
cd server && npm exec prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
cd server && npm exec prisma migrate reset

# Check migration status
cd server && npm exec prisma migrate status
```

## Project Structure

MAIS is a **modular monolith** using npm workspaces with clear separation of concerns.

```
mais/
├── server/                         # Express 4 API (Node.js)
│   ├── src/
│   │   ├── routes/                 # HTTP route handlers (@ts-rest)
│   │   ├── services/               # Business logic (domain services)
│   │   ├── adapters/               # External integrations
│   │   │   ├── prisma/             # Database repositories
│   │   │   ├── stripe/             # Payment provider
│   │   │   ├── postmark/           # Email provider
│   │   │   ├── gcal/               # Google Calendar provider
│   │   │   └── mock/               # Mock implementations
│   │   ├── middleware/             # Express middleware
│   │   ├── lib/
│   │   │   ├── core/               # Config, logger, events, errors
│   │   │   ├── ports.ts            # Repository/provider interfaces
│   │   │   ├── entities.ts         # Domain entities
│   │   │   └── errors.ts           # Domain-specific errors
│   │   ├── di.ts                   # Dependency injection container
│   │   ├── app.ts                  # Express app setup
│   │   └── index.ts                # Server entry point
│   ├── prisma/                     # Database schema & migrations
│   └── test/                       # Unit & integration tests
│
├── client/                         # React 18 + Vite + TailwindCSS
│   ├── src/
│   │   ├── features/               # Feature modules
│   │   │   ├── catalog/            # Package/add-on catalog
│   │   │   ├── booking/            # Booking flow
│   │   │   └── admin/              # Admin dashboard
│   │   ├── pages/                  # Route pages
│   │   ├── ui/                     # Reusable components (shadcn/ui)
│   │   ├── lib/                    # Utilities & API client
│   │   └── app/                    # App shell & routing
│   └── public/                     # Static assets
│
└── packages/                       # Shared packages
    ├── contracts/                  # @ts-rest API contracts (Zod schemas)
    └── shared/                     # Shared utilities (money, dates, Result type)
```

### Key Directories

- **`server/src/routes/`**: HTTP endpoints defined with @ts-rest contracts
- **`server/src/services/`**: Business logic (catalog, booking, availability, identity)
- **`server/src/adapters/`**: External service integrations (Prisma, Stripe, Postmark, Google Calendar)
- **`server/src/lib/ports.ts`**: Interfaces for repositories and providers (dependency inversion)
- **`server/src/di.ts`**: Dependency injection container (wires services with adapters)
- **`client/src/features/`**: Feature-based organization (catalog, booking, admin)
- **`packages/contracts/`**: Single source of truth for API contracts (shared between FE/BE)

## Development Workflow

### 1. Create a Feature Branch

Always work on a feature branch, never commit directly to `main`.

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

- Keep changes focused and small (prefer PRs under 300 lines)
- Write tests for new features or bug fixes
- Update documentation if needed
- Follow the code style guidelines below

### 3. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run --workspace=server test:watch

# Run E2E tests (requires servers running)
npm run test:e2e

# Run with coverage
npm run --workspace=server coverage
```

### 4. Run Type Checking

```bash
npm run typecheck
```

TypeScript errors must be at zero before submitting a PR.

### 5. Run Linter

```bash
npm run lint
```

Fix any linting errors:

```bash
npm run lint -- --fix
```

### 6. Format Code

```bash
npm run format
```

Or check formatting:

```bash
npm run format:check
```

### 7. Commit Your Changes

Use conventional commit format (see [Commit Message Guidelines](#commit-message-guidelines)).

```bash
git add .
git commit -m "feat: add user profile page"
```

### 8. Push and Create Pull Request

```bash
git push origin feat/your-feature-name
```

Then open a Pull Request on GitHub.

## Code Style Requirements

### TypeScript

- **Strict mode enabled**: No `any` types, no `@ts-ignore` comments
- **Explicit return types**: All functions must have explicit return types
- **No non-null assertions**: Avoid `!` operator, handle null/undefined explicitly
- **No unused variables**: Remove unused imports and variables

Example:

```typescript
// Good
export function calculateTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.priceCents, 0);
}

// Bad
export function calculateTotal(items: any) {
  // ❌ No 'any'
  return items.reduce((sum, item) => sum + item.priceCents, 0); // ❌ No return type
}
```

### ESLint Rules

Key ESLint rules enforced (see `.eslintrc.cjs`):

- `@typescript-eslint/explicit-function-return-type: error`
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-non-null-assertion: error`
- `no-console: warn` (only `console.warn` and `console.error` allowed)

### Prettier Formatting

Prettier is configured with these settings:

- Single quotes
- Semicolons
- 2-space indentation
- 100 character line width
- Trailing commas (ES5)

Run `npm run format` before committing.

### Naming Conventions

- **Files**: kebab-case (e.g., `booking.service.ts`, `package-card.tsx`)
- **Classes/Interfaces**: PascalCase (e.g., `BookingService`, `BookingRepository`)
- **Functions/Variables**: camelCase (e.g., `createBooking`, `isAvailable`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_PORT`)
- **Types**: PascalCase with descriptive names (e.g., `CreateBookingDto`, `PackageEntity`)

### JSDoc Requirements

Add JSDoc comments for all public APIs (exported functions, classes, interfaces):

```typescript
/**
 * Checks if a given date is available for booking.
 *
 * @param date - The date to check (YYYY-MM-DD format)
 * @returns Promise resolving to true if available, false otherwise
 * @throws {ValidationError} If date format is invalid
 */
export async function isDateAvailable(date: string): Promise<boolean> {
  // implementation
}
```

### Boundary Rules

Maintain clean architecture boundaries:

- **Services** never import adapters or routes
- **Adapters** never import routes
- **Routes** never reach into adapters directly (use services from DI)
- **Frontend** uses contracts client, never imports from server
- **Backend** controllers use contracts server bindings

### Data Handling

- **Dates**: Always normalize to UTC midnight for booking/availability checks
- **Money**: Always store as `priceCents` (integer), convert to dollars at UI edges
- **Errors**: Throw typed domain errors, HTTP layer maps to status codes

## Testing Requirements

### Test Coverage Expectations

- **New features**: Must include unit tests for business logic
- **Bug fixes**: Include regression test that would have caught the bug
- **Critical paths**: Include integration tests (booking flow, payment, webhooks)
- **Coverage goal**: 80%+ line coverage (check with `npm run coverage`)

### Unit Tests

Use Vitest for unit tests. Test files should live alongside source files or in `test/` directory.

```typescript
// server/test/services/booking.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BookingService } from '../../src/services/booking.service';

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(() => {
    // Setup
    service = new BookingService(/* deps */);
  });

  it('should create a booking for an available date', async () => {
    // Arrange
    const date = '2025-12-15';

    // Act
    const result = await service.createCheckout({ date /* ... */ });

    // Assert
    expect(result.isOk()).toBe(true);
  });
});
```

### Integration Tests

Integration tests verify end-to-end flows with real database (using test DATABASE_URL).

```bash
# Run integration tests
npm run --workspace=server test:integration

# Watch mode
npm run --workspace=server test:integration:watch
```

### E2E Tests

E2E tests use Playwright to test the full user journey.

```bash
# Start API server (Terminal 1)
npm run dev:api

# Run E2E tests (Terminal 2)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed
```

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## Pull Request Process

### PR Title Format

Use conventional commit format:

```
feat: add user profile page
fix: resolve double-booking race condition
docs: update CONTRIBUTING.md with testing section
refactor: extract email templates into separate files
test: add integration tests for webhook handler
```

### PR Description Template

```markdown
## What Changed

Brief description of what you changed and why.

## How to Test

1. Step-by-step instructions to test the changes
2. Expected behavior
3. Edge cases to verify

## Screenshots (if applicable)

Include screenshots for UI changes.

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation updated (if needed)
- [ ] Manual testing completed

## Related Issues

Closes #123
```

### Required Checks

Before your PR can be merged, it must pass:

1. **TypeScript type checking**: `npm run typecheck` must pass
2. **Linting**: `npm run lint` must pass with no errors
3. **Unit tests**: `npm test` must pass with all tests green
4. **Formatting**: `npm run format:check` must pass
5. **E2E tests** (if applicable): `npm run test:e2e` must pass

### Review Process

1. Submit your PR with a clear description
2. Wait for automated checks to pass
3. Request review from maintainers
4. Address feedback by pushing new commits
5. Once approved, a maintainer will merge your PR

### Addressing Feedback

- Be respectful and open to feedback
- Ask questions if feedback is unclear
- Push new commits to address feedback (don't force-push during review)
- Mark conversations as resolved once addressed

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring (no functional changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (updating dependencies, etc.)
- **ci**: CI/CD changes

### Scope (optional)

The scope specifies the area of change:

- `booking`: Booking flow
- `admin`: Admin dashboard
- `catalog`: Package/add-on catalog
- `api`: API routes
- `db`: Database/Prisma changes
- `ui`: UI components
- `deps`: Dependency updates

### Examples

```bash
# Feature with scope
git commit -m "feat(booking): add date validation to booking form"

# Bug fix
git commit -m "fix: resolve race condition in webhook handler"

# Documentation
git commit -m "docs: update README with deployment instructions"

# Refactoring
git commit -m "refactor(api): extract email templates into separate files"

# Multiple lines with body
git commit -m "feat(admin): add blackout date management

- Add create/delete endpoints for blackout dates
- Add UI table to display existing blackout dates
- Add date picker for selecting new blackout dates

Closes #45"

# Breaking change
git commit -m "feat(api)!: change booking API response format

BREAKING CHANGE: Booking API now returns ISO date strings instead of Unix timestamps"
```

### Including Issue Numbers

Reference issues in commit messages:

```bash
git commit -m "fix: resolve double-booking issue

Fixes #123"
```

## Getting Help

### Asking Questions

- **GitHub Discussions**: For general questions and discussions
- **GitHub Issues**: For bug reports and feature requests (use appropriate labels)
- **Documentation**: Check [DEVELOPING.md](./DEVELOPING.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and other docs

### Reporting Bugs

When reporting a bug, include:

1. **Description**: Clear description of the bug
2. **Steps to reproduce**: Numbered steps to reproduce the issue
3. **Expected behavior**: What you expected to happen
4. **Actual behavior**: What actually happened
5. **Environment**: OS, Node.js version, browser (if applicable)
6. **Screenshots**: If applicable
7. **Error logs**: Include relevant error messages

Example:

```markdown
**Description**
Booking form allows selecting past dates

**Steps to Reproduce**

1. Go to booking page
2. Open date picker
3. Select a date in the past
4. Form allows submission

**Expected Behavior**
Past dates should be disabled in the date picker

**Actual Behavior**
Past dates are selectable and form submits successfully

**Environment**

- OS: macOS 14.0
- Node.js: 20.10.0
- Browser: Chrome 120.0
```

### Requesting Features

When requesting a feature, include:

1. **Problem statement**: What problem does this solve?
2. **Proposed solution**: How would you solve it?
3. **Alternatives considered**: What other approaches did you consider?
4. **Additional context**: Any other relevant information

## Additional Resources

- [DEVELOPING.md](./DEVELOPING.md) - Development workflow and commands
- [TESTING.md](./TESTING.md) - Detailed testing guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [CODING_GUIDELINES.md](./CODING_GUIDELINES.md) - Coding standards and patterns
- [SUPABASE.md](./docs/setup/SUPABASE.md) - Database setup and management
- [DECISIONS.md](./DECISIONS.md) - Architectural decision records (ADRs)

## Thank You!

Thank you for contributing to MAIS! Your efforts help make this project better for everyone.
