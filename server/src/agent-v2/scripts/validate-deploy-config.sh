#!/bin/bash
# =============================================================================
# ADK Agent Deployment Configuration Validator
# =============================================================================
# Validates that all agent deployments have explicit --service_name to prevent
# multi-agent deployment conflicts.
#
# Usage:
#   ./validate-deploy-config.sh          # Run from repo root
#   npm run lint:agents                  # Via npm script
#
# Exit codes:
#   0 - All configurations valid
#   1 - Configuration errors found
#
# See: docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md
# =============================================================================

set -e

# Configuration
DEPLOY_DIR="server/src/agent-v2/deploy"
ERRORS=0
WARNINGS=0

# Colors for output (disable if not terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

echo "========================================================"
echo "ADK Agent Deployment Configuration Validator"
echo "========================================================"
echo ""
echo "Checking: $DEPLOY_DIR"
echo ""

# Verify deploy directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${RED}[ERROR]${NC} Deploy directory not found: $DEPLOY_DIR"
    echo "Run this script from the repository root."
    exit 1
fi

# Track all service names for uniqueness check (using temp file for compatibility)
SERVICE_NAMES_FILE=$(mktemp)
trap "rm -f $SERVICE_NAMES_FILE" EXIT

# Check all agent directories
for agent_dir in "$DEPLOY_DIR"/*/; do
    # Skip if not a directory
    [ ! -d "$agent_dir" ] && continue

    agent_name=$(basename "$agent_dir")

    # Skip node_modules and other non-agent directories
    if [[ "$agent_name" == "node_modules" ]] || [[ "$agent_name" == ".git" ]]; then
        continue
    fi

    package_json="$agent_dir/package.json"

    # Check if package.json exists
    if [ ! -f "$package_json" ]; then
        echo -e "${YELLOW}[SKIP]${NC} $agent_name - no package.json found"
        continue
    fi

    echo "----------------------------------------"
    echo "Agent: $agent_name"
    echo "----------------------------------------"

    # Check 1: --service_name is present in deploy script
    if ! grep -q '"deploy"' "$package_json"; then
        echo -e "  ${YELLOW}[WARN]${NC} No deploy script found"
        WARNINGS=$((WARNINGS + 1))
    elif ! grep -q "service_name=" "$package_json"; then
        echo -e "  ${RED}[FAIL]${NC} Missing --service_name in deploy script"
        echo "        Fix: Add --service_name=${agent_name}-agent to deploy script"
        ERRORS=$((ERRORS + 1))
    else
        # Extract service name using grep and sed (portable)
        service_name=$(grep -o 'service_name=[a-z0-9-]*' "$package_json" | head -1 | sed 's/service_name=//')

        if [ -z "$service_name" ]; then
            echo -e "  ${RED}[FAIL]${NC} Could not extract service_name value"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "  ${GREEN}[OK]${NC} service_name=$service_name"

            # Check 2: Service name follows convention
            if ! echo "$service_name" | grep -qE '^[a-z]+-agent$'; then
                echo -e "  ${YELLOW}[WARN]${NC} Service name should follow pattern: {name}-agent"
                WARNINGS=$((WARNINGS + 1))
            fi

            # Check 3: Service name is unique
            if grep -q "^$service_name:" "$SERVICE_NAMES_FILE" 2>/dev/null; then
                existing_agent=$(grep "^$service_name:" "$SERVICE_NAMES_FILE" | cut -d: -f2)
                echo -e "  ${RED}[FAIL]${NC} Duplicate service name! Also used by: $existing_agent"
                ERRORS=$((ERRORS + 1))
            else
                echo "$service_name:$agent_name" >> "$SERVICE_NAMES_FILE"
            fi
        fi
    fi

    # Check 4: Unsupported Zod types in agent.ts (excluding comments)
    agent_ts="$agent_dir/src/agent.ts"
    if [ -f "$agent_ts" ]; then
        # Exclude lines that are comments (start with // or contain // before the pattern)
        # Look for actual usage: z.record( not in a comment
        if grep -E 'z\.(record|tuple|intersection|lazy)\(' "$agent_ts" | grep -qvE '^\s*(//|/\*|\*)'; then
            echo -e "  ${RED}[FAIL]${NC} Unsupported Zod types found in agent.ts"
            grep -nE 'z\.(record|tuple|intersection|lazy)\(' "$agent_ts" | grep -vE '^\s*[0-9]+:\s*(//|/\*|\*)' | while read line; do
                echo "        $line"
            done
            echo "        See: server/src/agent-v2/deploy/ZOD_LIMITATIONS.md"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "  ${GREEN}[OK]${NC} Zod schemas use supported types"
        fi
    fi

    # Check 5: A2A requests use snake_case (app_name, not appName)
    if [ -f "$agent_ts" ]; then
        if grep -qE 'appName:|userId:|sessionId:|newMessage:' "$agent_ts"; then
            if ! grep -qE 'app_name:|user_id:|session_id:|new_message:' "$agent_ts"; then
                echo -e "  ${YELLOW}[WARN]${NC} A2A requests may use camelCase instead of snake_case"
                echo "        Use: app_name, user_id, session_id, new_message"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi

    # Check 6: deploy:dry-run also has service_name (if it exists)
    if grep -q '"deploy:dry-run"' "$package_json"; then
        # Get the dry-run script line
        if grep -A1 '"deploy:dry-run"' "$package_json" | grep -q "service_name="; then
            echo -e "  ${GREEN}[OK]${NC} deploy:dry-run has service_name"
        else
            echo -e "  ${YELLOW}[WARN]${NC} deploy:dry-run missing --service_name"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi

    echo ""
done

# Summary
echo "========================================================"
echo "SUMMARY"
echo "========================================================"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}ERRORS:${NC}   $ERRORS"
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}WARNINGS:${NC} $WARNINGS"
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}[FAILED]${NC} Found $ERRORS configuration error(s)"
    echo ""
    echo "How to fix:"
    echo "  1. Open the agent's package.json"
    echo "  2. Add --service_name={agent}-agent to deploy script"
    echo "  3. Add same --service_name to deploy:dry-run script"
    echo ""
    echo "Example:"
    echo '  "deploy": "npm run build && npx adk deploy cloud_run --project=\${GOOGLE_CLOUD_PROJECT:-handled-484216} --region=\${GOOGLE_CLOUD_LOCATION:-us-central1} --service_name=booking-agent"'
    echo ""
    echo "See: docs/solutions/patterns/ADK_CLOUD_RUN_SERVICE_NAME_PREVENTION.md"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}[PASSED WITH WARNINGS]${NC} All critical checks passed, $WARNINGS warning(s)"
    exit 0
else
    echo -e "${GREEN}[PASSED]${NC} All agent configurations valid"
    exit 0
fi
