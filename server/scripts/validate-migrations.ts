/**
 * Validates migration file naming conventions.
 * Run on pre-commit for any migration changes.
 *
 * Fails if:
 * - Duplicate base numbers without suffixes (01, 01 - not 01, 01a)
 * - Rollback files exist (use forward migrations instead)
 *
 * @see docs/solutions/database-issues/MIGRATION_ROLLBACK_ANTIPATTERN.md
 * @see CLAUDE.md pitfall #53
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, '../prisma/migrations');

interface FileInfo {
  file: string;
  suffix: string;
}

function validateMigrations(): void {
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{2}[a-z]?_.*\.sql$/.test(f))
    .sort();

  const errors: string[] = [];

  // Check 1: No rollback files
  const rollbacks = sqlFiles.filter((f) => f.toLowerCase().includes('rollback'));
  if (rollbacks.length > 0) {
    errors.push(
      `❌ Rollback files found (use forward migrations instead):\n` +
        rollbacks.map((f) => `   - ${f}`).join('\n')
    );
  }

  // Check 2: No duplicate base numbers without suffixes
  const baseNumbers = new Map<string, FileInfo[]>();
  for (const file of sqlFiles) {
    if (file.toLowerCase().includes('rollback')) continue;

    const match = file.match(/^(\d{2})([a-z])?_/);
    if (match) {
      const base = match[1];
      const suffix = match[2] || '';

      if (!baseNumbers.has(base)) baseNumbers.set(base, []);
      baseNumbers.get(base)!.push({ file, suffix });
    }
  }

  for (const [num, files] of baseNumbers) {
    const withoutSuffix = files.filter((f) => !f.suffix);
    if (withoutSuffix.length > 1) {
      errors.push(
        `❌ Duplicate migration number ${num} without suffixes:\n` +
          files.map((f) => `   - ${f.file}`).join('\n') +
          `\n   Use suffixes like ${num}a_, ${num}b_ to differentiate`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n🚨 Migration validation failed:\n');
    errors.forEach((e) => console.error(e + '\n'));
    process.exit(1);
  }

  console.log('✅ Migration validation passed');
  console.log(`   ${sqlFiles.length} migration files checked`);
}

validateMigrations();
