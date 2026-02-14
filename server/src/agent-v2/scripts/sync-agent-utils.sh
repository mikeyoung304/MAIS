#!/usr/bin/env bash
#
# sync-agent-utils.sh — Copy canonical agent-utils.ts to each Cloud Run agent
#
# Cloud Run agents deploy as standalone services with rootDir: "./src",
# so they cannot import from shared monorepo packages. This script copies
# the canonical source into each agent's src/ directory at build time.
#
# Usage:
#   ./server/src/agent-v2/scripts/sync-agent-utils.sh [agent]
#
# Examples:
#   ./server/src/agent-v2/scripts/sync-agent-utils.sh          # sync all
#   ./server/src/agent-v2/scripts/sync-agent-utils.sh tenant   # sync tenant only
#
# The canonical source is: server/src/agent-v2/shared/agent-utils.ts
# Targets: tenant/src/utils.ts, customer/src/utils.ts
# (research agent inlines its utils in agent.ts — synced separately)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="$(cd "$SCRIPT_DIR/../shared" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/../deploy" && pwd)"

CANONICAL="$SHARED_DIR/agent-utils.ts"

if [ ! -f "$CANONICAL" ]; then
  echo "ERROR: Canonical source not found: $CANONICAL" >&2
  exit 1
fi

AGENT="${1:-all}"

sync_agent() {
  local agent="$1"
  local target="$DEPLOY_DIR/$agent/src/utils.ts"

  if [ ! -d "$DEPLOY_DIR/$agent/src" ]; then
    echo "SKIP: $agent (no src/ directory)" >&2
    return
  fi

  cp "$CANONICAL" "$target"
  echo "Synced: $target"
}

case "$AGENT" in
  all)
    sync_agent tenant
    sync_agent customer
    ;;
  tenant|customer)
    sync_agent "$AGENT"
    ;;
  *)
    echo "Unknown agent: $AGENT (expected: tenant, customer, or all)" >&2
    exit 1
    ;;
esac
