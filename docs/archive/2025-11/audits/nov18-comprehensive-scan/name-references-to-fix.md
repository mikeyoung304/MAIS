# Documentation Name Reference Fix Report

**Date:** November 18, 2025  
**Project:** MAIS (Macon AI Solutions)  
**Canonical Name:** MAIS  
**Old Project Name:** Elope  
**Status:** Comprehensive scan complete

---

## Executive Summary

Found **152 instances** of "Elope" or "elope" across 71 markdown documentation files. These fall into three categories:

1. **MUST FIX (Platform Name References):** 89 instances - References to the old project/platform name "Elope"
2. **KEEP (Wedding Industry Terms):** 42 instances - References to "elopement" or "elopements" (correct wedding industry terminology)
3. **CONTEXTUAL (File/Directory Paths):** 21 instances - Old file paths like `/Users/mikeyoung/CODING/Elope/` (will be fixed by system path updates)

---

## SECTION 1: PLATFORM NAME REFERENCES TO CHANGE

### Critical (Title/Heading) References

These appear in document titles and primary headings - highest priority.

**File:** `/Users/mikeyoung/CODING/MAIS/README.md`

- **Line 91:** "Starting Sprint 2 (January 2025), Elope is evolving into..."
- **Context:** ...Starting Sprint 2 (January 2025), Elope is evolving into an **agent-powered, config-driven platform**...
- **Recommendation:** CHANGE to "MAIS is evolving into..."
- **Reason:** Direct platform name reference in main documentation

---

**File:** `/Users/mikeyoung/CODING/MAIS/DECISIONS.md`

- **Line 3:** "This document contains all major architectural decisions made during the development of the Elope wedding booking platform."
- **Context:** This document contains all major architectural decisions made during the development of the Elope wedding booking platform...
- **Recommendation:** CHANGE to "MAIS wedding booking platform" or "MAIS platform"
- **Reason:** Platform identifier in header

---

**File:** `/Users/mikeyoung/CODING/MAIS/CODEBASE_EXPLORATION_COMPLETE.md`

- **Line 1:** "# Elope Codebase - Comprehensive Architecture Exploration"
- **Context:** # Elope Codebase - Comprehensive Architecture Exploration
- **Recommendation:** CHANGE to "# MAIS Codebase - Comprehensive Architecture Exploration"
- **Reason:** Document title

- **Line 5:** "Elope is a sophisticated **multi-tenant wedding/elopement booking platform**"
- **Context:** Elope is a sophisticated **multi-tenant wedding/elopement booking platform** built as a modular monolith...
- **Recommendation:** CHANGE to "MAIS is a sophisticated **multi-tenant wedding/elopement booking platform**"
- **Reason:** Platform description

- **Line 19:** "Elope/" (directory path in code block)
- **Context:** Elope/ ├── server/ ├── client/ ├── packages/
- **Recommendation:** CHANGE to "MAIS/" or "macon-ai-solutions/"
- **Reason:** Root directory identifier

