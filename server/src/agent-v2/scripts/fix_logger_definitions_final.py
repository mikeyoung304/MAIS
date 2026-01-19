#!/usr/bin/env python3
"""Fix all logger definitions to be correct"""
import re
from pathlib import Path

CORRECT_LOGGER = """const logger = {
  info: (data: Record<string, unknown>, msg: string) =>
    console.log(JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })),
  warn: (data: Record<string, unknown>, msg: string) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })),
  error: (data: Record<string, unknown>, msg: string) =>
    console.error(JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })),
};"""

AGENTS = ['concierge', 'storefront', 'marketing', 'research', 'booking']

def fix_logger_definition(content: str) -> str:
    """Replace the logger definition with the correct one"""
    # Pattern to match any logger definition
    pattern = r'const logger = \{[^}]+\};'

    # Replace with correct definition
    content = re.sub(pattern, CORRECT_LOGGER, content, flags=re.DOTALL)

    return content

def main():
    for agent in AGENTS:
        file_path = Path(f"server/src/agent-v2/deploy/{agent}/src/agent.ts")
        if not file_path.exists():
            continue

        content = file_path.read_text()
        new_content = fix_logger_definition(content)

        file_path.write_text(new_content)
        print(f"✅ Fixed {agent} logger definition")

if __name__ == '__main__':
    main()
