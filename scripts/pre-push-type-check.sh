#!/bin/bash
# Pre-push hook: Prevent known type safety mistakes
# Place in: .git/hooks/pre-push (make executable with chmod +x)
#
# This script prevents common TypeScript mistakes before pushing:
# 1. Removing ts-rest `any` types (causes build failure)
# 2. Removing necessary type guards
# 3. Introducing unsafe type assertions
#
# Usage: Automatically runs before `git push`

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "Running pre-push type safety checks..."

# Get the range of commits being pushed
REMOTE="$1"
LOCAL_REF="$2"
REMOTE_REF="$3"
REMOTE_URL="$4"

# Compare against main branch (adjust if using different base)
BASE="main"

# Check if remote exists
if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Base branch '$BASE' not found, skipping pre-push checks${NC}"
  exit 0
fi

echo "Checking changes against $BASE..."

# 1. Check for ts-rest `any` removals
echo ""
echo "1. Checking for ts-rest handler type changes..."
TSREST_ISSUES=$(git diff "$BASE"...HEAD -- 'server/src/routes/index.ts' | grep "^-.*{ req: any" || true)

if [ ! -z "$TSREST_ISSUES" ]; then
  echo -e "${RED}ERROR: Detected removal of ts-rest 'req: any' type${NC}"
  echo "This will cause TS2345 build errors!"
  echo ""
  echo "DO NOT REMOVE this type. ts-rest v3 has type compatibility issues with Express."
  echo "See: docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md"
  echo ""
  echo "Changes:"
  echo "$TSREST_ISSUES"
  echo ""
  echo -e "${RED}Push blocked.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ No ts-rest handler changes detected${NC}"

# 2. Check for suspicious `as any` additions
echo ""
echo "2. Checking for unsafe type assertions..."
UNSAFE_ASSERTIONS=$(git diff "$BASE"...HEAD -- 'server/src/**/*.ts' | grep "^\+.*as any" | grep -v "// ts-rest" || true)

if [ ! -z "$UNSAFE_ASSERTIONS" ]; then
  echo -e "${YELLOW}WARNING: Detected 'as any' type assertion${NC}"
  echo "Consider using type guards instead:"
  echo "  - Use 'if (x instanceof Type)' for class instances"
  echo "  - Use 'type predicate' functions for custom types"
  echo "  - Use 'as unknown as Type' if casting is necessary"
  echo ""
  echo "Found:"
  echo "$UNSAFE_ASSERTIONS"
  echo ""
  echo -e "${YELLOW}Continue with: git push --no-verify${NC}"
  echo ""
  # Don't block, just warn (use --no-verify to skip)
fi

# 3. Check that TypeScript still builds
echo ""
echo "3. Running TypeScript type check..."
if npm run typecheck >/dev/null 2>&1; then
  echo -e "${GREEN}✓ TypeScript build successful${NC}"
else
  echo -e "${RED}ERROR: TypeScript build failed${NC}"
  echo "Run 'npm run typecheck' locally to see full errors"
  echo ""
  echo "Common issues:"
  echo "  - ts-rest 'req: any' was removed (see error 1 above)"
  echo "  - Type mismatch in route handlers"
  echo "  - Missing type imports"
  echo ""
  echo "Fix errors and try again, or use: git push --no-verify"
  exit 1
fi

# 4. Check for missing documentation on `any` types
echo ""
echo "4. Checking for documented `any` types..."
ANY_WITHOUT_COMMENT=$(git diff "$BASE"...HEAD -- 'server/src/**/*.ts' | \
  grep "^\+.*: any" | \
  grep -v "// " | \
  grep -v "/\* " || true)

if [ ! -z "$ANY_WITHOUT_COMMENT" ]; then
  echo -e "${YELLOW}WARNING: Found 'any' types without inline documentation${NC}"
  echo "Please add a comment explaining why the type is 'any'"
  echo ""
  echo "Example:"
  echo "  // ts-rest v3 type compatibility issue, DO NOT REMOVE"
  echo "  const value: any = req.body;"
  echo ""
  echo "Found:"
  echo "$ANY_WITHOUT_COMMENT"
  echo ""
  echo -e "${YELLOW}Review warnings and continue with: git push --no-verify${NC}"
fi

echo ""
echo -e "${GREEN}✓ Pre-push checks passed${NC}"
exit 0
