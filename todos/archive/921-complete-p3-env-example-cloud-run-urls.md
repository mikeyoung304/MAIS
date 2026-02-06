# 921 - .env.example Contains Actual Cloud Run URLs

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (devops-harmony-analyst)
**File:** `.env.example` (root, lines 207-213)

## Problem

The root `.env.example` contains actual Cloud Run URLs with GCP project numbers. While not a direct security risk (project numbers are not secrets), this is unnecessary information leakage in a public-facing file.

## Fix

Replace with placeholder URLs:

```
CUSTOMER_AGENT_URL=https://customer-agent-XXXXXXXXXX-uc.a.run.app
TENANT_AGENT_URL=https://tenant-agent-XXXXXXXXXX-uc.a.run.app
RESEARCH_AGENT_URL=https://research-agent-XXXXXXXXXX-uc.a.run.app
```
