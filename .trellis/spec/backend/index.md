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
| [Douyu Auth Cookie Lifecycle](./auth-cookie-lifecycle.md) | Passport/main-site/Yuba cookie authority and lifetime contracts | Filled |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Filled |
| [Logging Guidelines](./logging-guidelines.md) | Runtime logging conventions | Filled |

---

## Pre-Development Checklist

Before backend changes:

- Read `CONTRIBUTING.md`, especially "Docker-First Development".
- Read [Directory Structure](./directory-structure.md) when adding, moving, or splitting modules.
- Read [Database Guidelines](./database-guidelines.md) before changing config persistence or adding durable state.
- Read [Douyu Auth Cookie Lifecycle](./auth-cookie-lifecycle.md) before touching Passport QR login, CookieCloud cookie authority, credential recovery, or Yuba SSO.
- Read [Error Handling](./error-handling.md) before touching routes, task runners, cookie handling, or Douyu API calls.
- Read [Logging Guidelines](./logging-guidelines.md) before adding runtime messages.
- Read [Quality Guidelines](./quality-guidelines.md) before finishing any backend change.

---

**Language**: All documentation should be written in **English**.
