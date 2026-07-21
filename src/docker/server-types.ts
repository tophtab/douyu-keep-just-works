import type { CookieDiagnostics, DockerConfig, EffectiveCookiePreview, Fans, FansStatusResponse, LoginCookiesConfig, PassportQrLoginPublicStatus, YubaStatusResponse } from '../core/types'
import type { DockerConfigUpdate } from './config-store'
import type { LogEntry } from './logger'
import type { TaskType } from './task-metadata'

export interface JobStatus {
  running: boolean
  lastRun: string | null
  nextRun: string | null
}

export interface CacheRefreshOptions {
  forceRefresh?: boolean
}

export interface AppContext {
  webPassword: string
  getConfig(): DockerConfig | null
  saveCookie(cookies: Pick<LoginCookiesConfig, 'main' | 'yuba'>): void
  saveTaskConfig(config: DockerConfigUpdate): Promise<{ config: DockerConfig; fans: Fans[] }>
  syncWithFans(): Promise<{ config: DockerConfig; fans: Fans[] }>
  getStatus(): { collectGift: JobStatus; keepalive: JobStatus; doubleCard: JobStatus; expiringGift: JobStatus; yubaCheckIn: JobStatus }
  getLogs(): LogEntry[]
  clearLogs(): void
  inspectCookieSource(): Promise<CookieDiagnostics>
  getEffectiveCookies(forceRefresh?: boolean): Promise<EffectiveCookiePreview>
  persistEffectiveCookies(forceRefresh?: boolean): Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }>
  startPassportQrLogin(): Promise<PassportQrLoginPublicStatus>
  getPassportQrLoginStatus(): PassportQrLoginPublicStatus | null
  pollPassportQrLogin(): Promise<PassportQrLoginPublicStatus>
  cancelPassportQrLogin(): PassportQrLoginPublicStatus | null
  retryPassportQrLoginYuba(): Promise<PassportQrLoginPublicStatus>
  triggerTask(type: TaskType): Promise<void>
  fetchFans(options?: CacheRefreshOptions): Promise<Fans[]>
  fetchFansStatusBase(options?: CacheRefreshOptions): Promise<FansStatusResponse>
  fetchFansStatusDetails(options?: CacheRefreshOptions): Promise<FansStatusResponse>
  fetchFansStatus(options?: CacheRefreshOptions): Promise<FansStatusResponse>
  fetchYubaStatus(options?: CacheRefreshOptions): Promise<YubaStatusResponse>
}
