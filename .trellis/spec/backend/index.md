# Backend Development Guidelines

> Conventions for the maintained Node.js Docker runtime and shared Douyu logic.

---

## Overview

This project is a single-repo TypeScript application. The maintained backend runtime is the Docker deployment path:

- shared Douyu API and task logic live in `src/core/`
- Docker runtime, Express routes, scheduling, config IO, logs, and static WebUI serving live in `src/docker/`
- the Docker WebUI build must remain part of `npm run build:docker`

These guidelines document current project reality, not an aspirational rewrite.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Filled |
| [Database Guidelines](./database-guidelines.md) | Persistence and config storage patterns | Filled |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Filled |
| [Testing Guidelines](./testing-guidelines.md) | Contract-test taxonomy and modernization rules | Filled |
| [Logging Guidelines](./logging-guidelines.md) | Runtime logging conventions | Filled |
| [Backend Contracts](./contracts.md) | Scenario contracts for high-risk backend behavior | Filled |

---

## Read Routing

Use this table before opening every backend spec file.

| Change area | Read |
|---|---|
| Adding, moving, or splitting backend modules | [Directory Structure](./directory-structure.md) |
| Config persistence, default config, manual passport config, normalization, or examples | [Database Guidelines](./database-guidelines.md), [Backend Contracts](./contracts.md#config-and-persistence-contracts) |
| Routes, task runners, CookieCloud, credential errors, or Douyu API failures | [Error Handling](./error-handling.md), [Backend Contracts](./contracts.md#credential-recovery-retry) |
| Passport QR login, safeAuth, CookieCloud authority, Yuba SSO, or cookie lifetime assumptions | [Backend Contracts](./contracts.md#passport-main-site-and-yuba-cookie-authority), [Backend Contracts](./contracts.md#project-owned-passport-qr-login-snapshots) |
| Glow-stick double-card detection or Douyu pocket card interpretation | [Backend Contracts](./contracts.md#glow-stick-double-card-detection) |
| Gift sending, room DID reuse, or multi-gift task sequencing | [Backend Contracts](./contracts.md#task-local-room-did-reuse), [Testing Guidelines](./testing-guidelines.md) |
| Dockerfile, `.dockerignore`, build workflow, fnOS FPK packaging, task metadata, type safety, or route architecture | [Quality Guidelines](./quality-guidelines.md), [Docker Image Build Cache](./contracts.md#docker-image-build-cache), [Docker CI Quality Gate](./contracts.md#docker-ci-quality-gate), [fnOS FPK Release](./contracts.md#fnos-fpk-release), [Docker Task Metadata Ownership](./contracts.md#docker-task-metadata-ownership) |
| Runtime log messages or log categories | [Logging Guidelines](./logging-guidelines.md) |
| Contract tests or source-inspection test modernization | [Testing Guidelines](./testing-guidelines.md) |

---

## Pre-Development Checklist

Before backend changes:

- Read `CONTRIBUTING.md`, especially "Docker-First Development".
- Read [Directory Structure](./directory-structure.md) when adding, moving, or splitting modules.
- Read [Database Guidelines](./database-guidelines.md) before changing config persistence or adding durable state.
- Read [Error Handling](./error-handling.md) before touching routes, task runners, cookie handling, or Douyu API calls.
- Read [Logging Guidelines](./logging-guidelines.md) before adding runtime messages.
- Read [Testing Guidelines](./testing-guidelines.md) before adding, removing, or modernizing contract tests.
- Read [Quality Guidelines](./quality-guidelines.md) before finishing any backend change.
- Read the matching section of [Backend Contracts](./contracts.md) when the change matches a row in Read Routing.

---

**Language**: All documentation should be written in **English**.
