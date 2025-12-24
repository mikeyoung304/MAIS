#!/usr/bin/env tsx

/**
 * Database Connection Diagnostic Tool
 *
 * Checks DNS resolution, IPv4/IPv6 connectivity, and database connection.
 * Use this to debug database connection issues, especially with Supabase.
 *
 * Usage: npm run db:diagnose
 */

import * as dns from 'dns';
import { promisify } from 'util';
import { URL } from 'url';
import { exec } from 'child_process';

const lookup = promisify(dns.lookup);
const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const execAsync = promisify(exec);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function color(text: string, code: string): string {
  return `${code}${text}${colors.reset}`;
}

function printSection(title: string): void {
  console.log(color(`\n${title}:`, colors.bold + colors.cyan));
}

function printSuccess(message: string): void {
  console.log(color(`  ✓ ${message}`, colors.green));
}

function printWarning(message: string): void {
  console.log(color(`  ⚠ ${message}`, colors.yellow));
}

function printError(message: string): void {
  console.log(color(`  ✗ ${message}`, colors.red));
}

function printInfo(message: string): void {
  console.log(color(`  → ${message}`, colors.cyan));
}

function printDetail(message: string): void {
  console.log(color(`    ${message}`, colors.dim));
}

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string[];
}

const results: DiagnosticResult[] = [];

async function checkDatabaseUrl(): Promise<URL | null> {
  printSection('Database URL Validation');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    printError('DATABASE_URL is not set');
    printDetail('Set DATABASE_URL in your .env file or environment');
    results.push({
      category: 'URL',
      status: 'fail',
      message: 'DATABASE_URL not set',
    });
    return null;
  }

  try {
    const url = new URL(databaseUrl);
    printSuccess('DATABASE_URL parsed successfully');
    printDetail(`Protocol: ${url.protocol.replace(':', '')}`);
    printDetail(`Host: ${url.hostname}`);
    printDetail(`Port: ${url.port || '5432 (default)'}`);
    printDetail(`Database: ${url.pathname.slice(1) || 'postgres (default)'}`);
    printDetail(`User: ${url.username || '(not specified)'}`);

    // Check for recommended parameters
    const params = url.searchParams;
    const hasTimeout = params.has('connect_timeout');
    const hasSsl = params.has('sslmode');
    const hasPgbouncer = params.has('pgbouncer');

    if (!hasTimeout) {
      printWarning('Missing connect_timeout parameter');
      printDetail('Add ?connect_timeout=10 to prevent hanging on network issues');
      results.push({
        category: 'URL',
        status: 'warn',
        message: 'Missing connect_timeout parameter',
      });
    }

    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && !hasSsl) {
      printWarning('Missing sslmode parameter for remote connection');
      printDetail('Add &sslmode=require for secure connections');
      results.push({
        category: 'URL',
        status: 'warn',
        message: 'Missing sslmode for remote connection',
      });
    }

    // Supabase-specific checks
    if (url.hostname.includes('supabase.co')) {
      printInfo('Detected Supabase connection');

      if (!url.hostname.includes('pooler.supabase.com')) {
        printWarning('Using direct connection instead of connection pooler');
        printDetail('Direct connections may have IPv6 issues');
        printDetail('Consider using: aws-0-[region].pooler.supabase.com:6543');
        results.push({
          category: 'URL',
          status: 'warn',
          message: 'Not using Supabase connection pooler',
          details: [
            'Direct connections may have IPv6 issues',
            'Use pooler.supabase.com for better reliability',
          ],
        });
      } else {
        printSuccess('Using Supabase connection pooler');
        if (!hasPgbouncer) {
          printWarning('Missing pgbouncer=true parameter');
          printDetail('Add &pgbouncer=true for proper pooler behavior');
        }
      }
    }

    results.push({
      category: 'URL',
      status: 'pass',
      message: 'DATABASE_URL is valid',
    });

    return url;
  } catch (err) {
    printError(
      `Invalid DATABASE_URL format: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    results.push({
      category: 'URL',
      status: 'fail',
      message: 'Invalid DATABASE_URL format',
    });
    return null;
  }
}

async function checkDnsResolution(host: string): Promise<void> {
  printSection('DNS Resolution');

  if (host === 'localhost' || host === '127.0.0.1') {
    printSuccess('Using localhost (no DNS resolution needed)');
    printInfo('This is the most reliable configuration');
    results.push({
      category: 'DNS',
      status: 'pass',
      message: 'Using localhost - no DNS issues possible',
    });
    return;
  }

  // IPv4 resolution
  try {
    const ipv4Addresses = await resolve4(host);
    printSuccess(`IPv4 (A) records: ${ipv4Addresses.join(', ')}`);
    results.push({
      category: 'DNS',
      status: 'pass',
      message: `IPv4 resolved: ${ipv4Addresses[0]}`,
    });
  } catch {
    printWarning('No IPv4 (A) records found');
    results.push({
      category: 'DNS',
      status: 'warn',
      message: 'No IPv4 records',
    });
  }

  // IPv6 resolution
  try {
    const ipv6Addresses = await resolve6(host);
    printSuccess(`IPv6 (AAAA) records: ${ipv6Addresses.join(', ')}`);

    // Check if system prefers IPv6
    try {
      const systemPref = await lookup(host);
      if (systemPref.family === 6) {
        printWarning('System prefers IPv6');
        printDetail('If connections fail, your network may not support IPv6');
        printDetail('Consider using Supabase connection pooler or local PostgreSQL');
        results.push({
          category: 'DNS',
          status: 'warn',
          message: 'System prefers IPv6 - may cause issues',
        });
      }
    } catch {
      // Ignore lookup errors here
    }
  } catch {
    printInfo('No IPv6 (AAAA) records (this is usually fine)');
  }

  // System's preferred resolution
  try {
    const result = await lookup(host);
    printInfo(`System resolves to: ${result.address} (IPv${result.family})`);
  } catch (err) {
    printError(`DNS lookup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    results.push({
      category: 'DNS',
      status: 'fail',
      message: 'DNS lookup failed',
    });
  }
}

