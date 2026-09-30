const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
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
} = loadTypeScriptModule('src/core/task-defaults.ts')
const {
  validateCookieCloudConfig,
  validateCronConfig,
  validateDoubleCardConfig,
  validateJobConfig,
} = loadTypeScriptModule('src/docker/config-validation.ts')
const {
  buildConfigWithPartialUpdate,
  loadConfigFromDisk,
  saveConfigToDisk,
} = loadTypeScriptModule('src/docker/config-store.ts')

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

test('Docker config normalization keeps current fields and order while ignoring old aliases', () => {
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
    yuba: '',
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
    enabled: false,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    participatingRoomIds: [],
    allocationMode: 'weighted',
    roomAllocations: {},
  })
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.expiringGift)), {
    enabled: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    allocationMode: 'weighted',
    roomAllocations: {},
  })
  assert.equal(JSON.stringify(normalized).includes('manualCookies'), false)
  assert.equal(JSON.stringify(normalized).includes('manualPassport'), false)
  assert.equal(JSON.stringify(normalized).includes('"model"'), false)
  assert.equal(JSON.stringify(normalized).includes('"send"'), false)
  assert.equal(JSON.stringify(normalized).includes('giftId'), false)
  assert.equal(JSON.stringify(normalized).includes('roomId'), false)
})

test('Old config aliases do not supply missing current settings', () => {
  const normalized = normalizeDockerConfig({
    cookie: 'old-main-redacted',
    manualCookies: { main: 'old-manual-main-redacted', yuba: 'old-yuba-redacted' },
    manualPassport: { cookie: 'old-passport-redacted' },
    cookieCloud: { active: true },
    collectGift: { active: false },
    keepalive: { active: false, model: 1, send: { 100: { weight: 9 } } },
    doubleCard: { active: true, model: 2, enabled: { 100: true }, send: { 100: { number: -1 } } },
    expiringGift: { active: true, model: 2, send: { 100: { number: -1 } } },
    yubaCheckIn: { active: true },
  })
  assert.deepEqual(normalized, normalizeDockerConfig({}))

  const fixed = normalizeDockerConfig({
    keepalive: {
      allocationMode: 'fixed',
      roomAllocations: { 100: { number: -1 }, 200: { count: 3, number: 9 } },
    },
  })
  assert.deepEqual(fixed.keepalive.roomAllocations, { 100: { count: 1 }, 200: { count: 3 } })
})

test('Keepalive cron preserves saved expressions and fills only missing or blank values', () => {
  assert.equal(DEFAULT_KEEPALIVE_CRON, '0 0 8 * * 3')
  assert.equal(normalizeDockerConfig({
    keepalive: { cron: ' 0 0 8 */7 * * ' },
  }).keepalive.cron, '0 0 8 */7 * *')
  assert.equal(normalizeDockerConfig({
    keepalive: { cron: ' 0 30 9 * * 5 ' },
  }).keepalive.cron, '0 30 9 * * 5')
  for (const cron of [undefined, '', '   ']) {
    assert.equal(normalizeDockerConfig({ keepalive: { cron } }).keepalive.cron, DEFAULT_KEEPALIVE_CRON)
  }
})

