#!/bin/bash
# align-todo-status.sh
# Standardizes todos to compound engineering 3-status system
# Scans todos for misalignment and automatically fixes them
#
# COMPOUND ENGINEERING STATUS SYSTEM:
#   pending  - New finding, needs triage/decision
#   ready    - Approved by manager, ready to work
#   complete - Work finished
#   deferred - Intentionally postponed (with reason)
#
# LEGACY STATUS MAPPING:
#   completed, done, resolved → complete
#   open → pending
#   skip → deferred
#
# Usage:
#   ./scripts/align-todo-status.sh         # Dry run (report only)
#   ./scripts/align-todo-status.sh --fix   # Rename files + update YAML

set -e

TODOS_DIR="todos"
DRY_RUN=true

if [[ "$1" == "--fix" ]]; then
  DRY_RUN=false
fi

# Map any status to compound engineering standard
normalize_status() {
  local status="$1"
  case "$status" in
    pending)    echo "pending" ;;
    ready)      echo "ready" ;;
    complete)   echo "complete" ;;
    deferred)   echo "deferred" ;;
    # Legacy mappings
    completed)  echo "complete" ;;
    done)       echo "complete" ;;
    resolved)   echo "complete" ;;
    open)       echo "pending" ;;
    skip)       echo "deferred" ;;
    *)          echo "$status" ;; # Unknown - keep as-is
  esac
}

echo "========================================"
echo "Todo Status Alignment Scanner"
echo "Compound Engineering 3-Status System"
echo "========================================"
echo ""
echo "Valid statuses: pending, ready, complete, deferred"
echo ""

if $DRY_RUN; then
  echo "Mode: DRY RUN (use --fix to apply changes)"
else
  echo "Mode: FIX (will rename files + update YAML)"
fi
echo ""

MISALIGNED=0
ALIGNED=0
SKIPPED=0
YAML_ONLY=0

for file in "$TODOS_DIR"/*.md; do
  filename=$(basename "$file")

  # Skip non-standard todo files (plans, etc.)
  if [[ ! "$filename" =~ ^[0-9]+-.*\.md$ ]] && [[ ! "$filename" =~ ^paintbrush-.*\.md$ ]]; then
    ((SKIPPED++))
    continue
  fi

  # Extract status from filename
  # Pattern: {id}-{status}-{priority}-{description}.md
  if [[ "$filename" =~ ^[0-9]+-([a-z]+)-p[0-3]-.* ]]; then
    filename_status="${BASH_REMATCH[1]}"
  elif [[ "$filename" =~ ^paintbrush-review-([A-Z]+[0-9]?)- ]]; then
    ((SKIPPED++))
    continue
  else
    ((SKIPPED++))
    continue
  fi

  # Extract status from YAML frontmatter
  yaml_status=$(grep -m1 "^status:" "$file" 2>/dev/null | sed 's/status: *//' | tr -d "'" | tr -d '"' || echo "")

  if [[ -z "$yaml_status" ]]; then
    echo "⚠️  No YAML status: $filename"
    ((SKIPPED++))
    continue
  fi

  # Normalize both to compound engineering standard
  normalized_filename=$(normalize_status "$filename_status")
  normalized_yaml=$(normalize_status "$yaml_status")

  # Check if filename needs renaming
  if [[ "$normalized_filename" != "$normalized_yaml" ]]; then
    ((MISALIGNED++))
    echo "❌ MISALIGNED: $filename"
    echo "   Filename: $filename_status → $normalized_filename"
    echo "   YAML:     $yaml_status → $normalized_yaml"
    echo "   Action:   Rename to use '$normalized_yaml'"

    if ! $DRY_RUN; then
      # Build new filename (replace status part)
      new_filename="${filename/$filename_status/$normalized_yaml}"

      # Also update YAML to standard status
      if [[ "$yaml_status" != "$normalized_yaml" ]]; then
        sed -i '' "s/^status: *'*\"*${yaml_status}'*\"*/status: ${normalized_yaml}/" "$file"
        echo "   → Updated YAML: $yaml_status → $normalized_yaml"
      fi

      if [[ "$new_filename" != "$filename" ]]; then
        echo "   → Renaming: $filename → $new_filename"
        git mv "$TODOS_DIR/$filename" "$TODOS_DIR/$new_filename" 2>/dev/null || mv "$TODOS_DIR/$filename" "$TODOS_DIR/$new_filename"
      fi
    fi
    echo ""

  # Check if YAML needs standardizing (but filename is correct)
  elif [[ "$yaml_status" != "$normalized_yaml" ]]; then
    ((YAML_ONLY++))
    echo "📝 YAML LEGACY: $filename"
    echo "   YAML uses '$yaml_status' but should be '$normalized_yaml'"

    if ! $DRY_RUN; then
      sed -i '' "s/^status: *'*\"*${yaml_status}'*\"*/status: ${normalized_yaml}/" "$file"
      echo "   → Updated YAML"
    fi
    echo ""

  else
    ((ALIGNED++))
  fi
done

echo "========================================"
echo "Summary"
echo "========================================"
echo "✅ Aligned:        $ALIGNED"
echo "❌ Misaligned:     $MISALIGNED (filename != YAML intent)"
echo "📝 YAML Legacy:    $YAML_ONLY (YAML uses old term)"
echo "⏭️  Skipped:        $SKIPPED (non-standard files)"
echo ""

if [[ $MISALIGNED -gt 0 || $YAML_ONLY -gt 0 ]] && $DRY_RUN; then
  echo "Run with --fix to apply corrections"
fi

exit 0
