# MAIS Documentation

**MAIS (Macon AI Solutions)** is a multi-tenant business growth club platform partnering with entrepreneurs and small business owners through revenue-sharing partnerships. Built as a modular monolith with Express + React, featuring complete data isolation, config-driven architecture, and mock-first development.

Whether you're setting up your development environment, responding to a production incident, or understanding the architecture, this guide will help you find what you need quickly.

## About Our Documentation System

MAIS documentation follows the **Diátaxis framework**, a systematic approach to technical documentation that organizes content based on your needs and context. Instead of searching through a single monolithic guide, you can navigate directly to the type of documentation that matches what you're trying to accomplish right now.

The Diátaxis framework recognizes that documentation serves different purposes at different times. Sometimes you need to learn a new concept (tutorials), sometimes you need to solve a specific problem (how-to guides), sometimes you need to look up technical details (reference), and sometimes you need to understand why things work the way they do (explanation). By organizing documentation into these four types, we make it easier for you to find exactly what you need, when you need it.

Understanding which type of documentation you need helps you find answers faster and reduces frustration. The framework is based on two axes: whether you're **studying** (learning) or **working** (applying), and whether you need **practical steps** or **theoretical knowledge**.

## The Four Types of Documentation

```
                    PRACTICAL STEPS
                           |
                           |
         TUTORIALS    |    HOW-TO GUIDES
         (Learning)   |    (Problem-solving)
    ------------------.------------------
         EXPLANATION  |    REFERENCE
         (Understanding) |  (Information)
                           |
                    THEORETICAL KNOWLEDGE
```

**Tutorials (Learning-oriented)**

- Help you learn through hands-on practice
- Guide you to a successful outcome
- Focus on getting you started safely
- Example: "Your First Booking Flow"

**How-to Guides (Task-oriented)**

- Solve specific problems you're facing
- Provide step-by-step instructions
- Assume you have basic knowledge
- Example: "Deploy to Production" or "Rotate API Secrets"

**Reference (Information-oriented)**

- Technical descriptions and specifications
- API endpoints, configuration options
- Accurate, complete, up-to-date facts
- Example: "Environment Variables Reference" or "API Contracts"

**Explanation (Understanding-oriented)**

- Clarify concepts and design decisions
- Explain why things work the way they do
- Provide context and background
- Example: "Multi-Tenant Data Isolation" or "Webhook Processing Architecture"

## I Want To...

Find your task below and jump to the right documentation:

**Get Started**

- Set up local development → [DEVELOPING.md](../DEVELOPING.md) and [setup/LOCAL_TESTING_GUIDE.md](./setup/LOCAL_TESTING_GUIDE.md)
- Run the application → [README.md](../README.md) Quick Start section
- Understand the architecture → [ARCHITECTURE.md](../ARCHITECTURE.md)
- Run tests → [TESTING.md](../TESTING.md)

**Deploy & Operate**

- Deploy to production → [operations/DEPLOYMENT_GUIDE.md](./operations/DEPLOYMENT_GUIDE.md)
- Handle a production incident → [operations/INCIDENT_RESPONSE.md](./operations/INCIDENT_RESPONSE.md)
- Follow operational procedures → [operations/RUNBOOK.md](./operations/RUNBOOK.md)
- Check production deployment checklist → [operations/PRODUCTION_DEPLOYMENT_GUIDE.md](./operations/PRODUCTION_DEPLOYMENT_GUIDE.md)

**Configure & Setup**

- Set up environment variables → [setup/ENVIRONMENT.md](./setup/ENVIRONMENT.md)
- Configure database (Supabase) → [setup/SUPABASE.md](./setup/SUPABASE.md)
- Set up local testing environment → [setup/LOCAL_TESTING_GUIDE.md](./setup/LOCAL_TESTING_GUIDE.md)

**Security & Secrets**

- Understand security practices → [security/SECURITY.md](./security/SECURITY.md)
- Rotate secrets → [security/SECRET_ROTATION_GUIDE.md](./security/SECRET_ROTATION_GUIDE.md)
- Review security procedures → [security/IMMEDIATE_SECURITY_ACTIONS.md](./security/IMMEDIATE_SECURITY_ACTIONS.md)
- Check secret management overview → [security/SECRETS.md](./security/SECRETS.md)

**Work with APIs**

- Get started with APIs → [api/API_DOCS_QUICKSTART.md](./api/API_DOCS_QUICKSTART.md)
- Explore API documentation → [api/README.md](./api/README.md)
- Review API contracts → [../packages/contracts/](../packages/contracts/)

**Understand Multi-Tenancy**

