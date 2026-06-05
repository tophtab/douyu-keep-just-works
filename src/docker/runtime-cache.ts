import { getFansList, getGiftStatus } from '../core/api'
import { checkDoubleCard } from '../core/double-card'
import type { FanStatus, Fans, FansStatusResponse, GiftStatus, YubaStatusResponse } from '../core/types'
import { isCookieCredentialMessage } from './server-errors'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const FANS_LIST_CACHE_TTL_MS = 60 * 1000
const FANS_STATUS_CACHE_TTL_MS = 5 * 60 * 1000
const YUBA_STATUS_CACHE_TTL_MS = 10 * 60 * 1000
const DOUBLE_CARD_STATUS_CONCURRENCY = 4

export type StatusCacheScope = 'fans' | 'yuba' | 'all'

interface StatusCacheEntry<T> {
  snapshot: T | null
  fetchedAt: number
  pending: Promise<T> | null
  generation: number
}

interface FansListCacheEntry extends StatusCacheEntry<Fans[]> {
  cookie: string
}

function createStatusCache<T>(): StatusCacheEntry<T> {
  return {
    snapshot: null,
    fetchedAt: 0,
    pending: null,
    generation: 0,
  }
}

function createFansListCache(): FansListCacheEntry {
  return {
    ...createStatusCache<Fans[]>(),
    cookie: '',
  }
}

function clearStatusCache<T>(cache: StatusCacheEntry<T>): void {
  cache.snapshot = null
  cache.fetchedAt = 0
  cache.pending = null
  cache.generation += 1
}

async function getCachedStatus<T>(
  cache: StatusCacheEntry<T>,
  ttlMs: number,
  fetchStatus: () => Promise<T>,
  forceRefresh = false,
): Promise<T> {
  if (cache.pending) {
    return await cache.pending
  }

  if (forceRefresh) {
    clearStatusCache(cache)
  }

  const now = Date.now()
  if (cache.snapshot && (now - cache.fetchedAt) < ttlMs) {
    return cache.snapshot
  }

  const generation = cache.generation
  const pending = fetchStatus().then((snapshot) => {
    if (cache.generation === generation) {
      cache.snapshot = snapshot
      cache.fetchedAt = Date.now()
    }
    return snapshot
  }).finally(() => {
    if (cache.pending === pending) {
      cache.pending = null
    }
  })
  cache.pending = pending
  return await pending
}

function getFreshStatusSnapshot<T>(cache: StatusCacheEntry<T>, ttlMs: number): T | null {
  if (!cache.snapshot) {
    return null
  }
  return (Date.now() - cache.fetchedAt) < ttlMs ? cache.snapshot : null
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = Array.from<R>({ length: items.length })
  const size = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0

  await Promise.all(Array.from({ length: size }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }))

  return results
}

function createFansListStatusResponse(fans: Fans[]): FansStatusResponse {
  return {
    fans: fans.map(fan => ({ ...fan })),
    gift: {},
    complete: false,
    statusPhase: 'list',
  }
}

export class DockerRuntimeCache {
  private readonly fansListCache: FansListCacheEntry = createFansListCache()
  private readonly fansStatusCache: StatusCacheEntry<FansStatusResponse> = createStatusCache()
  private readonly yubaStatusCache: StatusCacheEntry<YubaStatusResponse> = createStatusCache()

  clearFansList(): void {
    clearStatusCache(this.fansListCache)
    this.fansListCache.cookie = ''
  }

  invalidateStatus(scope: StatusCacheScope): void {
    if (scope === 'fans' || scope === 'all') {
      clearStatusCache(this.fansStatusCache)
    }
    if (scope === 'yuba' || scope === 'all') {
      clearStatusCache(this.yubaStatusCache)
    }
  }

  async runAndInvalidateStatus(scope: StatusCacheScope, runTask: () => Promise<void>): Promise<void> {
    try {
      await runTask()
    } finally {
      this.invalidateStatus(scope)
    }
  }

  async getFansList(cookie: string, forceRefresh = false): Promise<Fans[]> {
    const sameCookie = this.fansListCache.cookie === cookie
    if (sameCookie && this.fansListCache.pending) {
      return await this.fansListCache.pending
    }

    if (forceRefresh) {
      this.clearFansList()
    }

    const now = Date.now()
    if (!forceRefresh && sameCookie && this.fansListCache.snapshot && (now - this.fansListCache.fetchedAt) < FANS_LIST_CACHE_TTL_MS) {
      return this.fansListCache.snapshot
    }

    const generation = this.fansListCache.generation
    this.fansListCache.cookie = cookie
    const pending = getFansList(cookie).then((fans) => {
      if (this.fansListCache.generation === generation && this.fansListCache.cookie === cookie) {
        this.fansListCache.snapshot = fans
        this.fansListCache.fetchedAt = Date.now()
      }
      return fans
    }).finally(() => {
      if (this.fansListCache.pending === pending) {
        this.fansListCache.pending = null
      }
    })
    this.fansListCache.pending = pending
    return await pending
  }

  async getFansStatusBase(cookie: string, forceRefresh = false): Promise<FansStatusResponse> {
    if (forceRefresh && !this.fansStatusCache.pending) {
      clearStatusCache(this.fansStatusCache)
    }

    const cached = forceRefresh ? null : getFreshStatusSnapshot(this.fansStatusCache, FANS_STATUS_CACHE_TTL_MS)
    if (cached) {
      return cached
    }

    const fans = await this.getFansList(cookie, forceRefresh)
    return createFansListStatusResponse(fans)
  }

  async getFansStatus(cookie: string, logSystem: (message: string) => void, forceRefresh = false): Promise<FansStatusResponse> {
    return await getCachedStatus(this.fansStatusCache, FANS_STATUS_CACHE_TTL_MS, async () => {
      const fans = await this.getFansList(cookie, forceRefresh)
      return await this.buildFansStatusSnapshot(cookie, fans, logSystem)
    }, forceRefresh)
  }

  async getYubaStatus(fetchStatus: () => Promise<YubaStatusResponse>, forceRefresh = false): Promise<YubaStatusResponse> {
    return await getCachedStatus(this.yubaStatusCache, YUBA_STATUS_CACHE_TTL_MS, fetchStatus, forceRefresh)
  }

  private async buildFansStatusSnapshot(cookie: string, fans: Fans[], logSystem: (message: string) => void): Promise<FansStatusResponse> {
    const fanRoomIds = fans.map(fan => fan.roomId)
    const gift = await getGiftStatus(cookie, fanRoomIds).catch((error: unknown): GiftStatus => {
      const message = errorMessage(error)
      logSystem(`加载粉丝牌状态时无法获取背包明细: ${message}`)
      if (isCookieCredentialMessage(message)) {
        throw error
      }
      return {
        error: message,
      }
    })
    const statuses = await mapWithConcurrency(fans, DOUBLE_CARD_STATUS_CONCURRENCY, async (fan): Promise<FanStatus> => {
      try {
        const doubleInfo = await checkDoubleCard(fan.roomId, cookie)
        return {
          ...fan,
          doubleActive: doubleInfo.active,
          doubleExpireTime: doubleInfo.expireTime,
        }
      } catch (error: unknown) {
        logSystem(`加载房间${fan.roomId}双倍状态失败: ${errorMessage(error)}`)
        return {
          ...fan,
          doubleActive: false,
        }
      }
    })
    return {
      fans: statuses,
      gift,
      complete: true,
      statusPhase: 'details',
    }
  }
}
