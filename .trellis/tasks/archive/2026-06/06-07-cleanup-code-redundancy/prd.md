# brainstorm: 清理代码冗余

## Goal

检查当前项目中的代码冗余和近似重复代码，形成可执行的清理范围与策略，降低后续维护成本，同时避免为了“去重”引入过度抽象或行为回归。

## What I already know

* 用户希望检查当前项目的代码冗余、代码块冗余情况，并计划做冗余清理。
* 当前仓库是 single-repo 项目，Trellis spec layers 包含 backend、frontend。
* 当前 git 分支是 `master`，创建任务前工作树是干净的。
* 项目是 Node 24 + TypeScript + Vue/Vite；主要质量命令是 `npm run lint`、`npm run type-check`、`npm run test:contracts`、`npm run build:docker`。
* 维护主体是 Docker runtime 和 Docker WebUI：`src/core/`、`src/docker/`、`src/docker/webui/`。
* `jscpd` 检测到整体重复率较低：总重复 1.35%，TypeScript 源码重复 0.47%，测试 JavaScript 重复 5.10%，CSS 未发现重复块。
* 默认 `knip` 输出不可信，因为它没有识别本项目 Docker/WebUI 入口，几乎把所有源码和依赖都误报为 unused。
* `ts-prune` 可作为导出面收窄的辅助信号，但不能直接作为删除代码依据。

## Assumptions (temporary)

* 本任务先做冗余审计与清理规划；是否立即实施清理由用户确认。
* “冗余”包括完全重复代码、近似重复代码、重复配置/脚本、重复样式/组件模式，以及可能已经失去引用的死代码。
* 清理优先级应以低风险、可验证、收益明确为准。

## Open Questions

* 无。

## Requirements (evolving)

* 识别项目主要技术栈、目录结构、构建与测试命令。
* 扫描完全重复与近似重复代码热点。
* 区分可立即清理、需要设计抽象、暂不建议动的冗余。
* 产出带文件路径和建议动作的清理清单。
* 如果进入实施阶段，优先处理低风险、可独立验证的清理项。
* 不基于不可靠的 unused-code 工具输出删除文件或依赖。
* 实施 Approach C 的清理范围，但遇到抽象后可读性明显变差的点应停止并保留局部重复。

## Acceptance Criteria (evolving)

* [x] PRD 记录项目结构、扫描方法和约束。
* [x] 用户确认本轮清理范围。
* [x] 形成按风险/收益排序的冗余清理候选列表。
* [x] 每个候选项包含位置、重复形态、建议处理方式和验证方式。
* [x] 如进入实施阶段，清理后 lint/typecheck/tests 或等价质量检查通过。
* [x] Contract tests 使用共享 source-inspection helper，重复测试工具代码减少。
* [x] Yuba 签到结果判断被集中到一个局部 helper，两个调用路径行为保持兼容。
* [x] WebUI resource request 重复样板减少，pending/stale/unauthorized/error/toast 语义保持兼容。
* [x] 已验证的多余 internal re-export 被收窄，未删除公共行为。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 未经确认不做大规模架构重写。
* 未经确认不删除难以证明无引用的代码。
* 未经确认不引入新的大型依赖或工具链。
* 未经确认不重构所有重复一两行的小工具函数。
* 未经确认不把 WebUI resource 层改造成宽泛框架。

## Technical Notes

* Task directory: `.trellis/tasks/06-07-cleanup-code-redundancy`
* Trellis workflow: task started and implemented.
* Specs inspected: `.trellis/spec/guides/index.md`, `.trellis/spec/guides/code-reuse-thinking-guide.md`, `.trellis/spec/backend/index.md`, `.trellis/spec/frontend/index.md`
* Largest source files include `src/core/douyu-passport.ts`, `src/core/medal-sync.ts`, `src/docker/runtime-cookie-recovery.ts`, `src/docker/webui/resource-fans.ts`.
* Largest tests include `test/douyu-passport-contract.test.js` and `test/project-maintenance-contract.test.js`.
* Final `jscpd` result: total duplicated lines 0.8% (down from 1.35%), TypeScript 0.3% (down from 0.47%), JavaScript tests 2.89% (down from 5.10%), CSS 0%.

## Implementation Summary

* Added `test/helpers/source-inspection.js` and updated source-reading contract tests to use it.
* Narrowed `src/core/job.ts` and `src/core/yuba.ts` internal barrel exports to actual consumers.
* Extracted `resolveYubaSignResult` inside `src/core/yuba-check-in.ts` and added `test/yuba-check-in-contract.test.js`.
* Added `runTrackedResourceRequest` in `src/docker/webui/resource-request.ts` and updated fans/Yuba resource loaders to use it while keeping resource-specific state local.
* Updated request-smoothing contract tests to guard the new shared request-tracking boundary.
* Updated backend testing and frontend state-management specs with the reusable helper conventions introduced by this task.

