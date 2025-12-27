#!/bin/bash
# scripts/verify-nextjs-build.sh
# Pre-deployment verification for Next.js monorepo
# Simulates Vercel's clean build environment

set -e

echo "========================================"
echo "  Next.js Monorepo Build Verification"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track warnings
WARNINGS=0

# Step 1: Clean all build artifacts
echo -e "${YELLOW}Step 1: Cleaning build artifacts...${NC}"
echo "   - Removing packages/*/dist"
echo "   - Removing packages/*/.tsbuildinfo"
echo "   - Removing apps/web/.next"
rm -rf packages/*/dist packages/*/.tsbuildinfo apps/web/.next
echo -e "${GREEN}Done${NC}"
echo ""

# Step 2: Verify workspace configuration
echo -e "${YELLOW}Step 2: Verifying workspace configuration...${NC}"

# Check root package.json has workspaces
if grep -q '"workspaces"' package.json; then
  echo -e "${GREEN}   Workspaces defined in root package.json${NC}"
else
  echo -e "${RED}   ERROR: No workspaces defined in root package.json${NC}"
  exit 1
fi

# Check vercel-build script exists
if grep -q '"vercel-build"' package.json; then
  echo -e "${GREEN}   vercel-build script found${NC}"
else
  echo -e "${RED}   ERROR: vercel-build script not found in root package.json${NC}"
  exit 1
fi

# Check Next.js config has transpilePackages
if grep -q 'transpilePackages' apps/web/next.config.js 2>/dev/null; then
  echo -e "${GREEN}   transpilePackages configured in next.config.js${NC}"
else
  echo -e "${YELLOW}   WARNING: transpilePackages may not be configured${NC}"
  ((WARNINGS++))
fi

echo ""

# Step 3: Build workspace packages
echo -e "${YELLOW}Step 3: Building workspace packages...${NC}"

echo "   Building @macon/contracts..."
npm run build -w @macon/contracts

if [ ! -f packages/contracts/dist/index.js ]; then
  echo -e "${RED}   ERROR: packages/contracts/dist/index.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}   @macon/contracts built successfully${NC}"

echo "   Building @macon/shared..."
npm run build -w @macon/shared

if [ ! -f packages/shared/dist/index.js ]; then
  echo -e "${RED}   ERROR: packages/shared/dist/index.js not found${NC}"
  exit 1
fi
echo -e "${GREEN}   @macon/shared built successfully${NC}"
echo ""

# Step 4: Build Next.js app
echo -e "${YELLOW}Step 4: Building Next.js app...${NC}"
cd apps/web
npm run build

if [ ! -d .next ]; then
  echo -e "${RED}   ERROR: apps/web/.next directory not found${NC}"
  exit 1
fi
echo -e "${GREEN}   Next.js build successful${NC}"
cd ../..
echo ""

# Step 5: Run ESLint on Next.js app
echo -e "${YELLOW}Step 5: Running ESLint on Next.js app...${NC}"
if npm run lint:web 2>/dev/null; then
  echo -e "${GREEN}   ESLint passed${NC}"
else
  echo -e "${YELLOW}   WARNING: ESLint issues found - review before deploy${NC}"
  ((WARNINGS++))
fi
echo ""

# Step 6: TypeScript type checking
echo -e "${YELLOW}Step 6: Running TypeScript type checking...${NC}"
cd apps/web
if npm run typecheck 2>/dev/null; then
  echo -e "${GREEN}   TypeScript type checking passed${NC}"
else
  echo -e "${YELLOW}   WARNING: TypeScript issues found${NC}"
  ((WARNINGS++))
fi
cd ../..
echo ""

# Step 7: Verify vercel.json configuration
echo -e "${YELLOW}Step 7: Checking vercel.json...${NC}"

VERCEL_JSON=""
if [ -f apps/web/vercel.json ]; then
  VERCEL_JSON="apps/web/vercel.json"
  echo "   Found vercel.json in apps/web/"
elif [ -f vercel.json ]; then
  VERCEL_JSON="vercel.json"
  echo "   Found vercel.json in repo root"
else
  echo -e "${YELLOW}   WARNING: No vercel.json found${NC}"
  ((WARNINGS++))
fi

if [ -n "$VERCEL_JSON" ]; then
  if grep -q '"framework": "nextjs"' "$VERCEL_JSON"; then
    echo -e "${GREEN}   Framework correctly set to nextjs${NC}"
  else
    echo -e "${YELLOW}   WARNING: Framework may not be set to nextjs${NC}"
    ((WARNINGS++))
  fi
fi
echo ""

# Step 8: Verify build outputs
echo -e "${YELLOW}Step 8: Verifying build outputs...${NC}"

verify_file() {
  local file=$1
  local description=$2

  if [ -f "$file" ]; then
    local size=$(ls -lh "$file" | awk '{print $5}')
    echo -e "${GREEN}   $description ($size)${NC}"
  elif [ -d "$file" ]; then
    echo -e "${GREEN}   $description (directory exists)${NC}"
  else
    echo -e "${RED}   $description not found${NC}"
    exit 1
  fi
}

verify_file "packages/contracts/dist/index.js" "contracts/dist/index.js"
verify_file "packages/contracts/dist/index.d.ts" "contracts/dist/index.d.ts"
verify_file "packages/shared/dist/index.js" "shared/dist/index.js"
verify_file "packages/shared/dist/index.d.ts" "shared/dist/index.d.ts"
verify_file "apps/web/.next" "apps/web/.next"
echo ""

# Summary
echo "========================================"
if [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}  All verification checks passed!${NC}"
else
  echo -e "${YELLOW}  Verification complete with $WARNINGS warning(s)${NC}"
fi
echo "========================================"
echo ""

echo -e "${BLUE}Build outputs verified:${NC}"
echo "   - packages/contracts/dist/index.js"
echo "   - packages/shared/dist/index.js"
echo "   - apps/web/.next/"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "   1. Review any warnings above"
echo "   2. Push to trigger Vercel deployment"
echo "   3. Monitor Vercel build logs"
echo "   4. Verify production deployment"
echo ""

exit 0
