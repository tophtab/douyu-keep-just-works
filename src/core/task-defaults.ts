import type { AllocationMode, DockerConfig, DoubleCardGiftScope, ThemeMode, YubaCheckInMode } from './types'

export const DEFAULT_COLLECT_GIFT_CRON = '0 10 3,5 * * *'
export const LEGACY_DEFAULT_KEEPALIVE_CRON = '0 0 8 */7 * *'
export const DEFAULT_KEEPALIVE_CRON = '0 0 8 * * 3'
export const DEFAULT_DOUBLE_CARD_CRON = '0 20 17,20,22,23 * * *'
export const DEFAULT_EXPIRING_GIFT_CRON = '0 45 23 * * *'
export const DEFAULT_YUBA_CHECK_IN_CRON = '0 23 0 * * *'
export const DEFAULT_COOKIE_CLOUD_SYNC_CRON = '0 5 0 * * *'

export const DEFAULT_KEEPALIVE_ALLOCATION_MODE: AllocationMode = 'fixed'
export const DEFAULT_DOUBLE_CARD_ALLOCATION_MODE: AllocationMode = 'weighted'
export const DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE: AllocationMode = 'weighted'
export const DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS = 24

export const DEFAULT_THEME_MODE: ThemeMode = 'system'
export const DEFAULT_GIFT_ID = 268
export const DEFAULT_DOUBLE_CARD_GIFT_SCOPE: DoubleCardGiftScope = 'glowStick'
export const DEFAULT_YUBA_CHECK_IN_MODE: YubaCheckInMode = 'followed'

export function createDefaultRawDockerConfig(): DockerConfig {
  return {
    loginCookies: {
      passport: '',
      main: '',
      yuba: '',
    },
    cookieCloud: {
      enabled: false,
      endpoint: '',
      uuid: '',
      password: '',
      cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
      cryptoType: 'legacy',
    },
    ui: { themeMode: DEFAULT_THEME_MODE },
    collectGift: { enabled: true, cron: DEFAULT_COLLECT_GIFT_CRON },
    keepalive: {
      enabled: true,
      cron: DEFAULT_KEEPALIVE_CRON,
      allocationMode: DEFAULT_KEEPALIVE_ALLOCATION_MODE,
      roomAllocations: {},
    },
    doubleCard: {
      enabled: false,
      cron: DEFAULT_DOUBLE_CARD_CRON,
      giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
      participatingRoomIds: [],
      allocationMode: DEFAULT_DOUBLE_CARD_ALLOCATION_MODE,
      roomAllocations: {},
    },
    expiringGift: {
      enabled: false,
      cron: DEFAULT_EXPIRING_GIFT_CRON,
      thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
      allocationMode: DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE,
      roomAllocations: {},
    },
    yubaCheckIn: {
      enabled: false,
      cron: DEFAULT_YUBA_CHECK_IN_CRON,
      mode: DEFAULT_YUBA_CHECK_IN_MODE,
    },
  }
}
