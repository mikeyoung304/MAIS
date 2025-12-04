#!/usr/bin/env tsx

/**
 * Environment configuration doctor
 *
 * Validates required environment variables per ADAPTERS_PRESET mode.
 * - Mock mode: warnings only (exits 0)
 * - Real mode: exits 1 if required vars are missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Color helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function color(text: string, code: string): string {
  return `${code}${text}${colors.reset}`;
}

interface EnvCheck {
  key: string;
  required: boolean;
  feature: string;
  description: string;
}

const CORE_CHECKS: EnvCheck[] = [
  {
    key: 'ADAPTERS_PRESET',
    required: false, // has default
    feature: 'Core',
    description: 'Adapter mode (mock or real)',
  },
  {
    key: 'JWT_SECRET',
    required: true,
    feature: 'Core',
    description: 'JWT signing secret (MUST change in production)',
  },
  {
    key: 'API_PORT',
    required: false,
    feature: 'Core',
    description: 'API server port (default: 3001)',
  },
  {
    key: 'CORS_ORIGIN',
    required: false,
    feature: 'Core',
    description: 'CORS origin (default: http://localhost:5173)',
  },
];

const DATABASE_CHECKS: EnvCheck[] = [
  {
    key: 'DATABASE_URL',
    required: true,
    feature: 'Database',
    description: 'PostgreSQL connection string',
  },
];

const STRIPE_CHECKS: EnvCheck[] = [
  {
    key: 'STRIPE_SECRET_KEY',
    required: true,
    feature: 'Stripe',
    description: 'Stripe API secret key',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    feature: 'Stripe',
    description: 'Stripe webhook signing secret',
  },
  {
    key: 'STRIPE_SUCCESS_URL',
    required: false,
    feature: 'Stripe',
    description: 'Payment success redirect URL',
  },
  {
    key: 'STRIPE_CANCEL_URL',
    required: false,
    feature: 'Stripe',
    description: 'Payment cancel redirect URL',
  },
];

const POSTMARK_CHECKS: EnvCheck[] = [
  {
    key: 'POSTMARK_SERVER_TOKEN',
    required: false,
    feature: 'Postmark',
    description: 'Email API token (fallback: file-sink)',
  },
  {
    key: 'POSTMARK_FROM_EMAIL',
    required: false,
    feature: 'Postmark',
    description: 'From email address',
  },
];

const GCAL_CHECKS: EnvCheck[] = [
  {
    key: 'GOOGLE_CALENDAR_ID',
    required: false,
    feature: 'Google Calendar',
    description: 'Calendar ID (fallback: mock calendar)',
  },
  {
    key: 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',
    required: false,
    feature: 'Google Calendar',
    description: 'Base64 service account JSON',
  },
];

function loadEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.log(color('\n⚠️  .env file not found at server/.env', colors.yellow));
    console.log(
      color('   Copy server/.env.example to server/.env to get started.\n', colors.yellow)
    );
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  }

  return env;
}

interface CheckResult {
  key: string;
  status: 'ok' | 'missing' | 'empty';
  required: boolean;
  description: string;
}

function checkGroup(
  env: Record<string, string>,
  checks: EnvCheck[],
  mode: 'mock' | 'real'
): CheckResult[] {
  return checks.map((check) => {
    const value = env[check.key];
    const isEmpty = !value || value.trim() === '';

    return {
      key: check.key,
      status: isEmpty ? (value === undefined ? 'missing' : 'empty') : 'ok',
      required: mode === 'real' ? check.required : false,
      description: check.description,
    };
  });
}

function printGroup(title: string, results: CheckResult[]): void {
  console.log(color(`\n${title}:`, colors.bold + colors.cyan));

  for (const result of results) {
    const icon = result.status === 'ok' ? '✓' : result.required ? '✗' : '⚠';
    const iconColor =
      result.status === 'ok' ? colors.green : result.required ? colors.red : colors.yellow;
    const label = result.required ? ' [REQUIRED]' : ' [optional]';
    const labelColor = result.required ? colors.red : colors.yellow;

    console.log(`  ${color(icon, iconColor)} ${result.key}${color(label, labelColor)}`);
    console.log(`    ${result.description}`);

    if (result.status !== 'ok') {
      const message = result.status === 'empty' ? 'Set but empty' : 'Not set';
      const messageColor = result.required ? colors.red : colors.yellow;
      console.log(`    ${color(message, messageColor)}`);
    }
  }
}

function main() {
  console.log(color('\n🏥 Environment Configuration Doctor\n', colors.bold + colors.cyan));
  console.log('Checking environment variables...\n');

  const env = loadEnvFile();

  if (Object.keys(env).length === 0) {
    console.log(
      color('No environment variables found. Create server/.env to continue.\n', colors.yellow)
    );
    process.exit(1);
  }

  const mode = (env.ADAPTERS_PRESET || 'mock') as 'mock' | 'real';
  console.log(`Mode: ${color(mode.toUpperCase(), mode === 'real' ? colors.green : colors.cyan)}`);

  // Check all groups
  const coreResults = checkGroup(env, CORE_CHECKS, mode);
  const dbResults = mode === 'real' ? checkGroup(env, DATABASE_CHECKS, mode) : [];
  const stripeResults = mode === 'real' ? checkGroup(env, STRIPE_CHECKS, mode) : [];
  const postmarkResults = mode === 'real' ? checkGroup(env, POSTMARK_CHECKS, mode) : [];
  const gcalResults = mode === 'real' ? checkGroup(env, GCAL_CHECKS, mode) : [];

  // Print results
  printGroup('Core Configuration', coreResults);

  if (mode === 'real') {
    printGroup('Database (PostgreSQL)', dbResults);
    printGroup('Payment Processing (Stripe)', stripeResults);
    printGroup('Email (Postmark)', postmarkResults);
    printGroup('Calendar Integration (Google Calendar)', gcalResults);
  } else {
    console.log(
      color(
        '\n📝 Mock mode active - database, Stripe, Postmark, and Google Calendar not required',
        colors.cyan
      )
    );
  }

  // Collect all results
  const allResults = [
    ...coreResults,
    ...dbResults,
    ...stripeResults,
    ...postmarkResults,
    ...gcalResults,
  ];

  // Count issues
  const requiredMissing = allResults.filter((r) => r.required && r.status !== 'ok');
  const optionalMissing = allResults.filter((r) => !r.required && r.status !== 'ok');

  console.log(color('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan));

  if (requiredMissing.length > 0) {
    console.log(
      color(
        `\n❌ ${requiredMissing.length} required variable(s) missing:`,
        colors.bold + colors.red
      )
    );
    for (const result of requiredMissing) {
      console.log(color(`   - ${result.key}`, colors.red));
    }
    console.log(color('\nFix these issues before running in real mode.', colors.red));
    console.log(color('See SECRETS.md for details on each variable.\n', colors.yellow));

    if (mode === 'real') {
      process.exit(1);
    }
  } else {
    console.log(color('\n✅ All required variables are set!', colors.bold + colors.green));
  }

  if (optionalMissing.length > 0) {
    console.log(
      color(
        `\n⚠️  ${optionalMissing.length} optional variable(s) missing (graceful fallbacks active):`,
        colors.yellow
      )
    );
    for (const result of optionalMissing) {
      console.log(color(`   - ${result.key}`, colors.yellow));
    }
  }

  console.log(color('\n💡 Run `npm run dev:api` to start the API server', colors.cyan));
  console.log(color('   See RUNBOOK.md for more troubleshooting help.\n', colors.cyan));
}

main();