async function checkNetworkConnectivity(): Promise<void> {
  printSection('Network Connectivity');

  // Check IPv4 connectivity
  try {
    await execAsync('curl -4 https://google.com --max-time 5 -s -o /dev/null -w "%{http_code}"');
    printSuccess('IPv4 internet connectivity available');
  } catch {
    printWarning('IPv4 internet connectivity not available');
    results.push({
      category: 'Network',
      status: 'warn',
      message: 'IPv4 internet not available',
    });
  }

  // Check IPv6 connectivity
  try {
    await execAsync('curl -6 https://ipv6.google.com/ --max-time 5 -s -o /dev/null');
    printSuccess('IPv6 network connectivity available');
  } catch {
    printInfo('IPv6 network not available');
    printDetail('This is common and usually not a problem');
    printDetail('Ensure your DATABASE_URL uses a host that resolves to IPv4');
    results.push({
      category: 'Network',
      status: 'warn',
      message: 'IPv6 not available (usually fine)',
    });
  }
}

async function checkDatabaseConnection(url: URL): Promise<void> {
  printSection('Database Connection Test');

  const databaseUrl = url.toString();

  // Dynamically import PrismaClient to avoid compilation issues if not generated
  try {
    const { PrismaClient } = await import('../src/generated/prisma');

    const prisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log: [], // Suppress Prisma logs
    });

    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1 as connected`;
      const latency = Date.now() - startTime;

      printSuccess(`Connected successfully (${latency}ms latency)`);
      results.push({
        category: 'Connection',
        status: 'pass',
        message: `Connected in ${latency}ms`,
      });

      // Additional database checks
      try {
        const tableCount = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count
          FROM information_schema.tables
          WHERE table_schema = 'public'
        `;
        printInfo(`Database has ${tableCount[0].count} public tables`);
      } catch {
        printDetail('Could not count tables (permission issue or empty database)');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      printError(`Connection failed: ${errorMessage}`);

      results.push({
        category: 'Connection',
        status: 'fail',
        message: 'Database connection failed',
        details: [errorMessage],
      });

      // Provide specific remediation advice
      printSection('Remediation Suggestions');

      if (errorMessage.includes('ENETUNREACH') || errorMessage.includes('ETIMEDOUT')) {
        if (errorMessage.includes('::') || errorMessage.includes('2607:')) {
          printError('IPv6 connectivity issue detected');
          printDetail('Your network cannot reach the database via IPv6');
          console.log('');
          printInfo('Solutions:');
          printDetail('1. Use Supabase connection pooler: aws-0-[region].pooler.supabase.com:6543');
          printDetail('2. Use local PostgreSQL: postgresql://localhost/mais_dev');
          printDetail('3. Check VPN/firewall IPv6 settings');
        } else {
          printError('Network timeout');
          printDetail('Cannot reach database host');
          console.log('');
          printInfo('Solutions:');
          printDetail('1. Check internet connection');
          printDetail('2. Check firewall rules');
          printDetail('3. Verify Supabase project is active');
        }
      } else if (errorMessage.includes('ENOTFOUND')) {
        printError('DNS resolution failed');
        console.log('');
        printInfo('Solutions:');
        printDetail('1. Check internet connection');
        printDetail('2. Check DNS settings');
        printDetail('3. Disconnect VPN and retry');
        printDetail('4. Verify hostname is correct');
      } else if (errorMessage.includes('authentication')) {
        printError('Authentication failed');
        console.log('');
        printInfo('Solutions:');
        printDetail('1. Verify DATABASE_URL password is correct');
        printDetail('2. Check username matches Supabase project');
        printDetail('3. Reset database password in Supabase dashboard');
      } else if (errorMessage.includes('SSL')) {
        printError('SSL/TLS error');
        console.log('');
        printInfo('Solutions:');
        printDetail('1. Add sslmode=require to DATABASE_URL');
        printDetail('2. Or use sslmode=disable for local development');
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (importErr) {
    printError('Could not import Prisma Client');
    printDetail('Run: npm run prisma:generate');
    results.push({
      category: 'Connection',
      status: 'fail',
      message: 'Prisma Client not generated',
    });
  }
}

function printSummary(): void {
  console.log(color('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan));
  printSection('Summary');

  const failed = results.filter((r) => r.status === 'fail');
  const warnings = results.filter((r) => r.status === 'warn');
  const passed = results.filter((r) => r.status === 'pass');

  if (failed.length > 0) {
    printError(`${failed.length} critical issue(s) found`);
    failed.forEach((r) => {
      printDetail(`${r.category}: ${r.message}`);
      r.details?.forEach((d) => printDetail(`  - ${d}`));
    });
  }

  if (warnings.length > 0) {
    printWarning(`${warnings.length} warning(s)`);
    warnings.forEach((r) => {
      printDetail(`${r.category}: ${r.message}`);
    });
  }

  if (passed.length > 0) {
    printSuccess(`${passed.length} check(s) passed`);
  }

  console.log('');

  if (failed.length === 0 && warnings.length === 0) {
    console.log(color('✅ Database connectivity looks good!', colors.bold + colors.green));
  } else if (failed.length === 0) {
    console.log(
      color('⚠️  Connection works but there are some recommendations above.', colors.yellow)
    );
  } else {
    console.log(color('❌ Database connection has issues. See remediation above.', colors.red));
  }

  console.log('');
  console.log(color('📚 For more help, see:', colors.dim));
  console.log(
    color('   docs/solutions/database-issues/SUPABASE_IPV6_QUICK_REFERENCE.md', colors.dim)
  );
}

async function main() {
  console.log(color('\n🔍 Database Connection Diagnostic\n', colors.bold + colors.cyan));
  console.log(
    color('This tool checks your database connectivity and helps debug issues.\n', colors.dim)
  );

  // Step 1: Check DATABASE_URL
  const url = await checkDatabaseUrl();

  if (!url) {
    printSummary();
    process.exit(1);
  }

  // Step 2: Check DNS resolution
  await checkDnsResolution(url.hostname);

  // Step 3: Check network connectivity
  await checkNetworkConnectivity();

  // Step 4: Test actual database connection
  await checkDatabaseConnection(url);

  // Print summary
  printSummary();

  // Exit with appropriate code
  const failed = results.filter((r) => r.status === 'fail');
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(color(`\n❌ Diagnostic failed: ${err.message}`, colors.red));
  process.exit(1);
});
