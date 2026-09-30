import * as fs from 'node:fs'
import * as path from 'node:path'
import { normalizeDockerConfig } from '../core/config-normalization'
import type { DockerConfig, LoginCookiesConfig } from '../core/types'
import { jsonEquals } from './config-equality'
import { TASK_TYPES } from './task-metadata'

type UnknownRecord = Record<string, unknown>

export type DockerConfigUpdate = Partial<DockerConfig>

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined
}

function hasOwn(record: UnknownRecord | undefined, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key))
}

export function loadConfigFromDisk(configPath: string): DockerConfig | null {
  const resolvedConfigPath = path.resolve(configPath)
  if (!fs.existsSync(resolvedConfigPath)) {
    return null
  }
  const raw = fs.readFileSync(resolvedConfigPath, 'utf-8')
  return normalizeDockerConfig(JSON.parse(raw) as unknown)
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
  return Boolean(a && jsonEquals(a, b))
}

function mergeLoginCookies(current: LoginCookiesConfig, updates: UnknownRecord): LoginCookiesConfig {
  const loginCookies = asRecord(updates.loginCookies)
  return {
    passport: hasOwn(loginCookies, 'passport')
      ? String(loginCookies?.passport ?? '')
      : current.passport,
    main: hasOwn(loginCookies, 'main')
      ? String(loginCookies?.main ?? '')
      : current.main,
    yuba: hasOwn(loginCookies, 'yuba')
      ? String(loginCookies?.yuba ?? '')
      : current.yuba,
  }
}

function mergeConfigSection(current: unknown, update: unknown): unknown {
  if (update === undefined) {
    return current
  }
  const currentRecord = asRecord(current)
  const updateRecord = asRecord(update)
  if (!updateRecord) {
    return update
  }
  return { ...(currentRecord || {}), ...updateRecord }
}

export function buildConfigWithPartialUpdate(current: DockerConfig | null, updates: DockerConfigUpdate): DockerConfig {
  const base = current || normalizeDockerConfig({})
  const updateRecord = updates as UnknownRecord
  const merged: UnknownRecord = {
    loginCookies: mergeLoginCookies(base.loginCookies, updateRecord),
    cookieCloud: mergeConfigSection(base.cookieCloud, updates.cookieCloud),
    ui: mergeConfigSection(base.ui, updates.ui),
  }

  for (const type of TASK_TYPES) {
    merged[type] = mergeConfigSection(base[type], updateRecord[type])
  }
  return normalizeDockerConfig(merged)
}