test('Allocation validation requires current fields and rejects old double-card maps', () => {
  assert.match(validateDoubleCardConfig({
    active: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    model: 1,
    enabled: { 100: true },
    send: { 100: { weight: 1 } },
  }), /启用状态无效/)

  const fixed = {
    enabled: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    allocationMode: 'fixed',
    roomAllocations: { 100: { count: -1 }, 200: { count: 3 } },
  }
  assert.equal(validateJobConfig('keepalive', fixed), null)
  assert.match(validateJobConfig('keepalive', { ...fixed, allocationMode: undefined, model: 2 }), /分配模式无效/)
  assert.match(validateJobConfig('keepalive', { ...fixed, roomAllocations: undefined, send: { 100: { number: -1 } } }), /房间配置无效/)
  assert.match(validateJobConfig('keepalive', { ...fixed, roomAllocations: { 100: { number: -1 } } }), /数量无效/)
  assert.match(validateDoubleCardConfig({ ...fixed, enabled: { 100: true } }), /启用状态无效/)

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

  assert.match(validateJobConfig('keepalive', {
    ...fixed,
    roomAllocations: { 100: { count: 1, weight: 1 } },
  }), /权重字段不适用/)

  for (const count of [-2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.match(validateJobConfig('keepalive', { ...fixed, roomAllocations: { 100: { count } } }), /数量无效/)
  }
  for (const weight of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.match(validateJobConfig('keepalive', {
      ...fixed,
      allocationMode: 'weighted',
      roomAllocations: { 100: { weight } },
    }), /权重值无效/)
  }

  const weighted = { ...fixed, allocationMode: 'weighted', roomAllocations: { 100: { weight: 1 } }, participatingRoomIds: [100] }
  assert.equal(validateDoubleCardConfig(weighted), null)
  assert.match(validateDoubleCardConfig({ ...weighted, roomAllocations: { 100: { weight: 0 } } }), /大于 0 的权重值/)
})

test('Current switches and cron are validated without interpreting active aliases', () => {
  assert.match(validateCronConfig('keepalive', { enabled: 'yes', cron: DEFAULT_KEEPALIVE_CRON }), /启用状态无效/)
  assert.match(validateCronConfig('keepalive', { enabled: false, cron: 'invalid' }), /cron/i)
  assert.equal(validateCronConfig('keepalive', { active: 'ignored', cron: '0 0 8 */7 * *' }), null)
  assert.equal(validateCookieCloudConfig({ active: true }), null)
  assert.match(validateCookieCloudConfig({ enabled: 'yes' }), /启用状态无效/)
  assert.match(validateCookieCloudConfig({ enabled: true }), /服务器地址不能为空/)
  assert.match(validateCookieCloudConfig({ enabled: false, cron: 'invalid' }), /cron/i)
  assert.equal(validateCookieCloudConfig({ enabled: false, cryptoType: 'legacy' }), null)
})

test('Partial updates ignore old aliases and preserve unspecified current settings', () => {
  const current = normalizeDockerConfig({
    loginCookies: { passport: 'passport-redacted', main: 'main-redacted', yuba: 'yuba-redacted' },
    keepalive: { enabled: false, cron: '0 0 8 */7 * *', allocationMode: 'weighted', roomAllocations: { 100: { weight: 3 } } },
    doubleCard: { enabled: true, participatingRoomIds: [100], allocationMode: 'fixed', roomAllocations: { 100: { count: -1 } } },
    expiringGift: { enabled: true, allocationMode: 'fixed', roomAllocations: { 100: { count: 2 } } },
  })
  const before = JSON.stringify(current)
  const unchanged = buildConfigWithPartialUpdate(current, {
    cookie: 'old-main-redacted',
    manualCookies: { main: 'old-main-redacted', yuba: 'old-yuba-redacted' },
    manualPassport: { cookie: 'old-passport-redacted' },
    cookieCloud: { active: true },
    collectGift: { active: false },
    keepalive: { active: true, model: 2, send: { 999: { number: -1 } } },
    doubleCard: { active: false, model: 1, send: { 999: { weight: 9 } } },
    expiringGift: { active: false, model: 1, send: { 999: { weight: 9 } } },
    yubaCheckIn: { active: true },
  })
  assert.deepEqual(unchanged, current)

  const patched = buildConfigWithPartialUpdate(current, {
    loginCookies: { main: ' next-main-redacted ' },
    cookieCloud: { uuid: ' next-uuid ' },
    keepalive: { enabled: true },
    doubleCard: { participatingRoomIds: [] },
    ui: { themeMode: 'dark' },
  })
  assert.deepEqual(patched.loginCookies, { ...current.loginCookies, main: 'next-main-redacted' })
  assert.deepEqual(patched.cookieCloud, { ...current.cookieCloud, uuid: 'next-uuid' })
  assert.deepEqual(patched.keepalive, { ...current.keepalive, enabled: true })
  assert.deepEqual(patched.doubleCard, { ...current.doubleCard, participatingRoomIds: [] })
  assert.deepEqual(patched.ui, { themeMode: 'dark' })
  assert.equal(JSON.stringify(current), before)

  for (const field of ['passport', 'main', 'yuba']) {
    const cleared = buildConfigWithPartialUpdate(current, { loginCookies: { [field]: ' ' } })
    assert.deepEqual(cleared.loginCookies, { ...current.loginCookies, [field]: '' })
  }
  assert.deepEqual(buildConfigWithPartialUpdate(null, { loginCookies: { main: ' new-main-redacted ' } }), normalizeDockerConfig({ loginCookies: { main: 'new-main-redacted' } }))
})

test('Disk config round trips preserve current values and ignore obsolete input fields', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyu-config-contract-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const configPath = path.join(dir, 'nested', 'config.json')
  assert.equal(loadConfigFromDisk(configPath), null)

  const current = normalizeDockerConfig({
    loginCookies: { passport: 'passport-redacted', main: 'main-redacted', yuba: 'yuba-redacted' },
    keepalive: { enabled: false, cron: '0 0 8 */7 * *', allocationMode: 'fixed', roomAllocations: { 100: { count: -1 } } },
    doubleCard: { enabled: true, participatingRoomIds: [100], roomAllocations: { 100: { weight: 3 } } },
  })
  saveConfigToDisk(configPath, current)
  assert.deepEqual(loadConfigFromDisk(configPath), current)
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')), current)

  fs.writeFileSync(configPath, JSON.stringify({
    cookie: 'old-main-redacted',
    manualPassport: { cookie: 'old-passport-redacted' },
    manualCookies: { yuba: 'old-yuba-redacted' },
    keepalive: { active: false, model: 1, send: { 100: { weight: 9 } }, cron: ' 0 0 8 */7 * * ' },
    doubleCard: { active: true, enabled: { 100: true } },
  }))
  const loaded = loadConfigFromDisk(configPath)
  const expected = normalizeDockerConfig({ keepalive: { cron: '0 0 8 */7 * *' } })
  assert.deepEqual(loaded, expected)
  saveConfigToDisk(configPath, loaded)
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')), expected)
})

