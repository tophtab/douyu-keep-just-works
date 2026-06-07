import type { DockerConfig } from '../../core/types'
import { ref } from 'vue'
import { createDefaultRawDockerConfig } from '../../core/task-defaults'
import { requestJson } from './request'
import { hasCookieSourceConfigured as hasConfiguredCookieSource } from './task-shared'

interface ConfigResponse {
  exists?: unknown
  data?: unknown
}

export const rawConfig = ref<DockerConfig | null>(null)

export function getRawConfig(): DockerConfig {
  return rawConfig.value || createDefaultRawDockerConfig()
}

export function hasCookieSourceConfigured(config: DockerConfig | null = getRawConfig()): boolean {
  return hasConfiguredCookieSource(config)
}

export function setRawConfig(config: DockerConfig | null): void {
  rawConfig.value = config
}

export async function loadConfig(): Promise<void> {
  const data = await requestJson<ConfigResponse>('/api/config')
  rawConfig.value = data.exists ? data.data as DockerConfig : createDefaultRawDockerConfig()
}
