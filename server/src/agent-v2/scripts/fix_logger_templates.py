#!/usr/bin/env python3
"""
Fix logger calls to use proper template literals instead of single quotes.
This is a follow-up to add_structured_logging.py to fix the interpolation issue.
"""

import re
from pathlib import Path

AGENTS = ['concierge', 'storefront', 'marketing', 'research', 'booking']

def fix_logger_templates(content: str) -> int:
    """
    Replace logger calls with single-quoted strings containing ${...}
    back to template literals with backticks.
    """
    count = 0

    # Pattern: logger.info({}, '...${ ... }...')
    # Should be: logger.info({}, `...${...}...`)
    pattern = re.compile(
        r"(logger\.(info|warn|error)\([^,]+,\s*)'([^']*\$\{[^']*)'(\);)",
        re.MULTILINE
    )

    def replacer(m):
        nonlocal count
        count += 1
        prefix = m.group(1)  # logger.info({},
        msg = m.group(3)  # the message with ${...}
        suffix = m.group(4)  # );
        return f"{prefix}`{msg}`{suffix}"

    content = pattern.sub(replacer, content)

    return count

def process_agent_file(agent_name: str) -> bool:
    """Process a single agent file"""
    file_path = Path(f"server/src/agent-v2/deploy/{agent_name}/src/agent.ts")

    if not file_path.exists():
        print(f"❌ {agent_name}: File not found")
        return False

    # Read file
    content = file_path.read_text()

    # Fix templates
    count = fix_logger_templates(content)

    if count > 0:
        # Write back
        file_path.write_text(content)
        print(f"✅ {agent_name}: Fixed {count} template literals")
    else:
        print(f"⏭️  {agent_name}: No templates to fix")

    return True

def main():
    """Main entry point"""
    print("🔧 Fixing logger template literals...")
    print("=" * 60)

    for agent in AGENTS:
        process_agent_file(agent)

    print("\n" + "=" * 60)
    print("✅ Complete!")

if __name__ == '__main__':
    main()
