# brainstorm: 全量代码与架构优化分析

## Goal

对当前仓库做一次全量的代码、架构、质量、可维护性和性能优化分析，输出可执行的优化方向、优先级和后续拆分建议，帮助后续迭代减少技术债并提高稳定性。

## What I already know

* 用户希望使用 `trellis-brainstorm` 做一次全量优化分析。
* 分析范围包括代码优化、架构优化等多个方面。
* 当前工作树在任务创建前是 clean。
* 项目是 Trellis 管理的 single-repo，规范层包含 backend 与 frontend。
* 项目是 Node 24 + TypeScript + Express 5 + Vue 3/Vite 的 Docker-first 单仓库。
* 主要维护路径为 `src/core/`、`src/docker/`、`src/docker/webui/`。
* 质量脚本包括 lint、后端/前端 type-check、contract tests、Docker build。

## Assumptions (temporary)

* 本任务以分析和规划为主，暂不直接修改业务代码。
* 输出需要按优先级拆分，便于后续创建独立实施任务。
* 分析应覆盖可读性、重复代码、模块边界、数据流、错误处理、构建质量、测试覆盖和运行风险。

## Open Questions

* 已回答：用户希望三条路线都做，但本轮先从低风险安全/类型硬化开始；测试护栏和架构拆分留到新的对话窗口。

## Requirements (evolving)

* 扫描项目结构、主要入口、构建脚本、配置和现有规范。
* 识别代码优化、架构优化、质量保障和维护流程方面的问题与机会。
* 给出分级优先级和建议拆分方式。
* 分析结论必须基于实际文件、质量检查和依赖检查结果。
* 优先推荐低风险、可分批执行的优化，而不是大规模重写。

## Acceptance Criteria (evolving)

* [x] PRD 记录分析目标、范围、假设和最终决策。
* [x] 产出一份基于实际代码扫描的优化分析报告。
* [x] 报告包含问题证据、风险说明、建议方案和优先级。
* [x] 明确哪些优化适合作为后续独立任务，哪些暂不建议做。
* [x] 用户确认下一步落地路线。

## Definition of Done (team quality bar)

* Tests added/updated where implementation changes occur.
* Lint / typecheck / CI green when code is changed.
* Docs/notes updated if behavior or architecture guidance changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 本轮不直接进行大规模重构。
* 不引入新依赖或改动运行时行为，除非用户后续明确要求进入实施。
* 不做线上性能压测或生产数据分析。
* 本轮不实施“测试护栏优先”和“重点架构拆分”两条路线。

## Technical Notes

* Task path: `.trellis/tasks/05-29-full-code-architecture-optimization-analysis`
* Initial Trellis context loaded via `.agents/skills/trellis-start/SKILL.md` and `.agents/skills/trellis-brainstorm/SKILL.md`.
* Thinking guides index read from `.trellis/spec/guides/index.md`.
* Backend specs read: `.trellis/spec/backend/index.md`, `directory-structure.md`, `error-handling.md`, `quality-guidelines.md`.
* Frontend specs read: `.trellis/spec/frontend/index.md`, `directory-structure.md`, `state-management.md`, `quality-guidelines.md`.
* Analysis report: `optimization-analysis.md`.
* Checks run: `npm run lint` passed; `npm run type-check` passed; `npm run test:contracts` passed with 24 tests.
* Dependency audit: `npm audit --omit=dev --audit-level=moderate` reported 2 moderate production advisories (`qs`, `ws`).
* `npm outdated --depth=0` found patch updates including `ws`, `vite`, `vue`, `axios`, `vue-tsc`.
* Implementation result for Approach A:
  * `npm audit fix` updated lockfile entries for `qs` 6.15.2 and `ws` 8.21.0.
  * `tsconfig.docker.json` now enables `noImplicitAny`.
  * `src/core/api.ts` and `src/core/double-card.ts` now narrow external response data before array processing.
  * `.trellis/spec/backend/quality-guidelines.md` documents the `noImplicitAny` and response-narrowing convention.
* Verification after implementation:
  * `npm run lint` passed.
  * `npm run type-check` passed.
  * `npm run test:contracts` passed with 24 tests.
  * `npm audit --omit=dev --audit-level=moderate` passed with 0 vulnerabilities.
  * `npm run build:docker` passed.

## Research Notes

### What the Codebase Already Does Well

* Docker-first runtime boundary is documented and enforced through specs and tests.
* Runtime scheduling and task execution already have dedicated modules.
* Cookie credential recovery is centralized and guarded by contract tests.
* WebUI is Vue-only and avoids legacy imperative bridge state.
* Contract tests encode several important architecture decisions.

### Optimization Themes

* Security/maintenance: patch audited production dependencies.
* Type safety: remove the remaining explicit `any` and enable backend `noImplicitAny`.
* Architecture: reduce responsibility concentration in `src/docker/runtime.ts`, `src/core/medal-sync.ts`, and `src/docker/webui/cookie.ts`.
* Test strategy: add behavior-level route/config tests before larger refactors; keep regex contract tests mainly for forbidden-pattern guarantees.

## Research References

* [`optimization-analysis.md`](optimization-analysis.md) — full code and architecture optimization analysis with prioritized findings.

## Feasible Approaches

### Approach A: Low-Risk Hardening First (Recommended)

* Patch audited dependencies.
* Remove explicit `any` and enable backend `noImplicitAny`.
* Optionally add a unified `npm run check` script.
* Lowest blast radius; gives immediate security/type-safety value.
* Status: implemented, except no `npm run check` script was added because it was optional and not necessary for the hardening target.

### Approach B: Add Test Guardrails Before Refactor

* Add route-level and config-normalization behavior tests.
* Clarify brittle regex contract tests.
* Best if the next goal is architectural cleanup but we want safer refactor conditions first.

### Approach C: Focused Architecture Cleanup

* Split CookieCloud sync and runtime config application out of `runtime.ts`.
* Refactor `medal-sync.ts` shared send-map normalization.
* Split WebUI `cookie.ts` behind the existing `useCookieLoginPage()` facade.
* Highest architectural impact, but should follow Approach B unless urgency is high.

## Decision (ADR-lite)

**Context**: The user requested a full optimization analysis, not immediate implementation.

**Decision**: Produce a repository-backed analysis report first, then implement Approach A as the first follow-up route: dependency security patch plus backend type-safety hardening.

**Consequences**: This avoids mixing broad analysis with risky refactors in one task. Test guardrails and architecture cleanup remain explicit follow-up tasks.

## Implementation Plan

* Run dependency maintenance to address audited production advisories.
* Replace the remaining explicit source `any` with a narrowed response shape.
* Enable backend `noImplicitAny`.
* Run lint, type-check, contract tests, and dependency audit verification.
