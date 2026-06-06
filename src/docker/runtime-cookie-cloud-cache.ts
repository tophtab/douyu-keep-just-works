import { fetchCookieCloudSnapshot, isCookieCloudReady } from '../core/cookie-cloud'
import type { CookieCloudConfig, DockerConfig } from '../core/types'

const COOKIE_CLOUD_CACHE_TTL_MS = 60 * 1000

export type CookieCloudSnapshot = Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>

interface CookieCloudCacheEntry {
  key: string
  fetchedAt: number
  snapshot: CookieCloudSnapshot
}

export class DockerCookieCloudCache {
  private entry: CookieCloudCacheEntry | null = null

  constructor(private readonly getConfig: () => DockerConfig | null) {}

  clear(): void {
    this.entry = null
  }

  async load(forceRefresh = false): Promise<CookieCloudSnapshot> {
    const config = this.getConfig()?.cookieCloud
    if (!config || !isCookieCloudReady(config)) {
      throw new Error('CookieCloud 配置不完整')
    }

    const cacheKey = this.getCacheKey(config)
    if (
      !forceRefresh
      && this.entry
      && this.entry.key === cacheKey
      && (Date.now() - this.entry.fetchedAt) < COOKIE_CLOUD_CACHE_TTL_MS
    ) {
      return this.entry.snapshot
    }

    const snapshot = await fetchCookieCloudSnapshot(config)
    this.entry = {
      key: cacheKey,
      fetchedAt: Date.now(),
      snapshot,
    }
    return snapshot
  }

  private getCacheKey(config: CookieCloudConfig): string {
    return [config.endpoint, config.uuid, config.password, config.cryptoType || 'legacy'].join('|')
  }
}
