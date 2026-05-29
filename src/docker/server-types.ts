import type { CollectGiftConfig, CookieDiagnostics, DockerConfig, DoubleCardConfig, EffectiveCookiePreview, ExpiringGiftConfig, Fans, FansStatusResponse, JobConfig, ManualCookieConfig, ManualPassportConfig, YubaCheckInConfig, YubaStatusResponse } from '../core/types'
import type { LogEntry } from './logger'
import type { TaskType } from './task-metadata'

export interface JobStatus {
  running: boolean
  lastRun: string | null
  nextRun: string | null
}

export interface AppContext {
  webPassword: string
  getConfig(): DockerConfig | null
  saveCookie(cookies: ManualCookieConfig): void
  saveTaskConfig(config: {
    manualCookies?: ManualCookieConfig
    manualPassport?: ManualPassportConfig
    cookieCloud?: DockerConfig['cookieCloud']
    collectGift?: CollectGiftConfig | null
    keepalive?: JobConfig | null
    doubleCard?: DoubleCardConfig | null
    expiringGift?: ExpiringGiftConfig | null
    yubaCheckIn?: YubaCheckInConfig | null
    ui?: DockerConfig['ui']
  }): Promise<{ config: DockerConfig; fans: Fans[] }>
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
  triggerTask(type: TaskType): Promise<void>
  fetchFans(): Promise<Fans[]>
  fetchFansStatusBase(): Promise<FansStatusResponse>
  fetchFansStatusDetails(): Promise<FansStatusResponse>
  fetchFansStatus(): Promise<FansStatusResponse>
  fetchYubaStatus(): Promise<YubaStatusResponse>
}