- Learn multi-tenant implementation → [multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md](./multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- Review tenant self-service roadmap → [multi-tenant/MULTI_TENANT_ROADMAP.md](./multi-tenant/MULTI_TENANT_ROADMAP.md)
- Tenant admin user guide → [multi-tenant/TENANT_ADMIN_USER_GUIDE.md](./multi-tenant/TENANT_ADMIN_USER_GUIDE.md)

**Develop Features**

- Follow development workflow → [../DEVELOPING.md](../DEVELOPING.md)
- Review architectural decisions → [DECISIONS.md](../DECISIONS.md)
- Check feature roadmaps → [roadmaps/ROADMAP.md](./roadmaps/ROADMAP.md)
- Integrate the widget → [roadmaps/WIDGET_INTEGRATION_GUIDE.md](./roadmaps/WIDGET_INTEGRATION_GUIDE.md)

**Contribute Documentation**

- Quick 30-second guide → [DOCUMENTATION_QUICK_REFERENCE.md](./DOCUMENTATION_QUICK_REFERENCE.md)
- Full documentation standards → [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)
- Browse all documentation → [INDEX.md](./INDEX.md)

## Quick Start by Role

### New Developer

1. Read [README.md](../README.md) for project overview
2. Follow [DEVELOPING.md](../DEVELOPING.md) to set up your environment
3. Review [ARCHITECTURE.md](../ARCHITECTURE.md) to understand the system
4. Run through [TESTING.md](../TESTING.md) to verify your setup
5. Check current sprint work in [sprints/](./sprints/)

### Platform Operator

1. Review [operations/RUNBOOK.md](./operations/RUNBOOK.md) for procedures
2. Study [operations/INCIDENT_RESPONSE.md](./operations/INCIDENT_RESPONSE.md) playbook
3. Understand [operations/DEPLOYMENT_GUIDE.md](./operations/DEPLOYMENT_GUIDE.md)
4. Check [setup/ENVIRONMENT.md](./setup/ENVIRONMENT.md) for configuration
5. Review [security/SECURITY.md](./security/SECURITY.md) for best practices

### Security Reviewer

1. Start with [security/SECURITY.md](./security/SECURITY.md) for security overview
2. Check [security/SECRET_ROTATION_GUIDE.md](./security/SECRET_ROTATION_GUIDE.md)
3. Review [security/AUDIT_SECURITY_PHASE2B.md](./security/AUDIT_SECURITY_PHASE2B.md)
4. Examine [multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md](./multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) for data isolation
5. Verify [operations/INCIDENT_RESPONSE.md](./operations/INCIDENT_RESPONSE.md) procedures

### API Integration Developer

1. Start with [api/API_DOCS_QUICKSTART.md](./api/API_DOCS_QUICKSTART.md)
2. Review [api/README.md](./api/README.md) for API overview
3. Explore contracts in [../packages/contracts/](../packages/contracts/)
4. Check [roadmaps/WIDGET_INTEGRATION_GUIDE.md](./roadmaps/WIDGET_INTEGRATION_GUIDE.md) for embedding
5. Review [roadmaps/SDK_IMPLEMENTATION_REPORT.md](./roadmaps/SDK_IMPLEMENTATION_REPORT.md)

### Tenant Administrator

1. Read [multi-tenant/TENANT_ADMIN_USER_GUIDE.md](./multi-tenant/TENANT_ADMIN_USER_GUIDE.md)
2. Review [multi-tenant/MULTI_TENANT_ROADMAP.md](./multi-tenant/MULTI_TENANT_ROADMAP.md)
3. Check feature availability in [roadmaps/ROADMAP.md](./roadmaps/ROADMAP.md)
4. Understand [api/README.md](./api/README.md) for API access
5. Review [security/SECURITY.md](./security/SECURITY.md) for security practices

### Agent/AI Assistant

1. Review [sprints/](./sprints/) for current sprint context
2. Check [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) for documentation rules
3. Use [DOCUMENTATION_QUICK_REFERENCE.md](./DOCUMENTATION_QUICK_REFERENCE.md) for quick answers
4. Follow [ARCHITECTURE.md](../ARCHITECTURE.md) for system understanding
5. Check [DECISIONS.md](../DECISIONS.md) for architectural decisions

## Documentation Organization

Our documentation is organized into these main directories:

| Directory                        | Purpose                                             | Examples                                 |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| [sprints/](./sprints/)           | Active sprint work, progress reports, session notes | Sprint 4-6 completion reports            |
| [operations/](./operations/)     | Production operations, runbooks, incident response  | Deployment guides, RUNBOOK               |
| [api/](./api/)                   | API documentation, contracts, integration guides    | API quickstart, contracts                |
| [security/](./security/)         | Security procedures, audits, secret management      | Secret rotation, security audits         |
| [setup/](./setup/)               | Environment setup, service configuration            | Environment variables, Supabase setup    |
| [architecture/](./architecture/) | ADRs, system design, patterns                       | Architectural decisions                  |
| [roadmaps/](./roadmaps/)         | Feature roadmaps, implementation plans              | Product roadmap, widget guide            |
| [multi-tenant/](./multi-tenant/) | Multi-tenant specific documentation                 | Implementation guide, tenant admin guide |
| [examples/](./examples/)         | Code examples and demonstrations                    | EventEmitter type safety examples        |
| [phases/](./phases/)             | Historical phase completion reports                 | Phase 1-5 reports                        |
| [archive/](./archive/)           | Historical and deprecated documentation             | Old sprints, superseded guides           |

## Contributing to Documentation

Before creating or updating documentation, please review our standards:

- **Quick answers?** See [Documentation Quick Reference](./DOCUMENTATION_QUICK_REFERENCE.md) (30-second guide)
- **Full standards?** See [Documentation Standards](./DOCUMENTATION_STANDARDS.md) (comprehensive guide)
- **Complete listing?** See [Documentation Index](./INDEX.md) (all documents organized by purpose)

### Quick Contribution Checklist

1. Check correct location using [decision tree](./DOCUMENTATION_STANDARDS.md#quick-decision-trees)
2. Follow [naming conventions](./DOCUMENTATION_STANDARDS.md#1-naming-conventions)
3. Add required metadata headers (version, date, owner, status)
4. Update parent directory README if adding major document
5. Update [INDEX.md](./INDEX.md) for significant additions
6. Run security check: `grep -r -E '(password|api_key|secret|token)[:=]' docs/`

## Current Focus

**Sprint 6 (November 2025): COMPLETE ✅**

- Test Stabilization: Achieved 62/104 tests passing (60% pass rate) with 0% variance
- Infrastructure Improvements: Fixed connection pool poisoning, eliminated catalog test failures
- Zero-Code Test Re-enablement: 22 tests re-enabled with only infrastructure fixes

**Sprint 7 (Upcoming): Continue Test Stabilization**

- Target: 70% pass rate (73/104 tests)
- Focus: Test logic fixes, data contamination, complex transaction issues
- Continue systematic re-enablement approach

**Future Sprints:**

- Config Versioning: Database schema, API endpoints, backward compatibility
- Agent Interface: Proposal system, API endpoints, admin review UI
- Display Rules: Configuration UI and runtime engine

See [sprints/](./sprints/) for detailed sprint documentation.

## Agent-Powered Platform (2025)

MAIS is transforming into a config-driven architecture with agent integration:

- **Sprint Documentation:** [archive/2025-11/sprints/sprint-4/](./archive/2025-11/sprints/sprint-4/), [archive/2025-11/sprints/sprint-5-6/](./archive/2025-11/sprints/sprint-5-6/)
- **Planning Documentation:** [archive/planning/2025-01-analysis/](./archive/planning/2025-01-analysis/)
- **Comprehensive Analysis:** [archive/2025-10/analysis/](./archive/2025-10/analysis/)

## Getting Help

**Documentation questions:**

- Check [DOCUMENTATION_QUICK_REFERENCE.md](./DOCUMENTATION_QUICK_REFERENCE.md) for quick answers
- Review [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) for comprehensive guidance
- Browse [INDEX.md](./INDEX.md) for complete document listing
- Ask in #documentation channel (response: same day for simple questions, 2 days for complex)

**Technical questions:**

- Development setup: See [DEVELOPING.md](../DEVELOPING.md)
- Production issues: See [operations/RUNBOOK.md](./operations/RUNBOOK.md) and [operations/INCIDENT_RESPONSE.md](./operations/INCIDENT_RESPONSE.md)
- Security concerns: See [security/SECURITY.md](./security/SECURITY.md)
- API questions: See [api/README.md](./api/README.md)

**Contributing:**

- General contributions: See [CONTRIBUTING.md](../CONTRIBUTING.md)
- Documentation contributions: See [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md)

## About Diátaxis

Want to learn more about the Diátaxis framework we use?

- **Official site:** [diataxis.fr](https://diataxis.fr/)
- **Key insight:** Different documentation types serve different needs at different times
- **Four types:** Tutorials (learning), How-to guides (tasks), Reference (information), Explanation (understanding)
- **Benefits:** Faster navigation, less frustration, clearer content organization
- **Our implementation:** See [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) for how we apply Diátaxis principles

---

**Last Updated:** 2025-11-12
**Maintainer:** Technical Lead
**Version:** 2.0 (Rebuilt with Diátaxis framework)

## Version History

| Version | Date       | Changes                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| 2.0     | 2025-11-12 | Complete rebuild with Diátaxis framework, added role-based navigation, "I want to..." section, visual diagram |
| 1.0     | 2025-11-07 | Initial basic navigation hub                                                                                  |