test('Runtime config updates reapply cookie sources only for current credential fields', async () => {
  const { createRuntimeAppContext } = loadTypeScriptModule('src/docker/runtime-app-context.ts')
  let config = normalizeDockerConfig({ loginCookies: { main: 'main-redacted' } })
  const applied = []
  const saved = []
  const context = createRuntimeAppContext({
    getCurrentConfig: () => config,
    getConfigPath: () => 'unused-config-path',
    saveConfig: (_path, next) => saved.push(next),
    setCurrentConfig: (next) => {
      config = next
    },
    applyConfig: (next, reason) => {
      config = next
      applied.push(reason)
    },
    logSystem: () => {},
  })
  const initial = config
  await context.saveTaskConfig({
    cookie: 'old-main-redacted',
    manualCookies: { main: 'old-main-redacted' },
    manualPassport: { cookie: 'old-passport-redacted' },
  })
  assert.deepEqual(config, initial)
  assert.deepEqual(saved, [initial])
  assert.deepEqual(applied, [])

  await context.saveTaskConfig({ loginCookies: { main: 'next-main-redacted' } })
  assert.equal(config.loginCookies.main, 'next-main-redacted')
  await context.saveTaskConfig({ cookieCloud: { enabled: false } })
  assert.deepEqual(applied, ['cookie_saved', 'cookie_saved'])
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
