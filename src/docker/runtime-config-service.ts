import { normalizeDockerConfig } from '../core/medal-sync'
import type { DockerConfig } from '../core/types'
import { assertDockerConfigCrons } from './cron'
import { jsonEquals } from './config-equality'
import type { StatusCacheScope } from './runtime-cache'
import type { TaskReloadSummary } from './runtime-scheduler'
import { getTaskConfig, getTaskConfigChangeScope, hasActiveTaskConfig, TASK_TYPES } from './task-metadata'

export type DockerRuntimeConfigApplyReason = 'startup' | 'cookie_saved' | 'tasks_saved' | 'ui_saved' | 'medal_synced'

export interface DockerRuntimeConfigChange {
  cookieSourceChanged: boolean
  fansTaskConfigChanged: boolean
  yubaTaskConfigChanged: boolean
}

export function analyzeDockerRuntimeConfigChange(
  prevConfig: DockerConfig | null,
  nextConfig: DockerConfig,
): DockerRuntimeConfigChange {
  const changedTaskScopes = TASK_TYPES
    .filter(type => !jsonEquals(getTaskConfig(prevConfig, type) || null, getTaskConfig(nextConfig, type) || null))
    .map(getTaskConfigChangeScope)

  return {
    cookieSourceChanged: prevConfig?.cookie !== nextConfig.cookie
      || !jsonEquals(prevConfig?.manualCookies || null, nextConfig.manualCookies || null)
      || !jsonEquals(prevConfig?.manualPassport || null, nextConfig.manualPassport || null)
      || !jsonEquals(prevConfig?.cookieCloud || null, nextConfig.cookieCloud || null),
    fansTaskConfigChanged: changedTaskScopes.includes('fans'),
    yubaTaskConfigChanged: changedTaskScopes.includes('yuba'),
  }
}

interface DockerRuntimeConfigServiceDeps {
  clearCookieCloudCache: () => void
  clearFansListCache: () => void
  getCurrentConfig: () => DockerConfig | null
  hasConfiguredCookieSource: (config: DockerConfig | null | undefined) => boolean
  invalidateStatusCaches: (scope: StatusCacheScope) => void
  logSystem: (message: string) => void
  logTaskReloadSummary: (reason: DockerRuntimeConfigApplyReason, summary: TaskReloadSummary) => void
  reconcileCookieCloudSync: (prevConfig: DockerConfig | null, nextConfig: DockerConfig) => void
  reconcileTaskJobs: (prevConfig: DockerConfig | null, nextConfig: DockerConfig, hasCookieSource: boolean) => TaskReloadSummary
  setCurrentConfig: (config: DockerConfig) => void
  stopTaskJobs: () => void
}

export class DockerRuntimeConfigService {
  constructor(private readonly deps: DockerRuntimeConfigServiceDeps) {}

  applyConfig(config: DockerConfig, reason: DockerRuntimeConfigApplyReason): void {
    const nextConfig = normalizeDockerConfig(config)
    const prevConfig = this.deps.getCurrentConfig()
    assertDockerConfigCrons(nextConfig)
    this.deps.setCurrentConfig(nextConfig)

    this.applyCacheInvalidation(analyzeDockerRuntimeConfigChange(prevConfig, nextConfig))
    this.deps.reconcileCookieCloudSync(prevConfig, nextConfig)

    const hasCookieSource = this.deps.hasConfiguredCookieSource(nextConfig)
    if (!hasCookieSource) {
      this.handleMissingCookieSource(nextConfig, reason)
      return
    }

    if (!hasActiveTaskConfig(nextConfig)) {
      this.handleMissingActiveTasks(reason)
      return
    }

    const summary = this.deps.reconcileTaskJobs(prevConfig, nextConfig, hasCookieSource)
    this.deps.logTaskReloadSummary(reason, summary)
  }

  private applyCacheInvalidation(change: DockerRuntimeConfigChange): void {
    if (change.cookieSourceChanged) {
      this.deps.clearCookieCloudCache()
      this.deps.clearFansListCache()
      this.deps.invalidateStatusCaches('all')
      return
    }

    if (change.fansTaskConfigChanged) {
      this.deps.invalidateStatusCaches('fans')
    }
    if (change.yubaTaskConfigChanged) {
      this.deps.invalidateStatusCaches('yuba')
    }
  }

  private handleMissingCookieSource(config: DockerConfig, reason: DockerRuntimeConfigApplyReason): void {
    if (reason === 'startup') {
      this.deps.logSystem('配置已加载，但登录凭证为空，请通过 WebUI 填写 Cookie 或启用 CookieCloud')
    } else if (hasActiveTaskConfig(config)) {
      this.deps.stopTaskJobs()
      this.deps.logSystem('任务配置已保存，但登录凭证为空，任务未启动')
    } else if (reason === 'tasks_saved') {
      this.deps.stopTaskJobs()
      this.deps.logSystem('任务配置已保存，可继续保存 Cookie 或启用 CookieCloud')
    } else {
      this.deps.stopTaskJobs()
      this.deps.logSystem('登录凭证为空，请先保存 Cookie 或启用 CookieCloud')
    }
  }

  private handleMissingActiveTasks(reason: DockerRuntimeConfigApplyReason): void {
    this.deps.stopTaskJobs()
    if (reason === 'startup') {
      this.deps.logSystem('配置已加载，但未启用任何任务')
    } else if (reason === 'cookie_saved') {
      this.deps.logSystem('登录凭证已更新，可继续配置任务')
    } else {
      this.deps.logSystem('任务配置已保存，但未启用任何任务')
    }
  }
}
