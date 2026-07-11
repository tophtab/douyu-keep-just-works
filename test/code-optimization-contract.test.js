const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

function createRef(value) {
  return { value }
}

test('gift sends reuse successful room DID lookups across gift groups', async () => {
  const didCalls = []
  const sendCalls = []
  const delays = []
  const api = {
    getBackpackStatus: async () => ({ rows: [], totalRows: 0, glowStickCount: 0 }),
    getDid: async (roomId) => {
      didCalls.push(roomId)
      return `did-${roomId}`
    },
    getGiftNumber: async () => 0,
    parseDyAndSidFromCookie: () => ({ sid: 'sid', dy: 'dy' }),
    sendGift: async (args, job) => {
      sendCalls.push({ did: args.did, giftId: job.giftId, roomId: job.roomId })
    },
    sleep: async delay => delays.push(delay),
  }
  const { createRoomDidResolver, sendGifts } = loadTypeScriptModule('src/core/job-gift-utils.ts', {
    './api': api,
  })
  const resolveDid = createRoomDidResolver('cookie')
  const firstGroup = {
    1001: { roomId: 1001, giftId: 268, count: 1 },
    1002: { roomId: 1002, giftId: 268, count: 1 },
  }
  const secondGroup = {
    1001: { roomId: 1001, giftId: 999, count: 1 },
    1002: { roomId: 1002, giftId: 999, count: 1 },
  }

  await sendGifts(firstGroup, 'cookie', () => {}, '礼物一', '礼物一任务', { resolveDid })
  await sendGifts(secondGroup, 'cookie', () => {}, '礼物二', '礼物二任务', { resolveDid })

  assert.deepEqual(didCalls, ['1001', '1002'])
  assert.deepEqual(sendCalls, [
    { did: 'did-1001', giftId: 268, roomId: 1001 },
    { did: 'did-1002', giftId: 268, roomId: 1002 },
    { did: 'did-1001', giftId: 999, roomId: 1001 },
    { did: 'did-1002', giftId: 999, roomId: 1002 },
  ])
  assert.deepEqual(delays, [2000, 2000])
})

test('room DID resolver retries lookups that previously failed', async () => {
  let attempts = 0
  const { createRoomDidResolver } = loadTypeScriptModule('src/core/job-gift-utils.ts', {
    './api': {
      getDid: async () => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('temporary room page failure')
        }
        return 'did-recovered'
      },
    },
  })
  const resolveDid = createRoomDidResolver('cookie')

  await assert.rejects(() => resolveDid(1001), /temporary room page failure/)
  assert.equal(await resolveDid(1001), 'did-recovered')
  assert.equal(attempts, 2)
})

test('gift sends stay serial, carry failed counts forward, and delay only between attempts', async () => {
  const events = []
  let sendAttempt = 0
  const { sendGifts } = loadTypeScriptModule('src/core/job-gift-utils.ts', {
    './api': {
      getDid: async roomId => `did-${roomId}`,
      parseDyAndSidFromCookie: () => ({ sid: 'sid', dy: 'dy' }),
      sendGift: async (_args, job) => {
        sendAttempt += 1
        events.push(`send:${job.roomId}:${job.count}`)
        if (sendAttempt === 1) {
          throw new Error('first send failed')
        }
      },
      sleep: async delay => events.push(`sleep:${delay}`),
    },
  })

  await sendGifts({
    1001: { roomId: 1001, giftId: 268, count: 2 },
    1002: { roomId: 1002, giftId: 268, count: 3 },
  }, 'cookie', () => {})

  assert.deepEqual(events, [
    'send:1001:2',
    'sleep:2000',
    'send:1002:5',
  ])
})

test('protected WebUI bootstrap defers full logs until the logs tab is active', async () => {
  const requestUrls = []
  const config = { cookie: 'main-cookie' }
  const resourceState = loadTypeScriptModule('src/docker/webui/resource-state.ts', {
    'vue': { ref: createRef },
    './resource-fans': {
      clearFansCookieBackedData: () => {},
      fansListError: createRef(''),
      fansListLoaded: createRef(false),
      fansStatusError: createRef(''),
      fansStatusLoaded: createRef(false),
      fansStatusLoading: createRef(false),
      getManagedFans: () => [],
      loadFansList: async () => true,
      loadFansStatus: async () => true,
      managedLoading: createRef(false),
    },
    './resource-config': {
      getRawConfig: () => config,
      hasCookieSourceConfigured: () => true,
      loadConfig: async () => {},
      rawConfig: createRef(config),
    },
    './resource-yuba': {
      clearYubaCookieBackedData: () => {},
      loadYubaStatus: async () => true,
      yubaStatusError: createRef(''),
      yubaStatusLoaded: createRef(false),
      yubaStatusLoading: createRef(false),
    },
    './request': {
      requestJson: async (url) => {
        requestUrls.push(url)
        return url === '/api/logs' ? [] : {}
      },
    },
    './task-shared': {
      getErrorMessage: error => String(error),
      isHttpUnauthorized: () => false,
    },
    './toast': { showToast: () => {} },
  })

  await resourceState.loadProtectedData('overview')
  assert.deepEqual(requestUrls, ['/api/overview'])

  await resourceState.loadActiveTabData('logs')
  assert.deepEqual(requestUrls, ['/api/overview', '/api/logs'])
})

test('WebUI config patch helper applies the authoritative full config response', async () => {
  const requests = []
  const fullConfig = {
    cookie: 'normalized-cookie',
    ui: { themeMode: 'dark' },
  }
  const fans = [{ roomId: 1001, name: '测试房间' }]
  const resourceConfig = loadTypeScriptModule('src/docker/webui/resource-config.ts', {
    'vue': { ref: createRef },
    '../../core/task-defaults': {
      createDefaultRawDockerConfig: () => ({ cookie: '' }),
    },
    './request': {
      requestJson: async (url, options) => {
        requests.push({ url, options })
        return { ok: true, data: { config: fullConfig, fans } }
      },
    },
    './task-shared': {
      hasCookieSourceConfigured: () => true,
    },
  })

  const result = await resourceConfig.saveConfigPatch({ ui: { themeMode: 'dark' } })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/config')
  assert.equal(requests[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[0].options.body), { ui: { themeMode: 'dark' } })
  assert.equal(resourceConfig.rawConfig.value, fullConfig)
  assert.equal(result.config, fullConfig)
  assert.equal(result.fans, fans)
})
