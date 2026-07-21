import {
  DEFAULT_COLLECT_GIFT_CRON,
  DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  DEFAULT_DOUBLE_CARD_ALLOCATION_MODE,
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_KEEPALIVE_ALLOCATION_MODE,
  DEFAULT_KEEPALIVE_CRON,
  DEFAULT_THEME_MODE,
  DEFAULT_YUBA_CHECK_IN_CRON,
  DEFAULT_YUBA_CHECK_IN_MODE,
  LEGACY_DEFAULT_KEEPALIVE_CRON,
  createDefaultRawDockerConfig,
} from './task-defaults'
import type {
  AllocationMode,
  CollectGiftConfig,
  DockerConfig,
  DoubleCardConfig,
  DoubleCardGiftScope,
  ExpiringGiftConfig,
  Fans,
  FixedAllocationConfig,
  GiftAllocationConfig,
  JobConfig,
  LoginCookiesConfig,
  WeightedAllocationConfig,
  YubaCheckInConfig,
} from './types'

type UnknownRecord = Record<string, unknown>

interface FanBackedTaskDefaults {
  enabled: boolean
  cron: string
  allocationMode: AllocationMode
  legacyCron?: string
  resolveMissingWeight?: (index: number) => number
}

const KEEPALIVE_TASK_DEFAULTS: FanBackedTaskDefaults = {
  enabled: true,
  cron: DEFAULT_KEEPALIVE_CRON,
  allocationMode: DEFAULT_KEEPALIVE_ALLOCATION_MODE,
  legacyCron: LEGACY_DEFAULT_KEEPALIVE_CRON,
}

const DOUBLE_CARD_TASK_DEFAULTS: FanBackedTaskDefaults = {
  enabled: false,
  cron: DEFAULT_DOUBLE_CARD_CRON,
  allocationMode: DEFAULT_DOUBLE_CARD_ALLOCATION_MODE,
}

const EXPIRING_GIFT_TASK_DEFAULTS: FanBackedTaskDefaults = {
  enabled: false,
  cron: DEFAULT_EXPIRING_GIFT_CRON,
  allocationMode: DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE,
  resolveMissingWeight: index => (index === 0 ? 1 : 0),
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined
}

function hasOwn(record: UnknownRecord | undefined, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key))
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCron(value: unknown, defaults: Pick<FanBackedTaskDefaults, 'cron' | 'legacyCron'>): string {
  const cron = normalizeString(value)
  if (!cron || cron === defaults.legacyCron) {
    return defaults.cron
  }
  return cron
}

function normalizeEnabled(config: UnknownRecord | undefined, fallback: boolean): boolean {
  if (typeof config?.enabled === 'boolean') {
    return config.enabled
  }
  if (typeof config?.active === 'boolean') {
    return config.active
  }
  return fallback
}

function normalizeAllocationMode(config: UnknownRecord | undefined, fallback: AllocationMode): AllocationMode {
  if (config?.allocationMode === 'weighted' || config?.allocationMode === 'fixed') {
    return config.allocationMode
  }
  if (config?.model === 1) {
    return 'weighted'
  }
  if (config?.model === 2) {
    return 'fixed'
  }
  return fallback
}

function normalizeFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function selectAllocationSource(config: UnknownRecord | undefined): { source: UnknownRecord; legacy: boolean } {
  const roomAllocations = asRecord(config?.roomAllocations)
  if (roomAllocations) {
    return { source: roomAllocations, legacy: false }
  }
  return { source: asRecord(config?.send) || {}, legacy: true }
}

function normalizeWeightedAllocations(source: UnknownRecord, resolveMissingWeight: (index: number) => number): WeightedAllocationConfig {
  const roomAllocations: WeightedAllocationConfig['roomAllocations'] = {}
  Object.entries(source).forEach(([roomId, rawItem], index) => {
    const item = asRecord(rawItem)
    roomAllocations[roomId] = {
      weight: normalizeFiniteNumber(item?.weight) ?? resolveMissingWeight(index),
    }
  })
  return { allocationMode: 'weighted', roomAllocations }
}

function normalizeFixedAllocations(source: UnknownRecord, legacy: boolean): FixedAllocationConfig {
  const roomAllocations: FixedAllocationConfig['roomAllocations'] = {}
  for (const [roomId, rawItem] of Object.entries(source)) {
    const item = asRecord(rawItem)
    roomAllocations[roomId] = {
      count: legacy
        ? normalizeFiniteNumber(item?.number) ?? 1
        : normalizeFiniteNumber(item?.count) ?? 1,
    }
  }
  return { allocationMode: 'fixed', roomAllocations }
}

function normalizeAllocation(config: UnknownRecord | undefined, defaults: FanBackedTaskDefaults): GiftAllocationConfig {
  const allocationMode = normalizeAllocationMode(config, defaults.allocationMode)
  const { source, legacy } = selectAllocationSource(config)
  return allocationMode === 'fixed'
    ? normalizeFixedAllocations(source, legacy)
    : normalizeWeightedAllocations(source, defaults.resolveMissingWeight || (() => 1))
}

