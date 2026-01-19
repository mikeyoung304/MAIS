#!/bin/bash
# Script to add structured logging to all agent files

set -e

AGENTS=(
  "concierge"
  "storefront"
  "marketing"
  "research"
  "booking"
)

LOGGER_CODE='
// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

/**
 * Lightweight structured logger for Cloud Run agents
 * Outputs JSON for easy parsing in Cloud Logging
 */
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(JSON.stringify({ level: '\''info'\'', msg, ...data, timestamp: new Date().toISOString() })),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(JSON.stringify({ level: '\''warn'\'', msg, ...data, timestamp: new Date().toISOString() })),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(JSON.stringify({ level: '\''error'\'', msg, ...data, timestamp: new Date().toISOString() })),
};
'

for AGENT in "${AGENTS[@]}"; do
  FILE="server/src/agent-v2/deploy/$AGENT/src/agent.ts"

  if [ ! -f "$FILE" ]; then
    echo "Skipping $AGENT - file not found"
    continue
  fi

  echo "Processing $AGENT..."

  # Create backup
  cp "$FILE" "$FILE.bak"

  # Add logger after imports
  sed -i '' '/^\/\/ ===.*ENVIRONMENT CONFIGURATION/i\
'"$LOGGER_CODE"'
' "$FILE"

  echo "  ✓ Added logger utility"

  # Now use Node.js to do the replacements since they're complex
  node << 'EOF'
const fs = require('fs');
const agentName = process.argv[1];
const file = `server/src/agent-v2/deploy/${agentName}/src/agent.ts`;
let content = fs.readFileSync(file, 'utf8');

// Replace console.log patterns
content = content.replace(
  /console\.log\(`\[(\w+)\] ([^`]+)`\);/g,
  (match, agent, msg) => `logger.info({}, '[${agent}] ${msg}');`
);

content = content.replace(
  /console\.log\(`\[(\w+)\] ([^`]+)`, ([^)]+)\);/g,
  (match, agent, msg, data) => `logger.info({ data: ${data} }, '[${agent}] ${msg}');`
);

// Replace console.error patterns
content = content.replace(
  /console\.error\(`\[(\w+)\] ([^`]+)`, error\);/g,
  (match, agent, msg) => `logger.error({ error: error instanceof Error ? error.message : String(error) }, '[${agent}] ${msg}');`
);

content = content.replace(
  /console\.error\(`\[(\w+)\] ([^`]+)`\);/g,
  (match, agent, msg) => `logger.error({}, '[${agent}] ${msg}');`
);

// Replace console.warn patterns
content = content.replace(
  /console\.warn\(`\[(\w+)\] ([^`]+)`\);/g,
  (match, agent, msg) => `logger.warn({}, '[${agent}] ${msg}');`
);

fs.writeFileSync(file, content, 'utf8');
EOF

  echo "  ✓ Replaced console calls"
  echo
done

echo "Done! All agents updated with structured logging."
echo "Review changes, then delete .bak files if satisfied."
