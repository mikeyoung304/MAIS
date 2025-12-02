# Advanced MCP Server Setup

This document describes the advanced MCP (Model Context Protocol) servers configured for the MAIS project, focusing on the sequential-thinking, memory, and GitHub integrations.

## Overview

The MAIS project now has 8 MCP servers configured to provide comprehensive development capabilities:

1. **filesystem** - File system operations
2. **git** - Git version control operations
3. **prisma** - Database schema and migration management
4. **postgres** - Direct database access and queries
5. **playwright** - Browser automation and E2E testing
6. **sequential** - Multi-step reasoning and complex problem solving
7. **memory** - Knowledge graph and pattern retention
8. **github** - GitHub integration for PR analysis and code review

## New Advanced Servers

### Sequential Thinking Server

**Package:** `@modelcontextprotocol/server-sequential-thinking`

**Purpose:** Enables structured, multi-step reasoning for complex problem-solving tasks.

**Key Capabilities:**

- Break down complex problems into sequential steps
- Maintain reasoning chains across multiple interactions
- Track dependencies between logical steps
- Provide structured debugging workflows
- Handle intricate architectural decisions

**Use Cases:**

- **Complex Debugging:** Systematically narrow down the root cause of multi-layered bugs
- **Architecture Planning:** Think through system design decisions with clear step-by-step reasoning
- **Refactoring Strategy:** Plan large-scale code refactoring with dependency analysis
- **Migration Planning:** Map out database or framework migration steps
- **Performance Optimization:** Trace performance issues through multiple system layers

**Example Workflow:**

```
User: "The checkout flow is failing intermittently"

With Sequential Thinking:
1. Identify all components in the checkout flow
2. Check each component's error logs systematically
3. Trace the request flow through API, database, and payment gateway
4. Identify timing issues or race conditions
5. Propose fixes based on root cause analysis
```

### Memory Server

**Package:** `@modelcontextprotocol/server-memory`

**Purpose:** Maintains a persistent knowledge graph of project patterns, decisions, and learnings.

**Key Capabilities:**

- Store and retrieve project-specific patterns
- Remember architectural decisions and their rationale
- Track recurring issues and their solutions
- Build a knowledge graph of code relationships
- Learn from past interactions and debugging sessions

**Use Cases:**

- **Pattern Recognition:** Remember how similar problems were solved previously
- **Consistency Enforcement:** Recall established coding patterns and conventions
- **Decision History:** Track why certain architectural choices were made
- **Bug Prevention:** Remember past bugs to avoid similar issues
- **Onboarding Support:** Provide context about project-specific conventions

**Example Workflow:**

```
Session 1:
User: "How should we handle user authentication?"
Assistant: [Implements JWT with refresh tokens]
Memory: Stores pattern for auth implementation

Session 2 (weeks later):
User: "We need authentication for the admin panel"
Assistant: [Recalls previous JWT pattern and applies consistently]
```

### GitHub Server

**Package:** `@missionsquad/mcp-github`

**Purpose:** Direct integration with GitHub for repository operations, PR analysis, and code review.

**Key Capabilities:**

- Analyze pull requests and provide code review feedback
- Search and navigate GitHub repositories
- Create and manage issues and pull requests
- Review commit histories and changes
- Track project milestones and releases

**Use Cases:**

- **PR Analysis:** Automatically review pull requests for quality and consistency
- **Code Review Assistance:** Provide detailed feedback on code changes
- **Issue Tracking:** Link code changes to GitHub issues
- **Release Management:** Help manage version releases and changelogs
- **Dependency Updates:** Review and analyze dependency update PRs

**Example Workflow:**

```
User: "Review the latest PR for the payment integration"

With GitHub Server:
1. Fetch PR details and changed files
2. Analyze code changes for potential issues
3. Check for test coverage
4. Verify follows project conventions
5. Suggest improvements or approve
```

## How These Servers Work Together

### Scenario 1: Complex Bug Investigation

1. **Sequential Thinking:** Structures the debugging approach
2. **Memory:** Recalls similar past issues and solutions
3. **Git:** Reviews recent changes that might have introduced the bug
4. **GitHub:** Checks related PRs and issues
5. **Postgres:** Queries database to verify data state
6. **Prisma:** Checks schema for potential conflicts

### Scenario 2: Feature Implementation

1. **Memory:** Recalls project patterns and conventions
2. **Sequential Thinking:** Plans implementation steps
3. **Filesystem:** Creates/modifies required files
4. **Prisma:** Updates database schema if needed
5. **Playwright:** Creates E2E tests
6. **Git:** Commits changes incrementally
7. **GitHub:** Creates PR with detailed description

### Scenario 3: Code Review and Refactoring

1. **GitHub:** Fetches PR for review
2. **Sequential Thinking:** Analyzes changes systematically
3. **Memory:** Checks against established patterns
4. **Filesystem:** Reads related files for context
5. **Git:** Reviews commit history
6. **Postgres:** Verifies database implications

## Configuration Details

### MCP Server Configuration (.mcp.json)

```json
{
  "sequential": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
  },
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@missionsquad/mcp-github"]
  }
}
```

### Permissions Configuration (.claude/settings.local.json)

```json
{
  "permissions": {
    "allow": ["mcp__sequential__*", "mcp__memory__*", "mcp__github__*"]
  },
  "enabledMcpjsonServers": ["sequential", "memory", "github"]
}
```

## Best Practices

### Sequential Thinking

- Use for problems with 3+ dependent steps
- Explicitly ask for step-by-step reasoning when needed
- Let it guide you through unfamiliar codebases or complex logic

### Memory

- The memory server learns over time - the more you use it, the smarter it gets
- Explicitly call out patterns you want remembered
- Review stored memories periodically to ensure accuracy

### GitHub

- Integrate with CI/CD workflows for automated reviews
- Use for release planning and version management
- Leverage for tracking technical debt through issues

## Testing the Setup

To verify the servers are working correctly:

1. **Test Sequential Thinking:**

   ```
   Ask: "Walk me through how the user registration flow works step by step"
   ```

2. **Test Memory:**

   ```
   Session 1: "Remember that we use Zod for validation in this project"
   Session 2: "What validation library do we use?"
   ```

3. **Test GitHub:**
   ```
   Ask: "Show me the recent PRs for this repository"
   ```

## Troubleshooting

### Server Not Loading

- Check that npx can access the package
- Verify network connection for package downloads
- Review Claude Code logs for initialization errors

### Permission Issues

- Ensure wildcards (`*`) are included in permissions
- Check that server names match exactly in both config files
- Restart Claude Code after configuration changes

### Package Not Found

- Packages are downloaded on-demand via npx
- First use may take longer as packages are cached
- Verify package names are spelled correctly

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Sequential Thinking Server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking)
- [Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [GitHub MCP Server](https://github.com/missionsquad/mcp-github)

## Next Steps

1. Restart Claude Code to load the new servers
2. Test each server with simple commands
3. Try combined workflows using multiple servers
4. Document project-specific patterns in the memory server
5. Integrate GitHub server into your PR review process