function createAllocationForFans(config: JobConfig | undefined, fans: Fans[], defaults: FanBackedTaskDefaults): GiftAllocationConfig {
  const allocationMode = config?.allocationMode || defaults.allocationMode
  if (allocationMode === 'fixed') {
    const roomAllocations: FixedAllocationConfig['roomAllocations'] = {}
    for (const fan of fans) {
      roomAllocations[String(fan.roomId)] = {
        count: config?.allocationMode === 'fixed'
          ? config.roomAllocations[String(fan.roomId)]?.count ?? 1
          : 1,
      }
    }
    return { allocationMode, roomAllocations }
  }

  const roomAllocations: WeightedAllocationConfig['roomAllocations'] = {}
  fans.forEach((fan, index) => {
    roomAllocations[String(fan.roomId)] = {
      weight: config?.allocationMode === 'weighted'
        ? config.roomAllocations[String(fan.roomId)]?.weight ?? (defaults.resolveMissingWeight?.(index) ?? 1)
        : (defaults.resolveMissingWeight?.(index) ?? 1),
    }
  })
  return { allocationMode, roomAllocations }
}

function normalizeFanBackedTaskConfig(rawConfig: unknown, defaults: FanBackedTaskDefaults): JobConfig {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, defaults.enabled),
    cron: normalizeCron(config?.cron, defaults),
    ...normalizeAllocation(config, defaults),
  }
}

function reconcileFanBackedTaskConfig(config: JobConfig, fans: Fans[], defaults: FanBackedTaskDefaults): JobConfig {
  return {
    enabled: config.enabled,
    cron: config.cron || defaults.cron,
    ...createAllocationForFans(config, fans, defaults),
  }
}

function normalizeLoginCookies(config: UnknownRecord): LoginCookiesConfig {
  const loginCookies = asRecord(config.loginCookies)
  const manualCookies = asRecord(config.manualCookies)
  const manualPassport = asRecord(config.manualPassport)

  return {
    passport: hasOwn(loginCookies, 'passport')
      ? normalizeString(loginCookies?.passport)
      : normalizeString(manualPassport?.cookie),
    main: hasOwn(loginCookies, 'main')
      ? normalizeString(loginCookies?.main)
      : (hasOwn(manualCookies, 'main')
          ? normalizeString(manualCookies?.main)
          : normalizeString(config.cookie)),
    yuba: hasOwn(loginCookies, 'yuba')
      ? normalizeString(loginCookies?.yuba)
      : normalizeString(manualCookies?.yuba),
  }
}

function normalizeCookieCloud(rawConfig: unknown): DockerConfig['cookieCloud'] {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, false),
    endpoint: normalizeString(config?.endpoint).replace(/\/+$/, ''),
    uuid: normalizeString(config?.uuid),
    password: normalizeString(config?.password),
    cron: normalizeString(config?.cron) || DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  }
}

export function createDefaultCollectGiftConfig(): CollectGiftConfig {
  return { enabled: true, cron: DEFAULT_COLLECT_GIFT_CRON }
}

function normalizeCollectGiftConfig(rawConfig: unknown): CollectGiftConfig {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, true),
    cron: normalizeString(config?.cron) || DEFAULT_COLLECT_GIFT_CRON,
  }
}

export function createDefaultYubaCheckInConfig(): YubaCheckInConfig {
  return { enabled: false, cron: DEFAULT_YUBA_CHECK_IN_CRON, mode: DEFAULT_YUBA_CHECK_IN_MODE }
}

function normalizeYubaCheckInConfig(rawConfig: unknown): YubaCheckInConfig {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, false),
    cron: normalizeString(config?.cron) || DEFAULT_YUBA_CHECK_IN_CRON,
    mode: config?.mode === 'followed' ? config.mode : DEFAULT_YUBA_CHECK_IN_MODE,
  }
}

function normalizeDoubleCardGiftScope(value: unknown): DoubleCardGiftScope {
  return value === 'limitedTime' ? 'limitedTime' : DEFAULT_DOUBLE_CARD_GIFT_SCOPE
}

function normalizeParticipatingRoomIds(config: UnknownRecord | undefined): number[] {
  if (Array.isArray(config?.participatingRoomIds)) {
    return Array.from(new Set(config.participatingRoomIds
      .map(value => Number(value))
      .filter(value => Number.isFinite(value))))
  }
  const legacyEnabledMap = asRecord(config?.enabled)
  if (!legacyEnabledMap) {
    return []
  }
  return Object.entries(legacyEnabledMap)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([roomId]) => Number(roomId))
    .filter(roomId => Number.isFinite(roomId))
}

function normalizeThresholdHours(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS
}

