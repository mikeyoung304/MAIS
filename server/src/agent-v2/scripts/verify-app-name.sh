#!/bin/bash
# Verify that a deployed agent has the expected app name
#
# Usage: ./verify-app-name.sh <service-url> <expected-app-name>
# Example: ./verify-app-name.sh https://marketing-agent-506923455711.us-central1.run.app marketing_specialist

set -e

SERVICE_URL=$1
EXPECTED_APP=$2

if [ -z "$SERVICE_URL" ] || [ -z "$EXPECTED_APP" ]; then
  echo "Usage: ./verify-app-name.sh <service-url> <expected-app-name>"
  echo ""
  echo "Example:"
  echo "  ./verify-app-name.sh https://marketing-agent-506923455711.us-central1.run.app marketing_specialist"
  exit 1
fi

echo "Verifying app name for: $SERVICE_URL"
echo "Expected app name: $EXPECTED_APP"
echo ""

# Get identity token for authentication
TOKEN=$(gcloud auth print-identity-token --audiences="$SERVICE_URL" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not get identity token. Run 'gcloud auth login' first."
  exit 1
fi

# Call /list-apps endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$SERVICE_URL/list-apps")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: /list-apps returned HTTP $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi

# Check if expected app is in the list
if echo "$BODY" | grep -q "\"$EXPECTED_APP\""; then
  echo "SUCCESS: App '$EXPECTED_APP' found"
  echo ""
  echo "All available apps: $BODY"
  exit 0
else
  echo "FAILURE: App '$EXPECTED_APP' not found"
  echo ""
  echo "Available apps: $BODY"
  echo ""
  echo "This usually means:"
  echo "  1. The agent's 'name' property doesn't match"
  echo "  2. Check the agent.ts file and verify: new LlmAgent({ name: '$EXPECTED_APP', ... })"
  exit 1
fi
