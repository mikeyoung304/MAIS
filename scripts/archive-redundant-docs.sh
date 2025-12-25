#!/bin/bash
# archive-redundant-docs.sh
# Archives redundant documentation patterns from docs/solutions/
# Run from MAIS root: ./scripts/archive-redundant-docs.sh

set -e

ARCHIVE_DIR="docs/archive/2024-12-solutions-cleanup"
SOLUTIONS_DIR="docs/solutions"

echo "=== MAIS Documentation Cleanup ==="
echo "Archiving redundant documentation patterns..."
echo ""

# Create archive directory
mkdir -p "$ARCHIVE_DIR"

# Count before
BEFORE=$(find "$SOLUTIONS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "Files in docs/solutions before: $BEFORE"
echo ""

# Patterns to archive (redundant meta-documentation)
# These are duplicative INDEX/SUMMARY/PREVENTION/QUICK-REFERENCE versions
declare -a PATTERNS=(
  "*-PREVENTION-*.md"
  "*-INDEX.md"
  "*-SUMMARY.md"
  "*-QUICK-*.md"
  "*-CHECKLIST*.md"
)

# Files to explicitly keep (essential references)
declare -a KEEP_FILES=(
  "PREVENTION-STRATEGIES-INDEX.md"
  "PREVENTION-QUICK-REFERENCE.md"
)

ARCHIVED=0
SKIPPED=0

for pattern in "${PATTERNS[@]}"; do
  for file in $SOLUTIONS_DIR/$pattern; do
    if [[ -f "$file" ]]; then
      filename=$(basename "$file")

      # Check if this file should be kept
      skip=false
      for keep in "${KEEP_FILES[@]}"; do
        if [[ "$filename" == "$keep" ]]; then
          skip=true
          break
        fi
      done

      if [[ "$skip" == true ]]; then
        echo "  Keeping: $filename"
        ((SKIPPED++))
        continue
      fi

      mv "$file" "$ARCHIVE_DIR/"
      ((ARCHIVED++))
      echo "  Archived: $filename"
    fi
  done
done

# Count after
AFTER=$(find "$SOLUTIONS_DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "=== Summary ==="
echo "Archived: $ARCHIVED files"
echo "Skipped (kept): $SKIPPED files"
echo "Before: $BEFORE files in docs/solutions/"
echo "After: $AFTER files in docs/solutions/"
echo "Archive location: $ARCHIVE_DIR/"
echo ""
echo "To undo: mv $ARCHIVE_DIR/*.md $SOLUTIONS_DIR/"
echo ""
echo "Next steps:"
echo "  1. Review archived files: ls $ARCHIVE_DIR/"
echo "  2. Commit changes: git add -A && git commit -m 'docs: archive redundant documentation'"
