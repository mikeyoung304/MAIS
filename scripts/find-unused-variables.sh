#!/bin/bash
# scripts/find-unused-variables.sh
# Find and categorize unused variables before they cause production build failures
#
# Usage:
#   ./scripts/find-unused-variables.sh           # Check all workspaces
#   ./scripts/find-unused-variables.sh apps/web  # Check specific workspace
#   ./scripts/find-unused-variables.sh --fix     # Show fix suggestions

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SHOW_FIX=false
TARGET_DIR=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --fix)
      SHOW_FIX=true
      ;;
    *)
      TARGET_DIR="$arg"
      ;;
  esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  TypeScript Unused Variable Finder${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to check a directory
check_directory() {
  local dir=$1
  local name=$2

  echo -e "${YELLOW}Checking $name...${NC}"

  if [ ! -d "$dir" ]; then
    echo -e "${RED}  Directory not found: $dir${NC}"
    return 1
  fi

  # Run tsc with strict unused checks
  local output
  output=$(cd "$dir" && npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1) || true

  # Filter for unused variable errors
  local unused_locals=$(echo "$output" | grep -c "TS6133" || echo 0)
  local unused_params=$(echo "$output" | grep -c "TS6196" || echo 0)
  local total=$((unused_locals + unused_params))

  if [ "$total" -eq 0 ]; then
    echo -e "${GREEN}  No unused variables found${NC}"
    return 0
  fi

  echo -e "${RED}  Found $total unused variable(s):${NC}"
  echo -e "    - Unused locals (TS6133): $unused_locals"
  echo -e "    - Unused parameters (TS6196): $unused_params"
  echo ""

  # Show details
  echo "$output" | grep "TS6133\|TS6196" | head -20

  if [ "$total" -gt 20 ]; then
    echo -e "${YELLOW}  ... and $((total - 20)) more${NC}"
  fi

  echo ""
  return 1
}

# Function to show fix suggestions
show_fix_suggestions() {
  echo -e "${BLUE}============================================${NC}"
  echo -e "${BLUE}  Fix Suggestions${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo ""

  echo -e "${GREEN}Decision Tree for Underscore Prefix:${NC}"
  echo ""
  echo "  Is the variable used ANYWHERE in the function body?"
  echo "  |"
  echo "  +-- YES (used in logger, assignment, conditional, template)"
  echo "  |   --> DO NOT prefix with _ (it's not unused!)"
  echo "  |"
  echo "  +-- NO (truly never referenced)"
  echo "      |"
  echo "      +-- Is it a required callback parameter?"
  echo "      |   --> Prefix with _ (e.g., arr.map((_item, index) => index))"
  echo "      |"
  echo "      +-- Otherwise"
  echo "          --> REMOVE IT entirely"
  echo ""

  echo -e "${GREEN}Common Fix Examples:${NC}"
  echo ""
  echo "  // WRONG: error IS used (passed to logger)"
  echo "  catch (_error) {"
  echo "    logger.error({ _error }, 'Failed');  // Using _error!"
  echo "  }"
  echo ""
  echo "  // CORRECT: error is used, no prefix needed"
  echo "  catch (error) {"
  echo "    logger.error({ error }, 'Failed');"
  echo "  }"
  echo ""
  echo "  // CORRECT: truly unused callback param"
  echo "  array.map((_item, index) => index);"
  echo ""
  echo "  // CORRECT: remove unused instead of prefixing"
  echo "  const { id, name } = entity;  // Only destructure what you use"
  echo ""

  echo -e "${YELLOW}Documentation:${NC}"
  echo "  docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md"
  echo ""
}

# Main logic
if [ -n "$TARGET_DIR" ] && [ "$TARGET_DIR" != "--fix" ]; then
  # Check specific directory
  check_directory "$TARGET_DIR" "$TARGET_DIR"
  result=$?
else
  # Check all workspaces
  result=0

  check_directory "server" "server" || result=1
  echo ""

  check_directory "client" "client" || result=1
  echo ""

  check_directory "apps/web" "apps/web (Next.js)" || result=1
  echo ""

  check_directory "packages/contracts" "packages/contracts" || result=1
  echo ""

  check_directory "packages/shared" "packages/shared" || result=1
fi

# Show fix suggestions if requested or if errors found
if [ "$SHOW_FIX" = true ] || [ "$result" -ne 0 ]; then
  show_fix_suggestions
fi

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

if [ "$result" -eq 0 ]; then
  echo -e "${GREEN}All checks passed! No unused variables found.${NC}"
else
  echo -e "${RED}Unused variables found. Fix before pushing to avoid build failures.${NC}"
  echo ""
  echo "Commands to fix:"
  echo "  1. npm run typecheck            # Find all issues"
  echo "  2. Review each error carefully"
  echo "  3. Use the decision tree above"
  echo "  4. Test: npm run verify-nextjs  # Verify Next.js build"
fi

echo ""
exit $result
