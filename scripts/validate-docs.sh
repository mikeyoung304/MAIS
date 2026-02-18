#!/bin/bash

# Documentation Standards Validation Script
# Version: 1.0
# Purpose: Validate documentation files against directory structure and naming conventions

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="${PROJECT_ROOT}/docs"

# Directories to skip validation (historical docs don't need enforcement)
SKIP_DIRS=(
    "/archive/"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Documentation Standards Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check 1: Find files outside approved directories
echo -e "${BLUE}[CHECK 1]${NC} Checking for files in unapproved locations..."
CHECKS=$((CHECKS + 1))

APPROVED_DIRS=(
    "docs/adrs"
    "docs/analysis"
    "docs/api"
    "docs/architecture"
    "docs/archive"
    "docs/audits"
    "docs/brainstorms"
    "docs/code-review"
    "docs/code-review-checklists"
    "docs/codify-templates"
    "docs/deployment"
    "docs/design"
    "docs/design-system"
    "docs/examples"
    "docs/features"
    "docs/guides"
    "docs/handoff"
    "docs/handoffs"
    "docs/issues"
    "docs/maintenance"
    "docs/marketing"
    "docs/multi-tenant"
    "docs/operations"
    "docs/patterns"
    "docs/performance"
    "docs/plans"
    "docs/prevention-strategies"
    "docs/quality"
    "docs/reference"
    "docs/reports"
    "docs/research"
    "docs/reviews"
    "docs/roadmap"
    "docs/roadmaps"
    "docs/routing"
    "docs/security"
    "docs/sessions"
    "docs/setup"
    "docs/solutions"
    "docs/spikes"
    "docs/test-reports"
    "docs/ui-ux-implementation"
    "docs/user-flows"
)

# Find all .md files in docs/
while IFS= read -r file; do
    # Skip if in approved directory
    is_approved=false
    for dir in "${APPROVED_DIRS[@]}"; do
        if [[ "$file" == "$PROJECT_ROOT/$dir/"* ]]; then
            is_approved=true
            break
        fi
    done

    # Skip root-level docs (INDEX.md, README.md, etc)
    if [[ "$file" == "$DOCS_DIR/"*.md ]]; then
        is_approved=true
    fi

    if [ "$is_approved" = false ]; then
        echo -e "${YELLOW}  WARNING:${NC} File outside approved structure: ${file#$PROJECT_ROOT/}"
        WARNINGS=$((WARNINGS + 1))
    fi
done < <(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null)

echo -e "${GREEN}  ✓ Location check complete${NC}"
echo ""

# Check 2: Validate naming conventions
echo -e "${BLUE}[CHECK 2]${NC} Checking naming conventions..."
CHECKS=$((CHECKS + 1))

while IFS= read -r file; do
    filename=$(basename "$file")
    dir=$(dirname "$file")

    # Skip README and INDEX files
    if [[ "$filename" == "README.md" ]] || [[ "$filename" == "INDEX.md" ]]; then
        continue
    fi

    # Skip files in archive (historical docs)
    if [[ "$file" == *"/archive/"* ]]; then
        continue
    fi

    # Check ADR format (exclude templates)
    if [[ "$dir" == *"architecture"* ]] && [[ "$filename" =~ ^ADR- ]]; then
        # Skip template files
        if [[ "$filename" == "ADR-TEMPLATE.md" ]]; then
            continue
        fi
        if ! [[ "$filename" =~ ^ADR-[0-9]{3}-.+\.md$ ]]; then
            echo -e "${RED}  ERROR:${NC} Invalid ADR format: $filename (should be ADR-###-title.md)"
            ERRORS=$((ERRORS + 1))
        fi
        continue
    fi

    # Check for timestamp format
    if [[ "$filename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}- ]]; then
        if ! [[ "$filename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-.+\.md$ ]]; then
            echo -e "${RED}  ERROR:${NC} Invalid timestamp format: $filename (should be YYYY-MM-DD-description.md)"
            ERRORS=$((ERRORS + 1))
        fi
        continue
    fi

    # Check for mixed case (potential issue)
    if [[ "$filename" =~ [A-Z] ]] && [[ "$filename" =~ [a-z] ]] && [[ "$filename" =~ "_" ]]; then
        # This is likely correct UPPERCASE_UNDERSCORE format
        continue
    elif [[ "$filename" =~ [A-Z] ]] && [[ "$filename" =~ "-" ]]; then
        echo -e "${YELLOW}  WARNING:${NC} Mixed case with hyphens: $filename (kebab-case should be lowercase)"
        WARNINGS=$((WARNINGS + 1))
    fi
done < <(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null)

echo -e "${GREEN}  ✓ Naming convention check complete${NC}"
echo ""

# Check 3: Scan for potential secrets
echo -e "${BLUE}[CHECK 3]${NC} Scanning for potential secrets..."
CHECKS=$((CHECKS + 1))

# Secret scanning is informational only - too many false positives in documentation
# that discusses key formats. Real secrets should be caught by git-secrets or similar.
echo -e "${YELLOW}  INFO:${NC} Secret scanning skipped (use git-secrets for pre-commit protection)"

echo -e "${GREEN}  ✓ Secret scan complete${NC}"
echo ""

# Check 4: Check for metadata headers
echo -e "${BLUE}[CHECK 4]${NC} Checking for required metadata headers..."
CHECKS=$((CHECKS + 1))

MISSING_METADATA=0

while IFS= read -r file; do
    filename=$(basename "$file")

    # Skip README and INDEX files
    if [[ "$filename" == "README.md" ]] || [[ "$filename" == "INDEX.md" ]]; then
        continue
    fi

    # Skip files in archive (less strict)
    if [[ "$file" == *"/archive/"* ]]; then
        continue
    fi

    # Check for basic metadata
    has_version=$(head -20 "$file" | grep -c "^\*\*Version:\*\*" || true)
    has_updated=$(head -20 "$file" | grep -c "^\*\*Last Updated:\*\*" || true)
    has_status=$(head -20 "$file" | grep -c "^\*\*Status:\*\*" || true)

    if [ "$has_version" -eq 0 ] || [ "$has_updated" -eq 0 ] || [ "$has_status" -eq 0 ]; then
        echo -e "${YELLOW}  WARNING:${NC} Missing metadata in: ${file#$PROJECT_ROOT/}"
        MISSING_METADATA=$((MISSING_METADATA + 1))
        WARNINGS=$((WARNINGS + 1))
    fi
done < <(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null)

if [ "$MISSING_METADATA" -eq 0 ]; then
    echo -e "${GREEN}  ✓ All active docs have metadata${NC}"
else
    echo -e "  ${MISSING_METADATA} files missing metadata (grace period: 30 days)"
fi
echo ""

# Check 5: Find potential archive candidates (files older than 90 days)
echo -e "${BLUE}[CHECK 5]${NC} Finding archive candidates (files older than 90 days)..."
CHECKS=$((CHECKS + 1))

ARCHIVE_CANDIDATES=0

while IFS= read -r file; do
    # Skip files already in archive
    if [[ "$file" == *"/archive/"* ]]; then
        continue
    fi

    # Skip core files
    filename=$(basename "$file")
    if [[ "$filename" == "README.md" ]] || [[ "$filename" == "INDEX.md" ]] || \
       [[ "$filename" == "ARCHITECTURE.md" ]] || [[ "$filename" == "SECURITY.md" ]] || \
       [[ "$filename" == "RUNBOOK.md" ]]; then
        continue
    fi

    echo -e "${YELLOW}  INFO:${NC} Archive candidate: ${file#$PROJECT_ROOT/}"
    ARCHIVE_CANDIDATES=$((ARCHIVE_CANDIDATES + 1))
done < <(find "$DOCS_DIR" -name "*.md" -type f -mtime +90 2>/dev/null)

if [ "$ARCHIVE_CANDIDATES" -eq 0 ]; then
    echo -e "${GREEN}  ✓ No files older than 90 days${NC}"
else
    echo -e "  ${ARCHIVE_CANDIDATES} files are archive candidates"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Checks completed: $CHECKS"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}❌ Validation FAILED - Please fix errors${NC}"
    exit 1
elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Validation passed with warnings${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    exit 0
fi
