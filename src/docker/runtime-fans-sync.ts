import { createDefaultDockerConfig, normalizeDockerConfig, reconcileDockerConfig } from '../core/medal-sync'
import type { DockerConfig, Fans } from '../core/types'
import { configsEqual } from './config-store'
import { jsonEquals } from './config-equality'
import { MAIN_DOUYU_URL } from './runtime-constants'
import type { DockerRuntimeConfigApplyReason } from './runtime-config-service'

export type DockerRuntimeFansSyncReason = Extract<DockerRuntimeConfigApplyReason, 'tasks_saved' | 'medal_synced'>

export interface DockerRuntimeFansSyncDeps {
  getCurrentConfig: () => DockerConfig | null
  getConfigPath: () => string
  hasCookieCloudSource: (config: DockerConfig | null | undefined) => boolean
  resolveCookieForUrlFromConfig: (targetUrl: string, config: DockerConfig | null | undefined) => string
  getFansList: (cookie: string) => Promise<Fans[]>
  invalidateStatusCaches: (scope: 'fans') => void
  saveConfig: (configPath: string, config: DockerConfig) => void
  applyConfig: (config: DockerConfig, reason: DockerRuntimeFansSyncReason) => void
  runWithCookieSourceRetry: <T>(context: string, run: () => Promise<T>) => Promise<T>
}

export function cookieSnapshotEqual(a: DockerConfig | null | undefined, b: DockerConfig | null | undefined): boolean {
  return (a?.cookie || '') === (b?.cookie || '')
    && jsonEquals(a?.manualCookies || null, b?.manualCookies || null)
    && jsonEquals(a?.manualPassport || null, b?.manualPassport || null)
}

export class DockerRuntimeFansSyncService {
  constructor(private readonly deps: DockerRuntimeFansSyncDeps) {}

  async syncConfigWithFans(reason: DockerRuntimeFansSyncReason, baseConfig?: DockerConfig): Promise<{ config: DockerConfig; fans: Fans[] }> {
    const shouldMergeLatestCookieSnapshot = Boolean(baseConfig && cookieSnapshotEqual(baseConfig, this.deps.getCurrentConfig()))

    return await this.deps.runWithCookieSourceRetry('同步粉丝牌', async () => {
      const sourceConfig = normalizeDockerConfig(baseConfig || this.deps.getCurrentConfig() || createDefaultDockerConfig())
      const cookieConfig = shouldMergeLatestCookieSnapshot ? this.mergeLatestCookieSnapshot(sourceConfig) : sourceConfig
      const cookie = this.deps.resolveCookieForUrlFromConfig(MAIN_DOUYU_URL, cookieConfig)
      const fans = await this.deps.getFansList(cookie)
      const nextConfig = reconcileDockerConfig(cookieConfig, fans)
      this.deps.invalidateStatusCaches('fans')

      if (!configsEqual(this.deps.getCurrentConfig(), nextConfig)) {
        this.deps.saveConfig(this.deps.getConfigPath(), nextConfig)
        this.deps.applyConfig(nextConfig, reason)
      }

      return {
        config: nextConfig,
        fans,
      }
    })
  }

  private mergeLatestCookieSnapshot(config: DockerConfig): DockerConfig {
    const latestConfig = this.deps.getCurrentConfig()
    if (!latestConfig || !this.deps.hasCookieCloudSource(latestConfig)) {
      return config
    }

    const latestManualCookies = latestConfig.manualCookies
    if (!latestManualCookies?.main?.trim() && !latestManualCookies?.yuba?.trim() && !latestConfig.cookie?.trim()) {
      return config
    }

    return normalizeDockerConfig({
      ...config,
      cookie: latestManualCookies?.main?.trim() || latestConfig.cookie || config.cookie,
      ...(latestManualCookies ? { manualCookies: latestManualCookies } : {}),
    })
  }
}
