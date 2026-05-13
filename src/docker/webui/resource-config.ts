import type { DockerConfig } from '../../core/types'
import { ref } from 'vue'
import {
  DEFAULT_COLLECT_GIFT_CRON,
  DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_DOUBLE_CARD_MODEL,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_MODEL,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_KEEPALIVE_CRON,
  DEFAULT_KEEPALIVE_MODEL,
  DEFAULT_THEME_MODE,
  DEFAULT_YUBA_CHECK_IN_CRON,
  DEFAULT_YUBA_CHECK_IN_MODE,
} from '../../core/task-defaults'
import { requestJson } from './request'
import { hasCookieSourceConfigured as hasConfiguredCookieSource } from './task-shared'

interface RawConfigResponse {
  exists?: unknown
  data?: unknown
}

export const DEFAULT_RAW_CONFIG: DockerConfig = {
  cookie: '',
  manualCookies: {
    main: '',
    yuba: '',
  },
  cookieCloud: {
    active: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  },
  ui: { themeMode: DEFAULT_THEME_MODE },
  collectGift: { active: true, cron: DEFAULT_COLLECT_GIFT_CRON },
  yubaCheckIn: { active: false, cron: DEFAULT_YUBA_CHECK_IN_CRON, mode: DEFAULT_YUBA_CHECK_IN_MODE },
  keepalive: { active: true, cron: DEFAULT_KEEPALIVE_CRON, model: DEFAULT_KEEPALIVE_MODEL, send: {} },
  doubleCard: {
    active: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    model: DEFAULT_DOUBLE_CARD_MODEL,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    send: {},
    enabled: {},
  },
  expiringGift: {
    active: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    model: DEFAULT_EXPIRING_GIFT_MODEL,
    send: {},
  },
}

export const rawConfig = ref<DockerConfig | null>(null)

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function getRawConfig(): DockerConfig {
  return rawConfig.value || cloneValue(DEFAULT_RAW_CONFIG)
}

export function hasCookieSourceConfigured(config: DockerConfig | null = getRawConfig()): boolean {
  return hasConfiguredCookieSource(config)
}

export function setRawConfig(config: DockerConfig | null): void {
  rawConfig.value = config
}

export async function loadRawConfig(): Promise<void> {
  const data = await requestJson<RawConfigResponse>('/api/config/raw')
  rawConfig.value = data.exists ? data.data as DockerConfig : cloneValue(DEFAULT_RAW_CONFIG)
}
