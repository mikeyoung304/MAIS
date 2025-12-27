#!/bin/bash

# TypeScript Build & Seed Configuration Prevention Verification Script
# Purpose: Verify all prevention strategies are in place and working
# Usage: ./scripts/verify-typescript-prevention.sh

# Note: We don't use set -e because bash arithmetic returns exit code 1 when
# incrementing from 0, and we want to continue checking all items regardless

echo "════════════════════════════════════════════════════════════════"
echo "TypeScript Build & Seed Configuration Prevention Verification"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to print test result
print_result() {
  local test_name=$1
  local result=$2

  if [ $result -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $test_name"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}✗${NC} $test_name"
    ((CHECKS_FAILED++))
  fi
}

# Function to check file exists
check_file_exists() {
  local file=$1
  if [ -f "$file" ]; then
    return 0
  else
    return 1
  fi
}

echo "1. Checking Prevention Strategy Documents..."
echo ""

check_file_exists "docs/solutions/TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md"
print_result "Comprehensive prevention strategy exists" $?

check_file_exists "docs/solutions/TYPESCRIPT-BUILD-QUICK-REFERENCE.md"
print_result "Quick reference guide exists" $?

check_file_exists "docs/solutions/TYPESCRIPT-BUILD-CODE-REVIEW-CHECKLIST.md"
print_result "Code review checklist exists" $?

check_file_exists "docs/solutions/TYPESCRIPT-AND-SEED-PREVENTION-INDEX.md"
print_result "Prevention index exists" $?

echo ""
echo "2. Checking TypeScript Configuration..."
echo ""

# Check for strict mode in tsconfig.json
if grep -q '"strict": true' server/tsconfig.json; then
  echo -e "${GREEN}✓${NC} TypeScript strict mode enabled"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} TypeScript strict mode not enabled"
  ((CHECKS_FAILED++))
fi

# Check for noUnusedParameters
if grep -q '"noUnusedParameters": true' server/tsconfig.json; then
  echo -e "${GREEN}✓${NC} noUnusedParameters check enabled"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} noUnusedParameters check not enabled"
  ((CHECKS_FAILED++))
fi

# Check for noImplicitAny (implied by strict: true)
if grep -q '"noImplicitAny": true' server/tsconfig.json; then
  echo -e "${GREEN}✓${NC} noImplicitAny check explicitly enabled"
  ((CHECKS_PASSED++))
elif grep -q '"strict": true' server/tsconfig.json; then
  echo -e "${GREEN}✓${NC} noImplicitAny enabled via strict mode"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} noImplicitAny check not enabled"
  ((CHECKS_FAILED++))
fi

echo ""
echo "3. Checking Seed Configuration..."
echo ""

# Check platform seed has ADMIN_EMAIL validation
if grep -q "if (!adminEmail)" server/prisma/seeds/platform.ts; then
  echo -e "${GREEN}✓${NC} platform.ts has ADMIN_EMAIL validation"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} platform.ts missing ADMIN_EMAIL validation"
  ((CHECKS_FAILED++))
fi

# Check platform seed has ADMIN_DEFAULT_PASSWORD validation
if grep -q "if (!adminPassword)" server/prisma/seeds/platform.ts; then
  echo -e "${GREEN}✓${NC} platform.ts has ADMIN_DEFAULT_PASSWORD validation"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} platform.ts missing ADMIN_DEFAULT_PASSWORD validation"
  ((CHECKS_FAILED++))
fi

# Check .env.example exists
check_file_exists ".env.example"
print_result ".env.example exists" $?

# Check .env.example has ADMIN_EMAIL
if grep -q "ADMIN_EMAIL" .env.example 2>/dev/null; then
  echo -e "${GREEN}✓${NC} .env.example documents ADMIN_EMAIL"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} .env.example missing ADMIN_EMAIL"
  ((CHECKS_FAILED++))
fi

echo ""
echo "4. Checking Prisma Configuration..."
echo ""

# Check Prisma schema exists
check_file_exists "server/prisma/schema.prisma"
print_result "Prisma schema exists" $?

# Check Prisma migration directory exists
if [ -d "server/prisma/migrations" ]; then
  MIGRATION_COUNT=$(ls -1 server/prisma/migrations | grep -c "^[0-9]" || echo 0)
  echo -e "${GREEN}✓${NC} Prisma migrations directory exists (${MIGRATION_COUNT} migrations)"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} Prisma migrations directory not found"
  ((CHECKS_FAILED++))
fi

echo ""
echo "5. Running TypeScript Checks..."
echo ""

# Check if TypeScript builds without errors
echo "Running: npm run typecheck"
if npm run typecheck > /tmp/typecheck.log 2>&1; then
  echo -e "${GREEN}✓${NC} TypeScript typecheck passes"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗${NC} TypeScript typecheck failed"
  echo "   Run: npm run typecheck"
  tail -5 /tmp/typecheck.log | sed 's/^/   /'
  ((CHECKS_FAILED++))
fi

echo ""
echo "6. Checking Seed Files..."
echo ""

# Check all seed files exist
for seed_file in platform e2e demo; do
  check_file_exists "server/prisma/seeds/${seed_file}.ts"
  print_result "Seed file exists: ${seed_file}.ts" $?
done

# Check seed files don't use console.log
if ! grep -r "console\.log" server/prisma/seeds/ > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Seed files don't use console.log"
  ((CHECKS_PASSED++))
else
  CONSOLE_COUNT=$(grep -r "console\.log" server/prisma/seeds/ | wc -l)
  echo -e "${RED}✗${NC} Seed files have console.log calls (${CONSOLE_COUNT} found)"
  ((CHECKS_FAILED++))
fi

# Check seed files use proper logger
if grep -r "import.*logger" server/prisma/seeds/ > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Seed files use structured logger"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}!${NC} Seed files should use structured logger (optional)"
fi

echo ""
echo "7. Checking Documentation Links..."
echo ""

# Check if CLAUDE.md references prevention strategies
if grep -q "PREVENTION-STRATEGIES" CLAUDE.md 2>/dev/null; then
  echo -e "${GREEN}✓${NC} CLAUDE.md references prevention strategies"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}!${NC} CLAUDE.md doesn't reference prevention strategies (optional)"
fi

# Check if README mentions these guides
if [ -f "README.md" ] && grep -q "TYPESCRIPT\|seed configuration" README.md 2>/dev/null; then
  echo -e "${GREEN}✓${NC} README documents TypeScript/seed prevention"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}!${NC} README could reference prevention guides (optional)"
fi

echo ""
echo "8. Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "Checks Passed: ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "Checks Failed: ${RED}${CHECKS_FAILED}${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All prevention strategies verified!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review the prevention guides: docs/solutions/"
  echo "  2. Share Quick Reference with team"
  echo "  3. Add Code Review Checklist to PR template"
  echo "  4. Set up pre-commit hooks"
  echo ""
  exit 0
else
  echo -e "${RED}Some checks failed. Please review above.${NC}"
  echo ""
  echo "Recommended fixes:"
  if [ $CHECKS_FAILED -gt 0 ]; then
    echo "  1. Run npm run typecheck to fix TypeScript errors"
    echo "  2. Check seed file validation and documentation"
    echo "  3. Ensure .env.example has all required variables"
  fi
  echo ""
  exit 1
fi
