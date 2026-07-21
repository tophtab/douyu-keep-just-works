import type { DockerConfig, Fans } from '../../core/types'
import { ref } from 'vue'
import { createDefaultRawDockerConfig } from '../../core/task-defaults'
import { requestJson } from './request'
import type { WebUiRequestInit } from './request'

interface ConfigResponse {
  exists?: unknown
  data?: unknown
}

export interface ConfigMutationResult {
  config?: DockerConfig
  fans?: Fans[]
}

export interface CookieSourceConfig {
  loginCookies?: {
    passport?: string
    main?: string
    yuba?: string
  }
  cookieCloud?: {
    enabled?: boolean
    endpoint?: string
    uuid?: string
    password?: string
  }
}

interface ConfigMutationResponse {
  data?: ConfigMutationResult
}

export const rawConfig = ref<DockerConfig | null>(null)

export function getRawConfig(): DockerConfig {
  return rawConfig.value || createDefaultRawDockerConfig()
}

export function hasCookieSourceConfigured(config: CookieSourceConfig | null = getRawConfig()): boolean {
  const cookieCloud = config?.cookieCloud
  const loginCookies = config?.loginCookies
  return Boolean(
    String(loginCookies?.main || '').trim()
    || String(loginCookies?.yuba || '').trim()
    || (cookieCloud?.enabled && String(cookieCloud.endpoint || '').trim() && String(cookieCloud.uuid || '').trim() && String(cookieCloud.password || '').trim()),
  )
}

export function setRawConfig(config: DockerConfig | null): void {
  rawConfig.value = config
}

export async function loadConfig(): Promise<void> {
  const data = await requestJson<ConfigResponse>('/api/config')
  rawConfig.value = data.exists ? data.data as DockerConfig : createDefaultRawDockerConfig()
}

export async function saveConfigPatch(
  payload: unknown,
  options: Pick<WebUiRequestInit, 'errorToast'> = {},
): Promise<ConfigMutationResult | null> {
  const data = await requestJson<ConfigMutationResponse>('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  })
  const result = data.data || null
  if (result?.config) {
    setRawConfig(result.config)
  }
  return result
}
