#!/usr/bin/env python3
"""
Fix logger calls to move variables from message into data object.
This is the proper way to do structured logging.

BEFORE: logger.info({}, '[Agent] Message with ${var}')
AFTER:  logger.info({ var }, '[Agent] Message with value')
"""

import re
from pathlib import Path

AGENTS = ['concierge', 'storefront', 'marketing', 'research', 'booking']

# Mapping of variable references to how they should be logged
VARIABLE_PATTERNS = [
    # tenantId
    (r"(logger\.(info|warn|error)\(\{\},\s*)'([^']*)\$\{tenantId\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ tenantId }}, '{m.group(3)} [tenantId]{m.group(4)}'{m.group(5)}"),

    # agentName
    (r"(logger\.(info|warn|error)\(\{\},\s*)'([^']*)\$\{agentName\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ agentName }}, '{m.group(3)} [agentName]{m.group(4)}'{m.group(5)}"),

    # sessionId / specialistSessionId / cachedSessionId
    (r"(logger\.(info|warn|error)\(\{\},\s*)'([^']*)\$\{(\w*[sS]essionId)\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ sessionId: {m.group(4)} }}, '{m.group(3)} [sessionId]{m.group(5)}'{m.group(6)}"),

    # response.status
    (r"(logger\.error\(\{\},\s*)'([^']*)\$\{response\.status\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ status: response.status }}, '{m.group(2)} [status]{m.group(3)}'{m.group(4)}"),

    # errorText
    (r"(logger\.error\(\{\},\s*)'([^']*)\$\{errorText\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ errorText }}, '{m.group(2)} [errorText]{m.group(3)}'{m.group(4)}"),

    # Two variables in one message - agentName and sessionId
    (r"(logger\.(info|warn|error)\(\{\},\s*)'([^']*)\$\{agentName\}([^']*)\$\{(\w*[sS]essionId)\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ agentName, sessionId: {m.group(5)} }}, '{m.group(3)} [agentName]{m.group(4)} [sessionId]{m.group(6)}'{m.group(7)}"),

    # params.task
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.task\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ task: params.task }}, '{m.group(2)} [task]{m.group(3)}'{m.group(4)}"),

    # params.pageName
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.pageName\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ pageName: params.pageName }}, '{m.group(2)} [pageName]{m.group(3)}'{m.group(4)}"),

    # params.enabled
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.enabled\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ enabled: params.enabled }}, '{m.group(2)} [enabled]{m.group(3)}'{m.group(4)}"),

    # params.toPosition
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.toPosition\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ toPosition: params.toPosition }}, '{m.group(2)} [toPosition]{m.group(3)}'{m.group(4)}"),

    # params.sectionType and params.pageName together
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.sectionType\}([^']*)\$\{params\.pageName\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ sectionType: params.sectionType, pageName: params.pageName }}, '{m.group(2)} [sectionType]{m.group(3)} [pageName]{m.group(4)}'{m.group(5)}"),

    # params.sectionId
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.sectionId\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ sectionId: params.sectionId }}, '{m.group(2)} [sectionId]{m.group(3)}'{m.group(4)}"),

    # params.context
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.context\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ context: params.context }}, '{m.group(2)} [context]{m.group(3)}'{m.group(4)}"),

    # params.serviceName
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.serviceName\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ serviceName: params.serviceName }}, '{m.group(2)} [serviceName]{m.group(3)}'{m.group(4)}"),

    # params.copyType
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.copyType\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ copyType: params.copyType }}, '{m.group(2)} [copyType]{m.group(3)}'{m.group(4)}"),

    # params.industry and params.location
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.industry\}([^']*)\$\{params\.location\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ industry: params.industry, location: params.location }}, '{m.group(2)} [industry]{m.group(3)} [location]{m.group(4)}'{m.group(5)}"),

    # params.url
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.url\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ url: params.url }}, '{m.group(2)} [url]{m.group(3)}'{m.group(4)}"),

    # params.competitors.length
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.competitors\.length\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ competitorCount: params.competitors.length }}, '{m.group(2)} [competitorCount]{m.group(3)}'{m.group(4)}"),

    # params.serviceId
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.serviceId\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ serviceId: params.serviceId }}, '{m.group(2)} [serviceId]{m.group(3)}'{m.group(4)}"),

    # params.startDate and params.endDate
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.startDate\}([^']*)\$\{params\.endDate\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ startDate: params.startDate, endDate: params.endDate }}, '{m.group(2)} [startDate]{m.group(3)} [endDate]{m.group(4)}'{m.group(5)}"),

    # params.question substring
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.question\.substring\(0,\s*50\)\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ question: params.question.substring(0, 50) }}, '{m.group(2)} [question]{m.group(3)}'{m.group(4)}"),

    # params.scheduledAt
    (r"(logger\.info\(\{\},\s*)'([^']*)\$\{params\.scheduledAt\}([^']*)'(\);)",
     lambda m: f"{m.group(1)}{{ scheduledAt: params.scheduledAt }}, '{m.group(2)} [scheduledAt]{m.group(3)}'{m.group(4)}"),
]

def fix_logger_variables(content: str) -> int:
    """
    Fix all logger calls to extract variables into data object
    """
    count = 0

    for pattern, replacer in VARIABLE_PATTERNS:
        matches = list(re.finditer(pattern, content, re.MULTILINE))
        if matches:
            print(f"    Found {len(matches)} matches for pattern: {pattern[:50]}...")
            count += len(matches)
            content = re.sub(pattern, replacer, content, flags=re.MULTILINE)

    return count

def process_agent_file(agent_name: str) -> bool:
    """Process a single agent file"""
    file_path = Path(f"server/src/agent-v2/deploy/{agent_name}/src/agent.ts")

    if not file_path.exists():
        print(f"❌ {agent_name}: File not found")
        return False

    print(f"\n📝 Processing {agent_name}...")

    # Read file
    content = file_path.read_text()

    # Fix variables
    count = fix_logger_variables(content)

    # Write back
    file_path.write_text(content)

    if count > 0:
        print(f"✅ {agent_name}: Fixed {count} variable references")
    else:
        print(f"⏭️  {agent_name}: No variable references to fix")

    return True

def main():
    """Main entry point"""
    print("🔧 Moving logger variables into data objects...")
    print("=" * 60)

    for agent in AGENTS:
        process_agent_file(agent)

    print("\n" + "=" * 60)
    print("✅ Complete!")
    print("\nVerify with: grep \"\\${\" server/src/agent-v2/deploy/*/src/agent.ts")

if __name__ == '__main__':
    main()