export function createDefaultKeepaliveConfig(fans: Fans[]): JobConfig {
  return reconcileFanBackedTaskConfig({
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: DEFAULT_KEEPALIVE_ALLOCATION_MODE,
    roomAllocations: {},
  }, fans, KEEPALIVE_TASK_DEFAULTS)
}

export function reconcileKeepaliveConfig(config: JobConfig | undefined, fans: Fans[]): JobConfig | undefined {
  return config ? reconcileFanBackedTaskConfig(config, fans, KEEPALIVE_TASK_DEFAULTS) : undefined
}

export function createDefaultDoubleCardConfig(fans: Fans[]): DoubleCardConfig {
  return {
    enabled: false,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    participatingRoomIds: [],
    ...createAllocationForFans(undefined, fans, DOUBLE_CARD_TASK_DEFAULTS),
  }
}

export function reconcileDoubleCardConfig(config: DoubleCardConfig | undefined, fans: Fans[]): DoubleCardConfig | undefined {
  if (!config) {
    return undefined
  }
  const fanRoomIds = new Set(fans.map(fan => fan.roomId))
  return {
    enabled: config.enabled,
    cron: config.cron || DEFAULT_DOUBLE_CARD_CRON,
    giftScope: config.giftScope,
    participatingRoomIds: config.participatingRoomIds.filter(roomId => fanRoomIds.has(roomId)),
    ...createAllocationForFans(config, fans, DOUBLE_CARD_TASK_DEFAULTS),
  }
}

export function createDefaultExpiringGiftConfig(fans: Fans[]): ExpiringGiftConfig {
  return {
    enabled: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    ...createAllocationForFans(undefined, fans, EXPIRING_GIFT_TASK_DEFAULTS),
  }
}

export function reconcileExpiringGiftConfig(config: ExpiringGiftConfig | undefined, fans: Fans[]): ExpiringGiftConfig | undefined {
  if (!config) {
    return undefined
  }
  return {
    enabled: config.enabled,
    cron: config.cron || DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: normalizeThresholdHours(config.thresholdHours),
    ...createAllocationForFans(config, fans, EXPIRING_GIFT_TASK_DEFAULTS),
  }
}

function normalizeDoubleCardConfig(rawConfig: unknown): DoubleCardConfig {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, false),
    cron: normalizeString(config?.cron) || DEFAULT_DOUBLE_CARD_CRON,
    giftScope: normalizeDoubleCardGiftScope(config?.giftScope),
    participatingRoomIds: normalizeParticipatingRoomIds(config),
    ...normalizeAllocation(config, DOUBLE_CARD_TASK_DEFAULTS),
  }
}

function normalizeExpiringGiftConfig(rawConfig: unknown): ExpiringGiftConfig {
  const config = asRecord(rawConfig)
  return {
    enabled: normalizeEnabled(config, false),
    cron: normalizeString(config?.cron) || DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: normalizeThresholdHours(config?.thresholdHours),
    ...normalizeAllocation(config, EXPIRING_GIFT_TASK_DEFAULTS),
  }
}

export function normalizeDockerConfig(input: unknown, _options: { ensureCollectGift?: boolean } = {}): DockerConfig {
  const config = asRecord(input) || {}
  const themeMode = asRecord(config.ui)?.themeMode
  return {
    loginCookies: normalizeLoginCookies(config),
    cookieCloud: normalizeCookieCloud(config.cookieCloud),
    ui: {
      themeMode: themeMode === 'light' || themeMode === 'dark' ? themeMode : DEFAULT_THEME_MODE,
    },
    collectGift: normalizeCollectGiftConfig(config.collectGift),
    keepalive: normalizeFanBackedTaskConfig(config.keepalive, KEEPALIVE_TASK_DEFAULTS),
    doubleCard: normalizeDoubleCardConfig(config.doubleCard),
    expiringGift: normalizeExpiringGiftConfig(config.expiringGift),
    yubaCheckIn: normalizeYubaCheckInConfig(config.yubaCheckIn),
  }
}

export function reconcileDockerConfig(config: DockerConfig, fans: Fans[]): DockerConfig {
  return {
    loginCookies: { ...config.loginCookies },
    cookieCloud: { ...config.cookieCloud },
    ui: { ...config.ui },
    collectGift: { ...config.collectGift },
    keepalive: reconcileFanBackedTaskConfig(config.keepalive, fans, KEEPALIVE_TASK_DEFAULTS),
    doubleCard: reconcileDoubleCardConfig(config.doubleCard, fans) || createDefaultDoubleCardConfig(fans),
    expiringGift: reconcileExpiringGiftConfig(config.expiringGift, fans) || createDefaultExpiringGiftConfig(fans),
    yubaCheckIn: { ...config.yubaCheckIn },
  }
}

export function createDefaultDockerConfig(): DockerConfig {
  return createDefaultRawDockerConfig()
}
