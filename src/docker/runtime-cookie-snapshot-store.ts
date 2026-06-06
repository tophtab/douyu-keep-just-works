import type { DockerConfig, EffectiveCookiePreview } from '../core/types'
import { buildConfigWithPartialUpdate, configsEqual, saveConfigToDisk } from './config-store'
import type { EffectiveCookieMaterial } from './runtime-effective-cookies'
import type { StatusCacheScope } from './runtime-cache'

interface CookieSnapshotStoreDeps {
  getConfig: () => DockerConfig | null
  setConfig: (config: DockerConfig) => void
  getConfigPath: () => string
  applyConfig: (config: DockerConfig, reason: 'cookie_saved') => void
  clearFansListCache: () => void
  invalidateStatusCaches: (scope: StatusCacheScope) => void
}

export class DockerCookieSnapshotStore {
  constructor(private readonly deps: CookieSnapshotStoreDeps) {}

  persistEffectiveCookies(material: EffectiveCookieMaterial, options: {
    reloadJobs?: boolean
  } = {}): {
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  } {
    const { effective, manualPassportCookie } = material
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      manualCookies: {
        main: effective.mainCookie.trim(),
        yuba: effective.yubaCookie.trim(),
      },
      ...(manualPassportCookie
        ? { manualPassport: { cookie: manualPassportCookie } }
        : {}),
    })

    if (configsEqual(this.deps.getConfig(), nextConfig)) {
      return {
        config: nextConfig,
        effective,
        updated: false,
      }
    }

    saveConfigToDisk(this.deps.getConfigPath(), nextConfig)
    if (options.reloadJobs) {
      this.deps.applyConfig(nextConfig, 'cookie_saved')
    } else {
      this.replaceRuntimeConfig(nextConfig)
    }

    return {
      config: nextConfig,
      effective,
      updated: true,
    }
  }

  persistPassportQrCookieSnapshot(args: {
    passportCookie: string
    mainCookie: string
    yubaCookie?: string
  }): DockerConfig {
    const currentYubaCookie = this.deps.getConfig()?.manualCookies?.yuba?.trim() || ''
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      manualCookies: {
        main: args.mainCookie.trim(),
        yuba: args.yubaCookie?.trim() || currentYubaCookie,
      },
      manualPassport: {
        cookie: args.passportCookie.trim(),
      },
    })

    if (!configsEqual(this.deps.getConfig(), nextConfig)) {
      saveConfigToDisk(this.deps.getConfigPath(), nextConfig)
      this.deps.applyConfig(nextConfig, 'cookie_saved')
    } else {
      this.replaceRuntimeConfig(nextConfig)
    }
    return nextConfig
  }

  persistManualCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig {
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      manualCookies: {
        main: mainCookie.trim(),
        yuba: yubaCookie.trim(),
      },
    })

    if (!configsEqual(this.deps.getConfig(), nextConfig)) {
      saveConfigToDisk(this.deps.getConfigPath(), nextConfig)
    }
    this.replaceRuntimeConfig(nextConfig)
    return nextConfig
  }

  private replaceRuntimeConfig(config: DockerConfig): void {
    this.deps.setConfig(config)
    this.deps.clearFansListCache()
    this.deps.invalidateStatusCaches('all')
  }
}
