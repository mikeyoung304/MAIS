#!/usr/bin/env python3
"""
Add structured logging to all agent files.
Replaces console.log/console.error/console.warn with structured logger calls.
"""

import re
import sys
from pathlib import Path

LOGGER_CODE = """
// =============================================================================
// STRUCTURED LOGGER
// =============================================================================

/**
 * Lightweight structured logger for Cloud Run agents
 * Outputs JSON for easy parsing in Cloud Logging
 */
const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })),
};
"""

AGENTS = ['concierge', 'storefront', 'marketing', 'research', 'booking']

def add_logger(content: str) -> str:
    """Add logger code after imports, before ENVIRONMENT CONFIGURATION"""
    # Find the position right before // ============= ENVIRONMENT CONFIGURATION
    pattern = r'(import.*?;\s*\n)(\n// =============================================================================\n// ENVIRONMENT CONFIGURATION)'

    replacement = r'\1' + LOGGER_CODE + r'\2'

    if '// STRUCTURED LOGGER' in content:
        print("  Logger already exists, skipping addition")
        return content

    result = re.sub(pattern, replacement, content, count=1, flags=re.DOTALL)

    if result == content:
        print("  WARNING: Could not find insertion point for logger")
        return content

    print("  ✓ Added logger utility")
    return result

def replace_console_log(content: str, agent_prefix: str) -> str:
    """Replace console.log calls with logger.info"""
    count = 0

    # Pattern 1: console.log with just a template string message
    # console.log(`[Agent] message`);
    pattern1 = re.compile(
        r"console\.log\(`\[" + agent_prefix + r"\] ([^`]+)`\);",
        re.MULTILINE
    )
    def repl1(m):
        nonlocal count
        count += 1
        msg = m.group(1)
        return f"logger.info({{}}, '[{agent_prefix}] {msg}');"

    content = pattern1.sub(repl1, content)

    # Pattern 2: console.log with template string and variables
    # console.log(`[Agent] message`, data);
    # console.log(`[Agent] message`, JSON.stringify(args));
    pattern2 = re.compile(
        r"console\.log\(`\[" + agent_prefix + r"\] ([^`]+)`,\s*([^)]+)\);",
        re.MULTILINE
    )
    def repl2(m):
        nonlocal count
        count += 1
        msg = m.group(1)
        data_expr = m.group(2).strip()
        # Simplify JSON.stringify calls
        if 'JSON.stringify' in data_expr:
            return f"logger.info({{ data: {data_expr} }}, '[{agent_prefix}] {msg}');"
        else:
            return f"logger.info({{ {data_expr} }}, '[{agent_prefix}] {msg}');"

    content = pattern2.sub(repl2, content)

    print(f"  ✓ Replaced {count} console.log calls")
    return content

def replace_console_error(content: str, agent_prefix: str) -> str:
    """Replace console.error calls with logger.error"""
    count = 0

    # Pattern 1: console.error with just message
    # console.error(`[Agent] message`);
    pattern1 = re.compile(
        r"console\.error\(`\[" + agent_prefix + r"\] ([^`]+)`\);",
        re.MULTILINE
    )
    def repl1(m):
        nonlocal count
        count += 1
        msg = m.group(1)
        return f"logger.error({{}}, '[{agent_prefix}] {msg}');"

    content = pattern1.sub(repl1, content)

    # Pattern 2: console.error with error object
    # console.error(`[Agent] message`, error);
    # console.error(`[Agent] message:`, error);
    pattern2 = re.compile(
        r"console\.error\(`\[" + agent_prefix + r"\] ([^`]+)`,\s*error\);",
        re.MULTILINE
    )
    def repl2(m):
        nonlocal count
        count += 1
        msg = m.group(1).rstrip(':')  # Remove trailing colon
        return f"logger.error({{ error: error instanceof Error ? error.message : String(error) }}, '[{agent_prefix}] {msg}');"

    content = pattern2.sub(repl2, content)

    print(f"  ✓ Replaced {count} console.error calls")
    return content

def replace_console_warn(content: str, agent_prefix: str) -> str:
    """Replace console.warn calls with logger.warn"""
    count = 0

    # Pattern: console.warn with message
    # console.warn(`[Agent] message`);
    pattern = re.compile(
        r"console\.warn\(`\[" + agent_prefix + r"\] ([^`]+)`\);",
        re.MULTILINE
    )
    def repl(m):
        nonlocal count
        count += 1
        msg = m.group(1)
        return f"logger.warn({{}}, '[{agent_prefix}] {msg}');"

    content = pattern.sub(repl, content)

    if count > 0:
        print(f"  ✓ Replaced {count} console.warn calls")
    return content

def process_agent_file(agent_name: str, agent_prefix: str) -> bool:
    """Process a single agent file"""
    file_path = Path(f"server/src/agent-v2/deploy/{agent_name}/src/agent.ts")

    if not file_path.exists():
        print(f"❌ {agent_name}: File not found")
        return False

    print(f"\n📝 Processing {agent_name}...")

    # Read file
    content = file_path.read_text()

    # Add logger utility
    content = add_logger(content)

    # Replace console calls
    content = replace_console_log(content, agent_prefix)
    content = replace_console_error(content, agent_prefix)
    content = replace_console_warn(content, agent_prefix)

    # Write back
    file_path.write_text(content)
    print(f"✅ {agent_name} complete")

    return True

def main():
    """Main entry point"""
    print("🚀 Adding structured logging to agent files...")
    print("=" * 60)

    agent_prefixes = {
        'concierge': 'Concierge',
        'storefront': 'StorefrontAgent',
        'marketing': 'MarketingAgent',
        'research': 'ResearchAgent',
        'booking': 'BookingAgent',
    }

    success_count = 0
    for agent in AGENTS:
        if process_agent_file(agent, agent_prefixes[agent]):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"✅ Complete! Processed {success_count}/{len(AGENTS)} agents")
    print("\nNext steps:")
    print("  1. Run: npm run typecheck --workspace=server")
    print("  2. Review changes with: git diff server/src/agent-v2/deploy/*/src/agent.ts")
    print("  3. If satisfied, commit changes")

if __name__ == '__main__':
    main()
