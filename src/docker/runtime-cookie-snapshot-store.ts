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
    const { effective, passportCookie } = material
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      loginCookies: {
        passport: passportCookie?.trim() || this.deps.getConfig()?.loginCookies.passport || '',
        main: effective.mainCookie.trim(),
        yuba: effective.yubaCookie.trim(),
      },
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
    const currentYubaCookie = this.deps.getConfig()?.loginCookies.yuba.trim() || ''
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      loginCookies: {
        passport: args.passportCookie.trim(),
        main: args.mainCookie.trim(),
        yuba: args.yubaCookie?.trim() || currentYubaCookie,
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

  persistLocalCookieSnapshot(mainCookie: string, yubaCookie: string): DockerConfig {
    const passportCookie = this.deps.getConfig()?.loginCookies.passport || ''
    const nextConfig = buildConfigWithPartialUpdate(this.deps.getConfig(), {
      loginCookies: {
        passport: passportCookie,
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
