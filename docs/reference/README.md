# Reference Documentation

This directory contains technical reference documentation following the Diátaxis "Reference" pattern: information-oriented, focused on accurate technical descriptions and specifications.

## What is Reference Documentation?

Reference documentation provides:
- Technical specifications and details
- API contracts and schemas
- Configuration options and environment variables
- Accurate, complete, up-to-date facts
- Quick lookup information

Reference docs are dry, focused on facts, and organized for easy lookup.

## Available References

### Technology & Platform References

| Document | Purpose |
|----------|---------|
| [ADVISORY_LOCKS.md](./ADVISORY_LOCKS.md) | PostgreSQL advisory lock IDs registry and usage guidelines |
| [SCHEDULING-PLATFORM-TECH-REFERENCE-2025.md](./SCHEDULING-PLATFORM-TECH-REFERENCE-2025.md) | Comprehensive scheduling platform technology reference (2025) |

### API References

See [../api/](../api/) for API-specific reference documentation:
- API contracts (Zod schemas + ts-rest endpoints)
- Endpoint specifications
- Request/response formats
- Error codes

### Configuration References

See [../setup/](../setup/) for configuration references:
- [Environment Variables](../setup/ENVIRONMENT.md) - Complete env var reference
- [Supabase Configuration](../setup/SUPABASE.md) - Database configuration reference

### Architecture References

See [../architecture/](../architecture/) and [../adrs/](../adrs/) for:
- Architectural Decision Records (ADRs)
- System design specifications
- Multi-tenant architecture details

## Related Documentation

- **How-to Guides:** [../solutions/](../solutions/) - Step-by-step problem solving
- **Explanations:** [../../ARCHITECTURE.md](../../ARCHITECTURE.md) - Conceptual understanding
- **Tutorials:** [../setup/](../setup/) - Learning-oriented guides

## Contributing Reference Documentation

When creating reference documentation:

1. **Focus on facts:** Be precise, accurate, and complete
2. **Structure for lookup:** Use tables, lists, and clear headings
3. **Keep it current:** Reference docs must always be up-to-date
4. **Link to examples:** Point to how-to guides for usage examples
5. **Avoid explanations:** Save "why" for explanation docs

### Quick Checklist

- [ ] Accurate and complete information
- [ ] Organized for quick lookup (tables, alphabetical, etc.)
- [ ] No tutorial-style "how to" content (use solutions/ for that)
- [ ] No architectural explanations (use ARCHITECTURE.md for that)
- [ ] Includes version or last-updated date
- [ ] Links to related how-to guides

---

**Last Updated:** 2025-12-02
**Maintainer:** Technical Lead
**Purpose:** Technical reference documentation (Diátaxis "Reference" pattern)
