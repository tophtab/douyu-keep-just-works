# Legacy Config Boundary Inventory

Inspected on 2026-09-30 before implementation.

| Owner | Compatibility to remove |
| --- | --- |
| `src/core/config-normalization.ts` | Credential aliases, active/model/send/number, enabled room map, old cron rewrite, unused options |
| `src/core/task-defaults.ts` | LEGACY_DEFAULT_KEEPALIVE_CRON |
| `src/docker/config-store.ts` | Update aliases, old cookie merge, field deletion for old section aliases, obsolete normalization argument |
| `src/docker/config-validation.ts` | Active/model/send/number validation and double-card enabled-map exceptions |
| `src/docker/server-config-routes.ts` | Old credential validation and /api/cookie cookie alias |
| `src/docker/runtime-app-context.ts` | Old credential fields in cookie-source detection |
| `README.md` | Entire 配置升级与回滚 subsection, including cron bullet |

Behavior seams: `test/config-guardrails-contract.test.js`, `test/server-route-guardrails-contract.test.js`, `test/douyu-passport-contract.test.js`, module-loader helpers and `createServer(ctx)`. Convert old credential fixtures without weakening auth/secret assertions. Config-store helpers support partial-update and temporary-disk tests.

Active specs: backend database-guidelines.md, backend/contracts.md config/persistence sections, frontend/type-safety.md canonical-boundary paragraph.

Do not confuse current CookieCloud legacy encryption, Yuba legacy signing, remote double-card active state, Vue/CSS active state, internal allocation helper model arguments or manual Passport recovery variable names with obsolete config aliases. Search by ownership rather than replacing strings globally.

Task requirements supersede spec clauses requiring migration. Preserve unrelated config/auth/allocation/Docker contracts. Nine unrelated Trellis files were modified at session start; leave them intact.
