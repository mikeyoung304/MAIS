#!/bin/bash
# detect-completed-todos.sh
# Detects pending todos that have fix markers in the codebase
# Automatically marks them as complete when evidence is found
#
# Detection patterns:
# - "P1-XXX", "P2-XXX", "P3-XXX" comments referencing the issue ID
# - "TODO-XXX" comments referencing the issue ID
# - "✅" fix markers with issue references
#
# Usage:
#   ./scripts/detect-completed-todos.sh         # Dry run
#   ./scripts/detect-completed-todos.sh --fix   # Mark as complete

set -e

TODOS_DIR="todos"
DRY_RUN=true

if [[ "$1" == "--fix" ]]; then
  DRY_RUN=false
fi

echo "========================================"
echo "Completed Todo Detector"
echo "========================================"
echo ""

if $DRY_RUN; then
  echo "Mode: DRY RUN (use --fix to mark as complete)"
else
  echo "Mode: FIX (will mark completed todos)"
fi
echo ""

DETECTED=0
ALREADY_COMPLETE=0
STILL_PENDING=0

# Get all pending todos
for file in "$TODOS_DIR"/*-pending-*.md; do
  [[ -f "$file" ]] || continue

  filename=$(basename "$file")

  # Extract issue ID from filename
  if [[ "$filename" =~ ^([0-9]+)-pending-p[0-3]-.* ]]; then
    issue_id="${BASH_REMATCH[1]}"
  else
    continue
  fi

  # Extract priority from filename
  if [[ "$filename" =~ -pending-(p[0-3])- ]]; then
    priority="${BASH_REMATCH[1]}"
  else
    priority="p2"
  fi

  # Search for fix markers in codebase
  # Look for patterns like: P1-580, TODO-580, (P1-580), etc.
  pattern="(P[0-3]|TODO|DONE|FIX|FIXED)-${issue_id}[^0-9]"

  if grep -rE "$pattern" server/src/ apps/ 2>/dev/null | head -1 > /dev/null; then
    ((DETECTED++))
    matches=$(grep -rE "$pattern" server/src/ apps/ 2>/dev/null | head -3)

    echo "✅ COMPLETED: $filename"
    echo "   Evidence found in codebase:"
    echo "$matches" | sed 's/^/   /'

    if ! $DRY_RUN; then
      # Rename file: pending → complete
      new_filename="${filename/pending/complete}"

      # Update YAML status
      sed -i '' "s/^status: *pending/status: complete/" "$file"

      # Rename file
      git mv "$TODOS_DIR/$filename" "$TODOS_DIR/$new_filename" 2>/dev/null || mv "$TODOS_DIR/$filename" "$TODOS_DIR/$new_filename"
      echo "   → Marked as complete: $new_filename"
    fi
    echo ""
  else
    ((STILL_PENDING++))
  fi
done

echo "========================================"
echo "Summary"
echo "========================================"
echo "✅ Detected as completed: $DETECTED"
echo "⏳ Still pending:         $STILL_PENDING"
echo ""

if [[ $DETECTED -gt 0 ]] && $DRY_RUN; then
  echo "Run with --fix to mark detected todos as complete"
fi

exit 0