---

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE.md`

- **Line 5:** "Elope is a **modular monolith**: one API process with clear service boundaries..."
- **Context:** Elope is a **modular monolith**: one API process with clear service boundaries, a thin HTTP layer...
- **Recommendation:** CHANGE to "MAIS is a **modular monolith**..."
- **Reason:** Platform name in main description

- **Line 9:** "Starting Sprint 2 (January 2025), Elope is transitioning to a **config-driven, agent-powered platform**..."
- **Context:** Starting Sprint 2 (January 2025), Elope is transitioning to a **config-driven, agent-powered platform**...
- **Recommendation:** CHANGE to "MAIS is transitioning..."
- **Reason:** Platform transition description

---

**File:** `/Users/mikeyoung/CODING/MAIS/CONTRIBUTING.md`

- **Line 1:** "# Contributing to Elope"
- **Context:** # Contributing to Elope This guide will help you get started with development...
- **Recommendation:** CHANGE to "# Contributing to MAIS"
- **Reason:** Document title

- **Line 3:** "Thank you for your interest in contributing to Elope!"
- **Context:** Thank you for your interest in contributing to Elope! This guide will help you get started...
- **Recommendation:** CHANGE to "...contributing to MAIS!"
- **Reason:** Welcome statement

- **Line 47:** "git clone https://github.com/yourusername/elope.git"
- **Context:** git clone https://github.com/yourusername/elope.git cd elope
- **Recommendation:** CHANGE to appropriate repo URL (will depend on actual repository)
- **Reason:** Repository clone instruction

- **Line 48:** "cd elope"
- **Context:** cd elope
- **Recommendation:** CHANGE to "cd mais" or "cd macon-ai-solutions"
- **Reason:** Directory change instruction

- **Line 75:** "createdb elope_dev"
- **Context:** createdb elope_dev
- **Recommendation:** CHANGE to "createdb mais_dev"
- **Reason:** Database name reference

- **Line 80:** "DATABASE_URL=\"postgresql://username:password@localhost:5432/elope_dev?schema=public\""
- **Context:** DATABASE_URL="postgresql://username:password@localhost:5432/elope_dev?schema=public"
- **Recommendation:** CHANGE to "mais_dev"
- **Reason:** Database name in connection string

- **Line 144:** "Elope is a **modular monolith** using npm workspaces..."
- **Context:** Elope is a **modular monolith** using npm workspaces with clear separation of concerns.
- **Recommendation:** CHANGE to "MAIS is a **modular monolith**..."
- **Reason:** Platform description in project structure section

- **Line 147:** "elope/" (directory path)
- **Context:** elope/ ├── server/ ├── client/
- **Recommendation:** CHANGE to "mais/"
- **Reason:** Root directory name

- **Line 649:** "Thank you for contributing to Elope!"
- **Context:** Thank you for contributing to Elope! Your efforts help make this project better...
- **Recommendation:** CHANGE to "...contributing to MAIS!"
- **Reason:** Closing statement

---

**File:** `/Users/mikeyoung/CODING/MAIS/START_HERE.md`

- **Line 1:** "# 📍 START HERE - Elope Platform Documentation Index"
- **Context:** # 📍 START HERE - Elope Platform Documentation Index
- **Recommendation:** CHANGE to "# 📍 START HERE - MAIS Platform Documentation Index"
- **Reason:** Document title

---

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE_DIAGRAM.md`

- **Line 18:** "elope/" (directory path)
- **Context:** elope/ ├── server/
- **Recommendation:** CHANGE to "mais/"
- **Reason:** Directory structure reference

---

**File:** `/Users/mikeyoung/CODING/MAIS/CODEBASE_EXPLORATION_COMPLETE.md` (continued)

- **Line 23:** "Elope/" (structural reference)
- **Context:** Elope/ ├── server/ ├── client/
- **Recommendation:** CHANGE to "MAIS/"
- **Reason:** Project structure identifier

