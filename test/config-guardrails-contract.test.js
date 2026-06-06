const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const {
  createDefaultDoubleCardConfig,
  createDefaultExpiringGiftConfig,
  createDefaultKeepaliveConfig,
  normalizeDockerConfig,
  reconcileDockerConfig,
} = loadTypeScriptModule('src/core/medal-sync.ts')
const {
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_GIFT_ID,
  DEFAULT_KEEPALIVE_CRON,
} = loadTypeScriptModule('src/core/task-defaults.ts')

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

test('Fan-backed task defaults create send maps with task-specific defaults', () => {
  // Behavior: keepalive, double-card, and expiring-gift share fan-backed send
  // normalization but keep distinct default activation, models, and weights.
  const fans = [
    createFan(100, 'first-room'),
    createFan(200, 'second-room'),
  ]

  const keepalive = createDefaultKeepaliveConfig(fans)
  const doubleCard = createDefaultDoubleCardConfig(fans)
  const expiringGift = createDefaultExpiringGiftConfig(fans)

  assert.deepEqual(Object.keys(keepalive.send).sort(), ['100', '200'])
  assert.equal(keepalive.active, true)
  assert.equal(keepalive.cron, DEFAULT_KEEPALIVE_CRON)
  assert.equal(keepalive.send['100'].number, 1)
  assert.equal(keepalive.send['100'].weight, 0)
  assert.equal(keepalive.send['200'].number, 1)
  assert.equal(keepalive.send['200'].weight, 0)

  assert.deepEqual(Object.keys(doubleCard.send).sort(), ['100', '200'])
  assert.equal(doubleCard.active, false)
  assert.equal(doubleCard.cron, DEFAULT_DOUBLE_CARD_CRON)
  assert.equal(doubleCard.giftScope, DEFAULT_DOUBLE_CARD_GIFT_SCOPE)
  assert.deepEqual(JSON.parse(JSON.stringify(doubleCard.enabled)), {
    100: false,
    200: false,
  })
  assert.equal(doubleCard.send['100'].number, 0)
  assert.equal(doubleCard.send['100'].weight, 1)

  assert.deepEqual(Object.keys(expiringGift.send).sort(), ['100', '200'])
  assert.equal(expiringGift.active, false)
  assert.equal(expiringGift.cron, DEFAULT_EXPIRING_GIFT_CRON)
  assert.equal(expiringGift.thresholdHours, DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS)
  assert.equal(expiringGift.send['100'].number, 0)
  assert.equal(expiringGift.send['100'].weight, 1)
  assert.equal(expiringGift.send['200'].number, 0)
  assert.equal(expiringGift.send['200'].weight, 0)
})

test('Docker config normalization fills task defaults and migrates legacy send fields', () => {
  // Behavior: persisted task config may be sparse or legacy-shaped; normalize it
  // without changing task-specific send semantics.
  const normalized = normalizeDockerConfig({
    cookie: ' legacy-main ',
    manualCookies: {
      main: ' main-redacted ',
      yuba: ' yuba-redacted ',
    },
    keepalive: {
      cron: '',
      model: 99,
      send: {
        101: {
          roomId: 999,
          giftId: '',
          number: Number.NaN,
          percentage: 7,
          count: Number.NaN,
        },
      },
    },
    doubleCard: {
      cron: '',
      model: 2,
      giftScope: 'invalid',
      send: {
        102: {
          roomId: 102,
          giftId: '',
          number: 2,
          percentage: 5,
          weight: 8,
          count: 3,
        },
      },
    },
    expiringGift: {
      cron: '',
      thresholdHours: 0,
      model: 1,
      send: {
        103: {
          roomId: 103,
          giftId: '',
          number: Number.NaN,
          percentage: 4,
        },
      },
    },
  })

  assert.equal(normalized.cookie, 'main-redacted')
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.manualCookies)), {
    main: 'main-redacted',
    yuba: 'yuba-redacted',
  })
  assert.equal(normalized.keepalive.active, true)
  assert.equal(normalized.keepalive.cron, DEFAULT_KEEPALIVE_CRON)
  assert.equal(normalized.keepalive.model, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.keepalive.send['101'])), {
    roomId: 101,
    giftId: DEFAULT_GIFT_ID,
    number: 0,
    weight: 7,
    count: 0,
  })
  assert.equal(normalized.doubleCard.active, true)
  assert.equal(normalized.doubleCard.cron, DEFAULT_DOUBLE_CARD_CRON)
  assert.equal(normalized.doubleCard.giftScope, DEFAULT_DOUBLE_CARD_GIFT_SCOPE)
  assert.equal(normalized.doubleCard.send['102'].number, 2)
  assert.equal(normalized.doubleCard.send['102'].weight, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.doubleCard.enabled)), { 102: true })
  assert.equal(normalized.expiringGift.cron, DEFAULT_EXPIRING_GIFT_CRON)
  assert.equal(normalized.expiringGift.thresholdHours, DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS)
  assert.equal(normalized.expiringGift.send['103'].weight, 4)
})

test('Docker config reconciliation follows fans and preserves migration behavior', () => {
  // Behavior: fan reconciliation owns the send-room set while preserving
  // task-specific migration rules and room defaults.
  const fans = [
    createFan(100, 'first-room'),
    createFan(200, 'second-room'),
  ]
  const reconciled = reconcileDockerConfig({
    cookie: '',
    keepalive: {
      active: false,
      cron: '',
      model: 1,
      send: {
        100: {
          roomId: 100,
          giftId: 'custom-gift',
          number: 2,
          weight: 3,
          count: 4,
        },
        999: {
          roomId: 999,
          giftId: 'stale-room',
          number: 1,
          weight: 1,
          count: 1,
        },
      },
    },
    doubleCard: {
      active: false,
      cron: '',
      model: 1,
      giftScope: 'limitedTime',
      send: {
        100: {
          roomId: 100,
          giftId: 'double-gift',
          number: 0,
          weight: 6,
          count: 0,
        },
      },
    },
    expiringGift: {
      active: false,
      cron: '',
      thresholdHours: 12,
      model: 1,
      send: {},
    },
  }, fans)

  assert.deepEqual(Object.keys(reconciled.keepalive.send).sort(), ['100', '200'])
  assert.equal(reconciled.keepalive.active, false)
  assert.equal(reconciled.keepalive.cron, DEFAULT_KEEPALIVE_CRON)
  assert.equal(reconciled.keepalive.send['100'].giftId, 'custom-gift')
  assert.equal(reconciled.keepalive.send['100'].weight, 3)
  assert.equal(reconciled.keepalive.send['200'].giftId, DEFAULT_GIFT_ID)
  assert.equal(reconciled.keepalive.send['200'].weight, 1)

  assert.deepEqual(Object.keys(reconciled.doubleCard.send).sort(), ['100', '200'])
  assert.equal(reconciled.doubleCard.giftScope, 'limitedTime')
  assert.deepEqual(JSON.parse(JSON.stringify(reconciled.doubleCard.enabled)), {
    100: true,
    200: false,
  })

  assert.deepEqual(Object.keys(reconciled.expiringGift.send).sort(), ['100', '200'])
  assert.equal(reconciled.expiringGift.thresholdHours, 12)
  assert.equal(reconciled.expiringGift.send['100'].weight, 1)
  assert.equal(reconciled.expiringGift.send['200'].weight, 0)
})
