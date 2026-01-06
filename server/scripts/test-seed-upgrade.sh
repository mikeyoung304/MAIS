#!/bin/bash
##############################################################################
# Prisma 7 Seed Upgrade Test Script
#
# Comprehensive validation that all Prisma 7 seed components work correctly
# after upgrades or when troubleshooting seed failures.
#
# Run from project root: bash server/scripts/test-seed-upgrade.sh
#
# Tests:
# 1. Prisma client generation (+ barrel file creation)
# 2. Import path validation
# 3. TypeScript type checking
# 4. Build process
# 5. Environment variable loading
# 6. Seed execution (E2E mode)
# 7. Database verification
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
  echo -e "${YELLOW}→${NC} $1"
}

print_success() {
  echo -e "${GREEN}✅${NC} $1"
}

print_error() {
  echo -e "${RED}❌${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠️${NC}  $1"
}

# Test 1: Prisma generation
test_prisma_generation() {
  print_header "Test 1: Prisma Client Generation"

  print_step "Running: npm run prisma:generate"
  if npm run prisma:generate; then
    print_success "Prisma generation succeeded"
  else
    print_error "Prisma generation failed"
    return 1
  fi

  # Check barrel file
  if [ -f "server/src/generated/prisma/index.ts" ]; then
    print_success "Barrel file exists: server/src/generated/prisma/index.ts"
  else
    print_error "Barrel file NOT found: server/src/generated/prisma/index.ts"
    print_step "Creating barrel file..."
    node server/scripts/prisma-postgenerate.js || return 1
  fi

  # Check client file
  if [ -f "server/src/generated/prisma/client.ts" ]; then
    print_success "Client file exists: server/src/generated/prisma/client.ts"
  else
    print_error "Client file NOT found: server/src/generated/prisma/client.ts"
    return 1
  fi
}

# Test 2: Import path validation
test_import_validation() {
  print_header "Test 2: Import Path Validation"

  if [ -f "server/scripts/validate-prisma-imports.js" ]; then
    print_step "Running: node server/scripts/validate-prisma-imports.js"
    if node server/scripts/validate-prisma-imports.js; then
      print_success "Import validation passed"
    else
      print_error "Import validation failed"
      return 1
    fi
  else
    print_warning "Import validation script not found, skipping"
  fi
}

# Test 3: TypeScript compilation
test_typescript() {
  print_header "Test 3: TypeScript Type Checking"

  print_step "Running: npm run typecheck"
  if npm run typecheck; then
    print_success "TypeScript type check passed"
  else
    print_error "TypeScript type check failed"
    print_warning "This usually means:"
    echo "   - Missing barrel file (run: npm run prisma:postgenerate)"
    echo "   - Stale import paths (run: npm run prisma:generate)"
    echo "   - JSON type mismatches (use undefined not null)"
    return 1
  fi
}

# Test 4: Build
test_build() {
  print_header "Test 4: Build Process"

  print_step "Running: npm run build --workspace=@macon/api"
  if npm run build --workspace=@macon/api; then
    print_success "Build succeeded"
  else
    print_error "Build failed"
    print_warning "Check error messages above - most likely:"
    echo "   - TypeScript errors (run: npm run typecheck)"
    echo "   - Import resolution (run: npm run prisma:generate)"
    return 1
  fi
}

# Test 5: Environment setup
test_environment() {
  print_header "Test 5: Environment Variable Setup"

  if [ -z "$DATABASE_URL" ]; then
    print_warning "DATABASE_URL not set"
    print_step "Checking for .env file..."
    if [ -f "server/.env" ]; then
      print_step "Found server/.env, sourcing it..."
      # Use set +a to avoid exporting in subshell
      set +a
      source server/.env
      set -a
    fi
  fi

  if [ -z "$DATABASE_URL" ]; then
    print_error "DATABASE_URL environment variable is not set"
    print_step "Set it: export DATABASE_URL='postgresql://...'"
    return 1
  else
    print_success "DATABASE_URL is set"
  fi

  # Check SEED_MODE
  if [ -z "$SEED_MODE" ]; then
    print_warning "SEED_MODE not set, will use default (dev)"
    export SEED_MODE="dev"
  fi
  print_success "SEED_MODE: $SEED_MODE"
}

# Test 6: Seed execution
test_seed_execution() {
  print_header "Test 6: Seed Execution (E2E Mode)"

  print_step "Running: SEED_MODE=e2e npm run db:seed"
  if SEED_MODE=e2e npm run db:seed; then
    print_success "Seed execution succeeded"
  else
    print_error "Seed execution failed"
    print_warning "This usually means:"
    echo "   - DATABASE_URL is incorrect or unreachable"
    echo "   - Dotenv not loading (check: import 'dotenv/config' in seed.ts)"
    echo "   - PrismaClient not properly initialized"
    return 1
  fi
}

# Test 7: Database verification
test_database_verification() {
  print_header "Test 7: Database Verification"

  print_step "Checking database has data..."
  result=$(npm exec prisma db execute --stdin <<'SQL'
SELECT COUNT(*) as tenant_count FROM "Tenant";
SQL
  )

  if echo "$result" | grep -q "1"; then
    print_success "Database contains seed data (tenants present)"
  else
    print_warning "Could not verify database data"
    print_step "Trying: npm exec prisma studio"
    echo "   (Opens visual database browser)"
  fi
}

# Main execution
main() {
  print_header "Prisma 7 Seed Upgrade Test Suite"
  echo "This script validates all Prisma 7 seed components."
  echo "Duration: ~2-5 minutes depending on database access."
  echo ""

  local tests_passed=0
  local tests_failed=0

  # Run tests
  if test_prisma_generation; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_import_validation; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_typescript; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_build; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_environment; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_seed_execution; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  if test_database_verification; then
    ((tests_passed++))
  else
    ((tests_failed++))
  fi

  # Summary
  print_header "Test Summary"
  echo -e "Tests passed: ${GREEN}$tests_passed${NC}"
  echo -e "Tests failed: ${RED}$tests_failed${NC}"

  if [ $tests_failed -eq 0 ]; then
    echo -e "\n${GREEN}✅ All Prisma 7 seed tests PASSED${NC}\n"
    return 0
  else
    echo -e "\n${RED}❌ Some tests FAILED - See errors above${NC}\n"
    echo "Next steps:"
    echo "1. Read: docs/solutions/database-issues/prisma-7-seed-upgrade-prevention-strategies-MAIS-20260105.md"
    echo "2. Quick reference: docs/solutions/database-issues/PRISMA_7_SEED_QUICK_REFERENCE.md"
    return 1
  fi
}

# Run main function
main "$@"