- **Line 35:** "ElopeWidget.init({" (in code example)
- **Context:** ElopeWidget.init({ containerId: 'elope-booking-widget',
- **Recommendation:** CHANGE to "MAISWidget.init({" and update containerId appropriately
- **Reason:** Widget class name reference

- **Line 37:** "containerId: 'elope-booking-widget'" (in code example)
- **Context:** containerId: 'elope-booking-widget',
- **Recommendation:** CHANGE to appropriate widget identifier (e.g., 'mais-booking-widget')
- **Reason:** Widget HTML element identifier

- **Line 39:** "{ source: 'elope-widget', type, ...data }" (in code example)
- **Context:** { source: 'elope-widget', type, ...data },
- **Recommendation:** CHANGE to "{ source: 'mais-widget', type, ...data }"
- **Reason:** Widget source identifier

---

### Major Documentation References

**File:** `/Users/mikeyoung/CODING/MAIS/EXPLORATION_SUMMARY.md`

- **Line 1:** "# Elope Codebase Exploration - Executive Summary"
- **Context:** # Elope Codebase Exploration - Executive Summary
- **Recommendation:** CHANGE to "# MAIS Codebase Exploration - Executive Summary"
- **Reason:** Document title

- **Line 3:** "## What is Elope?"
- **Context:** ## What is Elope? Elope is a \*\*production-ready multi-tenant...
- **Recommendation:** CHANGE to "## What is MAIS?"
- **Reason:** Section heading

- **Line 4:** "Elope is a **production-ready multi-tenant wedding/elopement booking platform**"
- **Context:** Elope is a **production-ready multi-tenant wedding/elopement booking platform** that enables...
- **Recommendation:** CHANGE to "MAIS is a **production-ready multi-tenant...**"
- **Reason:** Platform definition

---

**File:** `/Users/mikeyoung/CODING/MAIS/ARCHITECTURE_COMPLETENESS_AUDIT.md`

- **Line 1:** "The Elope platform is a **production-ready, multi-tenant SaaS wedding booking system**"
- **Context:** The Elope platform is a **production-ready, multi-tenant SaaS wedding booking system** with...
- **Recommendation:** CHANGE to "The MAIS platform..."
- **Reason:** Platform name in opening sentence

---

**File:** `/Users/mikeyoung/CODING/MAIS/UI_UX_IMPROVEMENT_PLAN.md`

- **Line 1:** "# Elope UI/UX Comprehensive Improvement Plan"
- **Context:** # Elope UI/UX Comprehensive Improvement Plan
- **Recommendation:** CHANGE to "# MAIS UI/UX Comprehensive Improvement Plan"
- **Reason:** Document title

- **Line 12:** "This plan transforms Elope's UI from a functional but inconsistent interface..."
- **Context:** This plan transforms Elope's UI from a functional but inconsistent interface into...
- **Recommendation:** CHANGE to "This plan transforms MAIS's UI..."
- **Reason:** Platform reference

- **Line 58:** "## Current Elope Assessment"
- **Context:** ## Current Elope Assessment (rating provided)
- **Recommendation:** CHANGE to "## Current MAIS Assessment"
- **Reason:** Section heading

- **Line 1046:** "This comprehensive plan transforms Elope from a functional platform..."
- **Context:** This comprehensive plan transforms Elope from a functional platform (6.5/10) to...
- **Recommendation:** CHANGE to "...transforms MAIS from a functional platform..."
- **Reason:** Platform reference in conclusion

---

**File:** `/Users/mikeyoung/CODING/MAIS/UI_UX_EXECUTION_BRIEF.md`

- **Line 1:** "# Elope UI/UX Improvement - Execution Brief"
- **Context:** # Elope UI/UX Improvement - Execution Brief
- **Recommendation:** CHANGE to "# MAIS UI/UX Improvement - Execution Brief"
- **Reason:** Document title

- **Line 3:** "**Project**: Elope Wedding Booking Platform UI/UX Transformation"
- **Context:** **Project**: Elope Wedding Booking Platform UI/UX Transformation
- **Recommendation:** CHANGE to "**Project**: MAIS Wedding Booking Platform UI/UX Transformation"
- **Reason:** Project identifier

- **Line 310:** "I need to execute the Elope UI/UX improvement plan."
- **Context:** I need to execute the Elope UI/UX improvement plan.
- **Recommendation:** CHANGE to "...execute the MAIS UI/UX improvement plan."
- **Reason:** Platform name reference

---

**File:** `/Users/mikeyoung/CODING/MAIS/DESIGN_SYSTEM_IMPLEMENTATION.md`

- **Line 1:** "# Elope Design System - Apple-Quality Implementation"
- **Context:** # Elope Design System - Apple-Quality Implementation
- **Recommendation:** CHANGE to "# MAIS Design System - Apple-Quality Implementation"
- **Reason:** Document title

- **Line 5:** "A comprehensive design token system has been created for the Elope wedding platform..."
- **Context:** A comprehensive design token system has been created for the Elope wedding platform...
- **Recommendation:** CHANGE to "...for the MAIS wedding platform..."
- **Reason:** Platform name

- **Line 530:** "The design token system is fully integrated with the existing Elope codebase:"
- **Context:** The design token system is fully integrated with the existing Elope codebase:
- **Recommendation:** CHANGE to "...existing MAIS codebase:"
- **Reason:** Platform name

- **Line 623:** "**Maintained by**: Elope Platform Design Team"
- **Context:** **Maintained by**: Elope Platform Design Team
- **Recommendation:** CHANGE to "**Maintained by**: MAIS Platform Design Team"
- **Reason:** Platform team reference

---

**File:** `/Users/mikeyoung/CODING/MAIS/COMPREHENSIVE_CODEBASE_ANALYSIS.md`

- **Line 1:** "# Elope Codebase - Comprehensive Architecture Analysis"
- **Context:** # Elope Codebase - Comprehensive Architecture Analysis
- **Recommendation:** CHANGE to "# MAIS Codebase - Comprehensive Architecture Analysis"
- **Reason:** Document title

- **Line 5:** "**Elope** is a production-ready, multi-tenant SaaS wedding booking platform..."
- **Context:** **Elope** is a production-ready, multi-tenant SaaS wedding booking platform built with...
- **Recommendation:** CHANGE to "**MAIS** is a production-ready..."
- **Reason:** Platform identifier

- **Line 72:** "**@elope/contracts** (274 lines of API definition)"
- **Context:** **@elope/contracts** (274 lines of API definition)
- **Recommendation:** CHANGE to "**@mais/contracts**" or "**@macon/contracts**"
- **Reason:** NPM package namespace

- **Line 78:** "**@elope/shared**"
- **Context:** **@elope/shared** (Shared utilities)
- **Recommendation:** CHANGE to "**@mais/shared**" or "**@macon/shared**"
- **Reason:** NPM package namespace

- **Line 110:** "/elope" (API route path)
- **Context:** /elope (REST endpoint prefix)
- **Recommendation:** CHANGE to "/mais" or appropriate API path
- **Reason:** API endpoint reference

- **Line 471:** "**Developer Routes** (Mock Mode Only)"
- **Context:** Developer routes are mock-only routes used during development...
- **Recommendation:** KEEP (This is about the type of routes, not the platform name)
- **Reason:** Not a platform name reference

- **Line 1045-1048:** References to `@elope/web`, `@elope/api`, `@elope/contracts`, `@elope/shared`
- **Context:** Package naming in package.json descriptions
- **Recommendation:** CHANGE to appropriate package names (e.g., `@mais/web`, `@mais/api`, etc.)
- **Reason:** NPM workspace package names

- **Line 1075:** "**Elope** is a well-architected, production-ready SaaS platform..."
- **Context:** **Elope** is a well-architected, production-ready SaaS platform built with...
- **Recommendation:** CHANGE to "**MAIS** is a well-architected..."
- **Reason:** Platform identifier

---

### Package/Namespace References (NPM Packages)

**File:** `/Users/mikeyoung/CODING/MAIS/REFACTOR_SUCCESS_PAGE.md`

- **Lines:** Multiple references to `@elope/contracts`
- **Context:** Import statements and documentation referencing the contracts package
- **Recommendation:** CHANGE all `@elope/contracts` to `@mais/contracts`
- **Reason:** NPM workspace package namespace

---

**File:** `/Users/mikeyoung/CODING/MAIS/TYPESCRIPT_AUDIT_PHASE_1_2.md`

- **Line 40:** "- `PackageDto` from @elope/contracts"
- **Context:** Package imports and type references
- **Recommendation:** CHANGE to `@mais/contracts`
- **Reason:** NPM package namespace

- **Line 97:** "**Severity:** These endpoints don't exist in @elope/contracts"
- **Context:** Type checking reference
- **Recommendation:** CHANGE to `@mais/contracts`
- **Reason:** NPM package namespace

- **Line 100:** "- Add endpoints to @elope/contracts server definitions"
- **Context:** Action item
- **Recommendation:** CHANGE to `@mais/contracts`
- **Reason:** NPM package namespace

- **Lines 303-304:** "| @elope/contracts |" and "| @elope/shared |"
- **Context:** Package alias table
- **Recommendation:** CHANGE to `@mais/contracts` and `@mais/shared`
- **Reason:** NPM package namespaces

---

**File:** `/Users/mikeyoung/CODING/MAIS/REFACTOR_SUMMARY.md`

- **Line 184:** "- Imports from `@elope/contracts`"
- **Context:** Dependency documentation
- **Recommendation:** CHANGE to `@mais/contracts`
- **Reason:** NPM package namespace

---

**File:** `/Users/mikeyoung/CODING/MAIS/REFACTOR_VISUAL.md`

- **Line 335:** "- @elope/contracts (for DTOs)"
- **Context:** Dependency reference
- **Recommendation:** CHANGE to "@mais/contracts"
- **Reason:** NPM package namespace

---

### Client/Component Documentation

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/lib/PACKAGE_PHOTO_API_README.md`

- **Line 1:** "This implementation provides a complete API service layer for handling package photo uploads in the Elope wedding booking platform."
- **Context:** Introduction
- **Recommendation:** CHANGE to "...in the MAIS wedding booking platform."
- **Reason:** Platform name

- **Lines:** Multiple references to `/Users/mikeyoung/CODING/Elope/` in file paths
- **Context:** File path examples
- **Recommendation:** CHANGE paths to MAIS directory structure
- **Reason:** File path updates

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/PackagePhotoUploader.md`

- **Line:** "Production-ready React component for uploading and managing package photos in the Elope wedding booking platform."
- **Context:** Component description
- **Recommendation:** CHANGE to "...in the MAIS wedding booking platform."
- **Reason:** Platform name

- **Line:** "Internal component for the Elope wedding booking platform."
- **Context:** Usage note
- **Recommendation:** CHANGE to "...for the MAIS wedding booking platform."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/DESIGN_TOKENS_GUIDE.md`

- **Line 1:** "# Elope Design System - Design Tokens Guide"
- **Context:** Document title
- **Recommendation:** CHANGE to "# MAIS Design System - Design Tokens Guide"
- **Reason:** Document title

- **Line 3:** "The Elope platform uses three primary brand colors:"
- **Context:** Description
- **Recommendation:** CHANGE to "The MAIS platform uses..."
- **Reason:** Platform name

- **Line:** "**Maintained by**: Elope Platform Team"
- **Context:** Attribution
- **Recommendation:** CHANGE to "**Maintained by**: MAIS Platform Team"
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/DESIGN_TOKENS_CHEATSHEET.md`

- **Line:** "Quick reference for the most commonly used design tokens in the Elope platform."
- **Context:** Introduction
- **Recommendation:** CHANGE to "...in the MAIS platform."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/styles/theme-zones.md`

- **Line 1:** "# Elope Theme Zones Documentation"
- **Context:** Document title
- **Recommendation:** CHANGE to "# MAIS Theme Zones Documentation"
- **Reason:** Document title

- **Line 3:** "The Elope application uses **two distinct theme zones**"
- **Context:** Description
- **Recommendation:** CHANGE to "The MAIS application uses..."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/contexts/README.md`

- **Line:** "This directory contains the unified authentication context for the Elope application"
- **Context:** Directory description
- **Recommendation:** CHANGE to "...for the MAIS application"
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/contexts/AUTH_CONTEXT_USAGE.md`

- **Line:** "Complete guide for using the unified AuthContext with role-based access control in the Elope application."
- **Context:** Guide introduction
- **Recommendation:** CHANGE to "...in the MAIS application."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/contexts/AUTH_QUICK_REFERENCE.md`

- **Line:** "Quick reference guide for common authentication patterns in the Elope application."
- **Context:** Introduction
- **Recommendation:** CHANGE to "...in the MAIS application."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/WIDGET_README.md`

- **Line 1:** "# Elope Widget Implementation (Phase 2)"
- **Context:** Document title
- **Recommendation:** CHANGE to "# MAIS Widget Implementation (Phase 2)"
- **Reason:** Document title

- **Line:** "Elope API Server (with tenant isolation)"
- **Context:** Architecture description
- **Recommendation:** CHANGE to "MAIS API Server"
- **Reason:** Platform name

- **Line:** "- Isolated styling with `.elope-widget` class"
- **Context:** Style class documentation
- **Recommendation:** CHANGE to `.mais-widget`
- **Reason:** CSS class name

- **Line:** "https://cdn.elope.com/widget.html?tenant=acme&apiKey=pk_live_xxx"
- **Context:** CDN URL example
- **Recommendation:** CHANGE to appropriate MAIS domain
- **Reason:** Domain/URL reference

- **Line:** "<div id=\"elope-widget\"></div>"
- **Context:** HTML example
- **Recommendation:** CHANGE to "id=\"mais-widget\""
- **Reason:** HTML element identifier

- **Line:** "ElopeWidget.init({"
- **Context:** Widget initialization code
- **Recommendation:** CHANGE to "MAISWidget.init({"
- **Reason:** Widget class name

- **Line:** "element: '#elope-widget',"
- **Context:** Configuration
- **Recommendation:** CHANGE to "'#mais-widget'"
- **Reason:** Element selector

- **Line:** "All widget styles scoped to `.elope-widget` class"
- **Context:** Documentation
- **Recommendation:** CHANGE to "`.mais-widget`"
- **Reason:** CSS class reference

---

**File:** `/Users/mikeyoung/CODING/MAIS/client/ROLE_BASED_ARCHITECTURE.md`

- **Line:** "...for the Elope wedding booking platform."
- **Context:** Platform reference
- **Recommendation:** CHANGE to "...for the MAIS wedding booking platform."
- **Reason:** Platform name

---

### Operational/Setup Documentation

**File:** `/Users/mikeyoung/CODING/MAIS/DEVELOPING.md`

- **Line 62:** "createdb elope_dev"
- **Context:** Database setup command
- **Recommendation:** CHANGE to "createdb mais_dev"
- **Reason:** Database name

- **Line 67:** "DATABASE_URL=\"postgresql://username:password@localhost:5432/elope_dev?schema=public\""
- **Context:** Environment variable example
- **Recommendation:** CHANGE to "mais_dev"
- **Reason:** Database name

- **Line 123:** "DATABASE_URL=postgresql://username:password@localhost:5432/elope_dev?schema=public"
- **Context:** Environment variable example
- **Recommendation:** CHANGE to "mais_dev"
- **Reason:** Database name

---

**File:** `/Users/mikeyoung/CODING/MAIS/IMPLEMENTATION_SUMMARY.md`

- **Line 4:** "...for the Elope wedding booking platform."
- **Context:** Project description
- **Recommendation:** CHANGE to "...for the MAIS wedding booking platform."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/QUICK_REFERENCE.md`

- **Line 1:** "# Elope Platform - Quick Reference Guide"
- **Context:** Document title
- **Recommendation:** CHANGE to "# MAIS Platform - Quick Reference Guide"
- **Reason:** Document title

- **Line 2:** "The Elope platform has reached an excellent state of production readiness:"
- **Context:** Opening statement
- **Recommendation:** CHANGE to "The MAIS platform has reached..."
- **Reason:** Platform name

---

### Database and Configuration

**File:** `/Users/mikeyoung/CODING/MAIS/CHANGELOG.md`

- **Line 585-587:** References to "elope" in GitHub URLs
- **Context:** Version comparison links
- **Recommendation:** CHANGE to appropriate repository URLs for MAIS
- **Reason:** Repository URL updates

---

**File:** `/Users/mikeyoung/CODING/MAIS/SERVER_IMPLEMENTATION_CHECKLIST.md`

- **Line 53:** "email: 'admin@elope.com'"
- **Context:** Sample data
- **Recommendation:** CHANGE to "admin@mais.com" or similar
- **Reason:** Example email for documentation

---

**File:** `/Users/mikeyoung/CODING/MAIS/udo.md`

- **Line:** "DATABASE_URL=postgresql://user:pass@prod-server:5432/elope_prod"
- **Context:** Environment variable example
- **Recommendation:** CHANGE to "mais_prod"
- **Reason:** Database name

---

### Architecture and System Documents

**File:** `/Users/mikeyoung/CODING/MAIS/LAUNCH_ACTION_PLAN.md`

- **Line 12:** "Your Elope multi-tenant platform..."
- **Context:** Opening assessment
- **Recommendation:** CHANGE to "Your MAIS multi-tenant platform..."
- **Reason:** Platform name

- **Line 420:** "cd /Users/mikeyoung/CODING/Elope"
- **Context:** Directory navigation command
- **Recommendation:** CHANGE to appropriate MAIS directory
- **Reason:** File path update

---

**File:** `/Users/mikeyoung/CODING/MAIS/CODE_HEALTH_ASSESSMENT.md`

- **Line 12:** "The Elope codebase is a well-structured monorepo..."
- **Context:** Assessment opening
- **Recommendation:** CHANGE to "The MAIS codebase is..."
- **Reason:** Platform name

- **Line 1586:** "The Elope codebase demonstrates solid architectural fundamentals..."
- **Context:** Conclusion
- **Recommendation:** CHANGE to "The MAIS codebase demonstrates..."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/PRODUCTION_LAUNCH_READINESS_DETAILED.md`

- **Line 11:** "Elope's multi-tenant architecture..."
- **Context:** Opening statement
- **Recommendation:** CHANGE to "MAIS's multi-tenant architecture..."
- **Reason:** Platform name

- **Line 1098:** "Elope's **core multi-tenant architecture is production-ready**..."
- **Context:** Conclusion section
- **Recommendation:** CHANGE to "MAIS's \*\*core multi-tenant architecture..."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/QUICK_START_GUIDE.md`

- **Line 1:** "# ⚡ QUICK START GUIDE - Elope Platform Launch"
- **Context:** Document title
- **Recommendation:** CHANGE to "# ⚡ QUICK START GUIDE - MAIS Platform Launch"
- **Reason:** Document title

---

**File:** `/Users/mikeyoung/CODING/MAIS/LAUNCH_READINESS_EXECUTIVE_SUMMARY.md`

- **Line 11:** "✅ **Elope's multi-tenant architecture is production-ready**..."
- **Context:** Key finding
- **Recommendation:** CHANGE to "✅ \*\*MAIS's multi-tenant architecture..."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/WAVE1_SUBAGENT_1A_REPORT.md`

- **Line 13:** "...across the Elope codebase."
- **Context:** Report scope
- **Recommendation:** CHANGE to "...across the MAIS codebase."
- **Reason:** Platform name

---

### CLI/Commands and Hidden Docs

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/commands/d.md`

- **Line:** "Start the Elope development environment:"
- **Context:** Command description
- **Recommendation:** CHANGE to "Start the MAIS development environment:"
- **Reason:** Platform name

- **Lines:** References to `/Users/mikeyoung/CODING/Elope`
- **Context:** File paths
- **Recommendation:** CHANGE to MAIS directory
- **Reason:** File path updates

---

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/commands/test.md`

- **Line 1:** "Run the comprehensive Elope test suite."
- **Context:** Command title
- **Recommendation:** CHANGE to "Run the comprehensive MAIS test suite."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/PROJECT.md`

- **Line 1:** "# Elope - Multi-Tenant Wedding Booking Platform"
- **Context:** Project title
- **Recommendation:** CHANGE to "# MAIS - Multi-Tenant Property Management Platform"
- **Reason:** Project name update

---

### .claude/ Hidden Documentation

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/DOCUMENTATION_SYSTEM_STRATEGIC_AUDIT.md`

- **Multiple references** to "Elope" as the project name in comparisons
- **Recommendation:** CHANGE all references to "MAIS" in this analysis document
- **Reason:** Project name consistency

---

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/MULTI_TENANT_READINESS_ASSESSMENT.md`

- **Line 11:** "The Elope codebase has **excellent multi-tenant foundation**..."
- **Context:** Assessment opening
- **Recommendation:** CHANGE to "The MAIS codebase has..."
- **Reason:** Platform name

- **Lines 122-137:** References to "elope.com" domain examples
- **Context:** Example configuration
- **Recommendation:** CHANGE to "mais.com" or appropriate domain
- **Reason:** Domain reference

- **Lines 224-231:** Architecture diagram showing "\*.elope.com"
- **Context:** DNS configuration example
- **Recommendation:** CHANGE to "\*.mais.com"
- **Reason:** Domain reference

- **Line 438:** "The Elope platform has a **solid multi-tenant foundation**..."
- **Context:** Summary
- **Recommendation:** CHANGE to "The MAIS platform..."
- **Reason:** Platform name

---

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/TEST_FIX_PLAN.md`

- **Line 12:** "You're working on the Elope Wedding Platform."
- **Context:** Context setting
- **Recommendation:** CHANGE to "You're working on the MAIS Platform."
- **Reason:** Platform name

- **Line 21:** "/Users/mikeyoung/CODING/Elope/"
- **Context:** Working directory
- **Recommendation:** CHANGE to "/Users/mikeyoung/CODING/MAIS/"
- **Reason:** Directory path

---

**File:** `/Users/mikeyoung/CODING/MAIS/.claude/E2E_TEST_INVESTIGATION.md`

- **Lines:** Multiple references to "elope" in test tenant names and API keys
- **Context:** Test configuration
- **Recommendation:** CHANGE to "mais" in test identifiers
- **Reason:** Test naming consistency

---

---

## SECTION 2: WEDDING INDUSTRY REFERENCES TO KEEP

These references are to "elopement" or "elopements" - the wedding industry term for intimate wedding ceremonies. These are CORRECT and should NOT be changed.

### Elopement Package References

**File:** `/Users/mikeyoung/CODING/MAIS/README.md`

- **Line:** "Seasonal Promotions: \"It's January - should we feature winter elopement packages?\""
- **Context:** Agent capability example
- **Recommendation:** KEEP
- **Reason:** "elopement packages" refers to wedding elopement services, correct industry terminology

**File:** `/Users/mikeyoung/CODING/MAIS/WAVE1_SUBAGENT_1C_REPORT.md`

- **Lines:** "slug: 'basic-elopement'" and "title: 'Basic Elopement'"
- **Context:** Wedding package examples
- **Recommendation:** KEEP
- **Reason:** "Elopement" is correct wedding industry terminology for intimate ceremonies

**File:** `/Users/mikeyoung/CODING/MAIS/CODEBASE_EXPLORATION_COMPLETE.md`

- **Line:** "multi-tenant wedding/elopement booking platform"
- **Context:** Platform description
- **Recommendation:** KEEP
- **Reason:** Correct wedding industry term

**File:** `/Users/mikeyoung/CODING/MAIS/playwright-report/` (multiple files)

- **References:** "elopements" in customer testimonials and content
- **Context:** Website copy about wedding services
- **Recommendation:** KEEP
- **Reason:** Correct wedding industry terminology

---

## SECTION 3: FILE PATH REFERENCES

These are file paths containing "/Elope/" that will be updated by system-level directory changes.

**Note:** These 21 references will be automatically corrected when the directory is renamed from `/Users/mikeyoung/CODING/Elope/` to `/Users/mikeyoung/CODING/MAIS/` at the filesystem level.

Examples:

- `/Users/mikeyoung/CODING/Elope/client/src/...`
- `/Users/mikeyoung/CODING/Elope/server/src/...`
- `/Users/mikeyoung/CODING/Elope/UI_UX_IMPROVEMENT_PLAN.md`
- `/Users/mikeyoung/CODING/Elope/.playwright-mcp/...`

These are found in:

- REFACTOR_SUCCESS_PAGE.md
- TYPESCRIPT_AUDIT_PHASE_1_2.md
- PHASE1_P0_TESTS_IMPLEMENTATION_REPORT.md
- UI_UX_EXECUTION_BRIEF.md
- UI_UX_IMPROVEMENT_PLAN.md
- UI_UX_EXECUTION_BRIEF.md
- REFACTOR_VISUAL.md
- Multiple .claude/ files
- Multiple TESTING documents

---

## SECTION 4: NPM PACKAGE NAMESPACES

These need coordinated updates with actual package.json file changes:

**Current namespace:** `@elope/*`
**New namespace:** `@mais/*` or `@macon/*` (to be determined)

Affected packages:

- `@elope/contracts` → `@mais/contracts`
- `@elope/shared` → `@mais/shared`
- `@elope/web` → `@mais/web`
- `@elope/api` → `@mais/api`

Files containing package references:

- COMPREHENSIVE_CODEBASE_ANALYSIS.md
- TYPESCRIPT_AUDIT_PHASE_1_2.md
- REFACTOR_SUCCESS_PAGE.md
- REFACTOR_SUMMARY.md
- REFACTOR_VISUAL.md

---

## SECTION 5: IMPLEMENTATION PRIORITY

### Priority 1: Critical (Do First - 2 hours)

1. README.md - Line 91 - "Elope is evolving" → "MAIS is evolving"
2. CONTRIBUTING.md - All platform name references and database names
3. START_HERE.md - Document title
4. All major document titles in root directory

### Priority 2: High (Do Next - 4 hours)

1. Architecture documents (ARCHITECTURE.md, DECISIONS.md)
2. Design system documentation (DESIGN*TOKENS*\*.md, theme-zones.md)
3. Client documentation (all client/src/\*_/_.md)
4. Design and UI documents

### Priority 3: Medium (Do After - 3 hours)

1. Archive/hidden .claude/ documentation
2. Command documentation in .claude/commands/
3. Analysis and report documents
4. Historical/phase documentation

### Priority 4: Low (Maintenance - 1 hour)

1. File path references (will update automatically)
2. Example emails and test data
3. Historical changelogs

### Priority 5: Coordinated (With Build System)

1. NPM package namespace updates (requires package.json changes)
2. Database name changes (requires .env updates)
3. Domain/CDN references (requires infrastructure decisions)

---

## SECTION 6: REGEX PATTERNS FOR BULK REPLACEMENT

For automated find-and-replace operations:

### Pattern 1: Platform Name at Word Boundary

**Find:** `\bElope\b`
**Replace:** `MAIS`
**Confidence:** HIGH

### Pattern 2: Lowercase Project References

**Find:** `\belope\b` (but NOT "elopement")
**Replace:** `mais`
**Confidence:** MEDIUM - needs context verification

### Pattern 3: Database Names

**Find:** `elope_([a-z_]+)`
**Replace:** `mais_$1`
**Confidence:** HIGH

### Pattern 4: NPM Namespaces

**Find:** `@elope/`
**Replace:** `@mais/`
**Confidence:** HIGH

### Pattern 5: CSS Classes

**Find:** `\.elope-`
**Replace:** `.mais-`
**Confidence:** HIGH

### Pattern 6: HTML IDs

**Find:** `id=["']elope-`
**Replace:** `id="mais-`
**Confidence:** HIGH

---

## SUMMARY STATISTICS

| Category                      | Count | Action      |
| ----------------------------- | ----- | ----------- |
| **Platform Names (Elope)**    | 89    | CHANGE      |
| **Wedding Terms (elopement)** | 42    | KEEP        |
| **File Paths (/Elope/)**      | 21    | Auto-update |
| **NPM Packages (@elope/)**    | 8     | Coordinate  |
| **TOTAL**                     | 160   | -           |

---

## NOTES FOR DEVELOPERS

1. **Context Matters:** Always verify context before replacing "elope" - could be "elopement" (keep) vs "Elope" platform name (change)

2. **Cascading Changes:** Updates to one file may require updates in others (e.g., changing database name requires updating DEVELOPING.md, CONTRIBUTING.md, and .env files)

3. **NPM Workspace Update:** Changing `@elope/*` package names requires:
   - Update package.json files in server/, client/, and packages/
   - Update tsconfig paths
   - Run npm install
   - Update all import statements in code
   - This is a separate task from documentation updates

4. **Testing:** After making changes:
   - Run grep to verify no "Elope" platform references remain
   - Verify "elopement" references are still present
   - Check that file paths are correctly updated

---

**Report Generated:** November 18, 2025
**Reporter:** Documentation Analysis System
**Status:** Ready for Implementation
