const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const {
  createDefaultDoubleCardConfig,
  createDefaultExpiringGiftConfig,
  createDefaultKeepaliveConfig,
  normalizeDockerConfig,
  reconcileDockerConfig,
} = loadTypeScriptModule('src/core/config-normalization.ts')
const {
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_KEEPALIVE_CRON,
  LEGACY_DEFAULT_KEEPALIVE_CRON,
} = loadTypeScriptModule('src/core/task-defaults.ts')
const {
  validateDoubleCardConfig,
  validateJobConfig,
} = loadTypeScriptModule('src/docker/config-validation.ts')

function createFan(roomId, name) {
  return {
    roomId,
    name,
    level: 1,
    rank: 1,
    intimacy: '100',
    today: 0,
  }
}

test('Fan-backed task defaults separate allocation intent from runtime send jobs', () => {
  const fans = [
    createFan(100, 'first-room'),
    createFan(200, 'second-room'),
  ]

  assert.deepEqual(JSON.parse(JSON.stringify(createDefaultKeepaliveConfig(fans))), {
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'fixed',
    roomAllocations: {
      100: { count: 1 },
      200: { count: 1 },
    },
  })

  assert.deepEqual(JSON.parse(JSON.stringify(createDefaultDoubleCardConfig(fans))), {
    enabled: false,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    participatingRoomIds: [],
    allocationMode: 'weighted',
    roomAllocations: {
      100: { weight: 1 },
      200: { weight: 1 },
    },
  })

  assert.deepEqual(JSON.parse(JSON.stringify(createDefaultExpiringGiftConfig(fans))), {
    enabled: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    allocationMode: 'weighted',
    roomAllocations: {
      100: { weight: 1 },
      200: { weight: 0 },
    },
  })
})

test('Example config is canonical and stable after normalization', () => {
  const example = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.example.json'), 'utf8'))
  assert.deepEqual(Object.keys(example), [
    'loginCookies',
    'cookieCloud',
    'ui',
    'collectGift',
    'keepalive',
    'doubleCard',
    'expiringGift',
    'yubaCheckIn',
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeDockerConfig(example))), example)
})

test('Docker config normalization migrates legacy fields with canonical precedence and order', () => {
  const normalized = normalizeDockerConfig({
    cookie: ' legacy-main ',
    loginCookies: {
      passport: ' new-passport ',
      main: '',
    },
    manualCookies: {
      main: ' legacy-manual-main ',
      yuba: ' legacy-yuba ',
    },
    manualPassport: {
      cookie: ' legacy-passport ',
    },
    cookieCloud: {
      enabled: false,
      active: true,
      endpoint: ' https://cookie.example/ ',
      uuid: ' uuid ',
      password: ' password ',
    },
    keepalive: {
      enabled: true,
      active: false,
      cron: '',
      allocationMode: 'weighted',
      model: 2,
      roomAllocations: {
        101: { weight: 3, count: 99, roomId: 999, giftId: 268 },
      },
      send: {
        999: { number: -1 },
      },
    },
    doubleCard: {
      active: true,
      cron: '',
      model: 2,
      giftScope: 'invalid',
      enabled: {
        102: true,
        103: false,
      },
      send: {
        102: { roomId: 102, giftId: 268, number: -1, weight: 8, count: 3 },
      },
    },
    expiringGift: {
      active: false,
      cron: '',
      thresholdHours: 0,
      model: 1,
      send: {
        103: { roomId: 103, giftId: 268, number: 7, weight: 4, count: 9 },
      },
    },
  })

  assert.deepEqual(Object.keys(normalized), [
    'loginCookies',
    'cookieCloud',
    'ui',
    'collectGift',
    'keepalive',
    'doubleCard',
    'expiringGift',
    'yubaCheckIn',
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.loginCookies)), {
    passport: 'new-passport',
    main: '',
    yuba: 'legacy-yuba',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.cookieCloud)), {
    enabled: false,
    endpoint: 'https://cookie.example',
    uuid: 'uuid',
    password: 'password',
    cron: '0 5 0 * * *',
    cryptoType: 'legacy',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.keepalive)), {
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'weighted',
    roomAllocations: {
      101: { weight: 3 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.doubleCard)), {
    enabled: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    participatingRoomIds: [102],
    allocationMode: 'fixed',
    roomAllocations: {
      102: { count: -1 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.expiringGift)), {
    enabled: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    allocationMode: 'weighted',
    roomAllocations: {
      103: { weight: 4 },
    },
  })
  assert.equal(JSON.stringify(normalized).includes('manualCookies'), false)
  assert.equal(JSON.stringify(normalized).includes('manualPassport'), false)
  assert.equal(JSON.stringify(normalized).includes('"model"'), false)
  assert.equal(JSON.stringify(normalized).includes('"send"'), false)
  assert.equal(JSON.stringify(normalized).includes('giftId'), false)
  assert.equal(JSON.stringify(normalized).includes('roomId'), false)
})

test('Keepalive cron migration changes only the exact old default', () => {
  assert.equal(DEFAULT_KEEPALIVE_CRON, '0 0 8 * * 3')
  assert.equal(normalizeDockerConfig({
    keepalive: { cron: LEGACY_DEFAULT_KEEPALIVE_CRON },
  }).keepalive.cron, DEFAULT_KEEPALIVE_CRON)
  assert.equal(normalizeDockerConfig({
    keepalive: { cron: ' 0 30 9 * * 5 ' },
  }).keepalive.cron, '0 30 9 * * 5')
})

test('Allocation validation accepts the legacy boundary shape and rejects mixed canonical entries', () => {
  assert.equal(validateDoubleCardConfig({
    active: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    model: 1,
    enabled: { 100: true },
    send: { 100: { weight: 1 } },
  }), null)

  assert.match(validateJobConfig('keepalive', {
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'weighted',
    roomAllocations: { 100: { weight: 1, count: 1 } },
  }), /固定数量字段不适用/)

  assert.match(validateJobConfig('keepalive', {
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'fixed',
    roomAllocations: { 100: { count: -1 }, 200: { count: -1 } },
  }), /最多只能有一个房间/)
})

test('Docker config reconciliation follows fans and preserves canonical settings', () => {
  const fans = [
    createFan(100, 'first-room'),
    createFan(200, 'second-room'),
  ]
  const reconciled = reconcileDockerConfig(normalizeDockerConfig({
    keepalive: {
      enabled: false,
      cron: '',
      allocationMode: 'weighted',
      roomAllocations: {
        100: { weight: 3 },
        999: { weight: 9 },
      },
    },
    doubleCard: {
      enabled: false,
      cron: '',
      allocationMode: 'weighted',
      giftScope: 'limitedTime',
      participatingRoomIds: [100, 999],
      roomAllocations: {
        100: { weight: 6 },
      },
    },
    expiringGift: {
      enabled: false,
      cron: '',
      thresholdHours: 12,
      allocationMode: 'weighted',
      roomAllocations: {},
    },
  }), fans)

  assert.deepEqual(JSON.parse(JSON.stringify(reconciled.keepalive)), {
    enabled: false,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'weighted',
    roomAllocations: {
      100: { weight: 3 },
      200: { weight: 1 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(reconciled.doubleCard)), {
    enabled: false,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    giftScope: 'limitedTime',
    participatingRoomIds: [100],
    allocationMode: 'weighted',
    roomAllocations: {
      100: { weight: 6 },
      200: { weight: 1 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(reconciled.expiringGift)), {
    enabled: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: 12,
    allocationMode: 'weighted',
    roomAllocations: {
      100: { weight: 1 },
      200: { weight: 0 },
    },
  })
})
