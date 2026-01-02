# Cloudflare Deployment Guide

> **Status:** Legacy
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** Deprecated; use the receipts-first runbook

This document is intentionally **not** a step-by-step deployment guide anymore.

It previously included setup steps and operational advice that can drift from reality (and some details that are environment-specific). The canonical, receipts-first deployment procedure is:

- [docs/DEPLOY_PROD_RUN.md](./DEPLOY_PROD_RUN.md)

For the current list of Cloudflare “surfaces” (names only, no IDs):

- [docs/CLOUDFLARE_SURFACE.md](./CLOUDFLARE_SURFACE.md)

Evidence anchors (authoritative sources):

- Worker routes/bindings: `apps/api-worker/wrangler.toml`
- Pages project bindings (generated): `wrangler.toml`
- Deploy workflows: `.github/workflows/deploy-api.yml`, `.github/workflows/deploy-web.yml`