## Verification

* `npm run lint`
* `npm run type-check`
* `npm run test:contracts`
* `npm run build:docker`

## Technical Approach

Implement in small, reversible slices:

1. Extract test helper duplication first, because it is low risk and simplifies later test updates.
2. Verify and narrow internal barrel exports only where `rg` proves no consumer needs them.
3. Refactor `src/core/yuba-check-in.ts` locally, keeping endpoint-specific success options explicit.
4. Refactor WebUI tracked request boilerplate narrowly in `src/docker/webui/resource-request.ts`, then update `resource-fans.ts`, `resource-yuba.ts`, and textual contract tests.
5. Run targeted contract tests after relevant slices, then full lint/typecheck/tests as the final gate.

## Implementation Plan (small PRs)

* PR1: Test helper extraction and affected contract-test imports.
* PR2: Verified export-surface cleanup.
* PR3: Yuba sign-result helper extraction with contract coverage check.
* PR4: WebUI resource request helper extraction and contract-test updates.
* PR5: Final lint/typecheck/contracts/build verification and PRD checklist update.

## Research References

* [`research/redundancy-scan.md`](research/redundancy-scan.md) — Local redundancy scan with tool outputs, confidence notes, and ordered cleanup candidates.

## Redundancy Candidates

### Recommended Low-Risk First

* Extract repeated contract-test source-inspection helpers into `test/helpers/source-inspection.js`.
* Consider narrowing verified unused re-exports in `src/core/job.ts` / `src/core/yuba.ts`, only after `rg` confirmation and tests.

### Medium-Risk / Higher Payoff

* Extract local Yuba sign-result interpretation inside `src/core/yuba-check-in.ts`.
* Extend `src/docker/webui/resource-request.ts` only narrowly if it can remove repeated resource request boilerplate while preserving stale-response semantics.

### Defer Unless Already Touching Nearby Code

* Shared response parsing helpers across `src/core/api.ts` and `src/core/douyu-passport.ts`.
* Large file-set lists in `test/project-maintenance-contract.test.js`.

## Feasible Approaches

### Approach A: Audit only

* Deliver the scan notes and leave implementation for later.
* Lowest risk, but does not reduce current redundancy.

### Approach B: Low-risk cleanup batch (Recommended)

* Implement test helper extraction and verified export-surface cleanup.
* Run contract tests and type checks.
* Keeps behavior risk low while making immediate progress.

### Approach C: Broader cleanup batch

* Include Approach B plus Yuba sign helper and/or WebUI resource request abstraction.
* Better maintenance payoff, but higher regression risk and likely needs targeted test updates.

Selected by user.

## Decision (ADR-lite)

**Context**: The redundancy scan found low overall duplication, but several repeated patterns are real maintenance risks: duplicated source-inspection helpers in contract tests, duplicated tracked resource request boilerplate in WebUI resources, repeated Yuba sign result interpretation, and possible overly broad internal barrel exports.

**Decision**: Use Approach C. Implement a broader cleanup batch that includes low-risk cleanup plus selected medium-risk abstractions.

**Consequences**: This should reduce meaningful repetition beyond cosmetic clone count. It requires careful preservation of textual contract-test intent, WebUI stale-response semantics, and Yuba endpoint-specific response behavior.

## MVP Scope

* Extract shared source-inspection helpers for contract tests under `test/helpers/`.
* Narrow verified unused internal barrel re-exports where search confirms no runtime/test consumer depends on them.
* Extract Yuba sign result interpretation inside `src/core/yuba-check-in.ts` while preserving legacy and dy-token success differences.
* Introduce a narrow WebUI resource request helper only if it keeps `resource-fans.ts` / `resource-yuba.ts` readable and preserves pending reuse, request sequence tracking, stale response guards, unauthorized handling, and existing toast/error behavior.
* Update affected contract tests so they keep guarding behavior without requiring obsolete implementation text.

## Expansion Sweep

### Future evolution

* The project may continue adding Docker WebUI task pages and resource loaders; resource request patterns should stay easy to reuse without creating a generic framework too early.
* Contract tests are text-heavy architectural guardrails; helper extraction should improve maintainability without hiding the intent of those guardrails.

### Related scenarios

* Backend and frontend specs both emphasize Docker-first behavior and existing local patterns.
* Cleanup must preserve contract-test coverage because many tests inspect source text intentionally.

### Failure / edge cases

* Duplicate detectors can produce false positives for tests, barrel exports, and framework entry points.
* Refactoring external API response interpretation can accidentally change behavior for malformed, empty, or partially successful Douyu/Yuba responses.
