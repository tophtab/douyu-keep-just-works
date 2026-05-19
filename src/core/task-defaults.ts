import type { DockerConfig, DoubleCardGiftScope, ThemeMode, YubaCheckInMode } from './types'

export const DEFAULT_COLLECT_GIFT_CRON = '0 10 3,5 * * *'
export const DEFAULT_KEEPALIVE_CRON = '0 0 8 */7 * *'
export const DEFAULT_DOUBLE_CARD_CRON = '0 20 17,20,22,23 * * *'
export const DEFAULT_EXPIRING_GIFT_CRON = '0 45 23 * * *'
export const DEFAULT_YUBA_CHECK_IN_CRON = '0 23 0 * * *'
export const DEFAULT_COOKIE_CLOUD_SYNC_CRON = '0 5 0 * * *'

export const DEFAULT_KEEPALIVE_MODEL: 1 | 2 = 2
export const DEFAULT_DOUBLE_CARD_MODEL: 1 | 2 = 1
export const DEFAULT_EXPIRING_GIFT_MODEL: 1 | 2 = 1
export const DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS = 24

export const DEFAULT_THEME_MODE: ThemeMode = 'system'
export const DEFAULT_GIFT_ID = 268
export const DEFAULT_DOUBLE_CARD_GIFT_SCOPE: DoubleCardGiftScope = 'glowStick'
export const DEFAULT_YUBA_CHECK_IN_MODE: YubaCheckInMode = 'followed'

export function createDefaultRawDockerConfig(): DockerConfig {
  return {
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
      active: false,
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
}
