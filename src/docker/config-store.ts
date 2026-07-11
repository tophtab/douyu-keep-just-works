import * as fs from 'node:fs'
import * as path from 'node:path'
import { normalizeDockerConfig } from '../core/config-normalization'
import type { CollectGiftConfig, DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, ManualCookieConfig, ManualPassportConfig, YubaCheckInConfig } from '../core/types'
import { jsonEquals } from './config-equality'
import { collectTaskConfigUpdates } from './task-metadata'

export interface DockerConfigUpdate {
  manualCookies?: ManualCookieConfig
  manualPassport?: ManualPassportConfig
  cookieCloud?: DockerConfig['cookieCloud']
  collectGift?: CollectGiftConfig | null
  keepalive?: JobConfig | null
  doubleCard?: DoubleCardConfig | null
  expiringGift?: ExpiringGiftConfig | null
  yubaCheckIn?: YubaCheckInConfig | null
  ui?: DockerConfig['ui']
}

export function loadConfigFromDisk(configPath: string): DockerConfig | null {
  const resolvedConfigPath = path.resolve(configPath)
  if (!fs.existsSync(resolvedConfigPath)) {
    return null
  }
  const raw = fs.readFileSync(resolvedConfigPath, 'utf-8')
  return normalizeDockerConfig(JSON.parse(raw) as DockerConfig, { ensureCollectGift: true })
}

export function saveConfigToDisk(configPath: string, config: DockerConfig): void {
  const resolvedConfigPath = path.resolve(configPath)
  const dir = path.dirname(resolvedConfigPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(resolvedConfigPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function configsEqual(a: DockerConfig | null, b: DockerConfig): boolean {
  if (!a) {
    return false
  }
  return jsonEquals(a, b)
}

export function buildConfigWithPartialUpdate(current: DockerConfig | null, updates: DockerConfigUpdate): DockerConfig {
  const nextConfig: DockerConfig = {
    cookie: current?.cookie || '',
    ...(updates.manualCookies !== undefined
      ? { manualCookies: updates.manualCookies }
      : (current?.manualCookies ? { manualCookies: current.manualCookies } : {})),
    ...(updates.manualPassport !== undefined
      ? { manualPassport: updates.manualPassport }
      : (current?.manualPassport ? { manualPassport: current.manualPassport } : {})),
    ...(updates.cookieCloud !== undefined
      ? (updates.cookieCloud ? { cookieCloud: updates.cookieCloud } : {})
      : (current?.cookieCloud ? { cookieCloud: current.cookieCloud } : {})),
    ui: updates.ui || current?.ui,
    ...collectTaskConfigUpdates(current, updates),
  }
  return normalizeDockerConfig(nextConfig)
}
