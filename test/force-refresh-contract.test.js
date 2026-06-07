const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')
const { readRepoFile } = require('./helpers/source-inspection')

function createRouteResponse() {
  return {
    body: undefined,
    statusCode: 200,
    json(value) {
      this.body = value
      return this
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
  }
}

async function runRoute(routes, method, pathname, query = {}) {
  const handler = routes.get(`${method} ${pathname}`)
  assert.equal(typeof handler, 'function', `Missing route ${method} ${pathname}`)
  const response = createRouteResponse()
  await handler({ query }, response)
  return response
}

test('force refresh query is forwarded only through cache-backed read routes', async () => {
  const { registerFansRoutes } = loadTypeScriptModule('src/docker/server-fans-routes.ts')
  const routes = new Map()
  const calls = []
  const app = {
    get: (pathname, handler) => {
      routes.set(`GET ${pathname}`, handler)
    },
    post: (pathname, handler) => {
      routes.set(`POST ${pathname}`, handler)
    },
  }
  const ctx = {
    syncWithFans: async () => ({ config: {}, fans: [] }),
    fetchFans: async (options) => {
      calls.push(['fans', options])
      return []
    },
    fetchFansStatusBase: async (options) => {
      calls.push(['fans-status-base', options])
      return { fans: [], gift: {} }
    },
    fetchFansStatusDetails: async (options) => {
      calls.push(['fans-status-details', options])
      return { fans: [], gift: {} }
    },
    fetchFansStatus: async (options) => {
      calls.push(['fans-status', options])
      return { fans: [], gift: {} }
    },
    fetchYubaStatus: async (options) => {
      calls.push(['yuba-status', options])
      return { groups: [] }
    },
  }

  registerFansRoutes(app, ctx)

  await runRoute(routes, 'GET', '/api/fans', { force: '1' })
  await runRoute(routes, 'GET', '/api/fans/status/base', { force: '1' })
  await runRoute(routes, 'GET', '/api/fans/status/details', { force: 'true' })
  await runRoute(routes, 'GET', '/api/fans/status', { force: ['0', '1'] })
  await runRoute(routes, 'GET', '/api/yuba/status')
  await runRoute(routes, 'POST', '/api/fans/reconcile', { force: '1' })

  assert.deepEqual(calls, [
    ['fans', { forceRefresh: true }],
    ['fans-status-base', { forceRefresh: true }],
    ['fans-status-details', { forceRefresh: true }],
    ['fans-status', { forceRefresh: true }],
    ['yuba-status', { forceRefresh: false }],
  ])
})

test('Docker runtime cache force refresh bypasses fresh snapshots without duplicating pending work', async () => {
  let fansListCalls = 0
  let giftCalls = 0
  let doubleCalls = 0
  const { DockerRuntimeCache } = loadTypeScriptModule('src/docker/runtime-cache.ts', {
    '../core/api': {
      getFansList: async () => {
        fansListCalls += 1
        return [{
          roomId: fansListCalls,
          name: `room-${fansListCalls}`,
          level: fansListCalls,
        }]
      },
      getGiftStatus: async () => {
        giftCalls += 1
        return {
          count: giftCalls,
          expireTime: giftCalls,
        }
      },
    },
    '../core/double-card': {
      checkDoubleCard: async () => {
        doubleCalls += 1
        return {
          active: doubleCalls % 2 === 0,
          expireTime: String(doubleCalls),
        }
      },
    },
  })

  const listCache = new DockerRuntimeCache()
  const firstList = await listCache.getFansList('main-cookie')
  const cachedList = await listCache.getFansList('main-cookie')
  const forcedList = await listCache.getFansList('main-cookie', true)
  assert.equal(firstList[0].roomId, 1)
  assert.equal(cachedList[0].roomId, 1)
  assert.equal(forcedList[0].roomId, 2)
  assert.equal(fansListCalls, 2)

  const statusCache = new DockerRuntimeCache()
  const firstStatus = await statusCache.getFansStatus('main-cookie', () => {})
  const cachedStatus = await statusCache.getFansStatus('main-cookie', () => {})
  const forcedStatus = await statusCache.getFansStatus('main-cookie', () => {}, true)
  const forcedBaseStatus = await statusCache.getFansStatusBase('main-cookie', true)
  assert.equal(firstStatus.gift.count, 1)
  assert.equal(cachedStatus.gift.count, 1)
  assert.equal(forcedStatus.gift.count, 2)
  assert.equal(firstStatus.fans[0].roomId, 3)
  assert.equal(forcedStatus.fans[0].roomId, 4)
  assert.equal(forcedBaseStatus.fans[0].roomId, 5)
  assert.equal(giftCalls, 2)
  assert.equal(fansListCalls, 5)

  const yubaCache = new DockerRuntimeCache()
  let yubaFetches = 0
  const firstYuba = await yubaCache.getYubaStatus(async () => {
    yubaFetches += 1
    return { groups: [{ name: 'cached-yuba' }] }
  })
  const cachedYuba = await yubaCache.getYubaStatus(async () => {
    yubaFetches += 1
    return { groups: [{ name: 'unexpected-yuba' }] }
  })
  const forcedYuba = await yubaCache.getYubaStatus(async () => {
    yubaFetches += 1
    return { groups: [{ name: 'fresh-yuba' }] }
  }, true)
  assert.equal(firstYuba.groups[0].name, 'cached-yuba')
  assert.equal(cachedYuba.groups[0].name, 'cached-yuba')
  assert.equal(forcedYuba.groups[0].name, 'fresh-yuba')
  assert.equal(yubaFetches, 2)

  let pendingFetches = 0
  const pendingCache = new DockerRuntimeCache()
  const pending = pendingCache.getYubaStatus(async () => {
    pendingFetches += 1
    await new Promise(resolve => setTimeout(resolve, 20))
    return { groups: [{ name: 'pending-yuba' }] }
  })
  const duplicate = pendingCache.getYubaStatus(async () => {
    pendingFetches += 1
    return { groups: [{ name: 'duplicate-yuba' }] }
  }, true)

  const [pendingResult, duplicateResult] = await Promise.all([pending, duplicate])
  assert.equal(pendingResult.groups[0].name, 'pending-yuba')
  assert.equal(duplicateResult.groups[0].name, 'pending-yuba')
  assert.equal(pendingFetches, 1)
})

test('WebUI force refresh is only wired through the top-right manual refresh path', () => {
  const overview = readRepoFile('src/docker/webui/overview.ts')
  const resourceState = readRepoFile('src/docker/webui/resource-state.ts')
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceYuba = readRepoFile('src/docker/webui/resource-yuba.ts')
  const taskPageActions = readRepoFile('src/docker/webui/task-page-actions.ts')

  assert.match(overview, /refreshOverviewSurface\(activeTab\.value,\s*true,\s*true\)/)
  assert.match(resourceState, /loadFansStatus\(false,\s*forceRefresh\)/)
  assert.match(resourceState, /loadFansList\(false,\s*forceRefresh\)/)
  assert.match(resourceState, /loadYubaStatus\(false,\s*forceRefresh\)/)
  assert.match(resourceState, /loadFansStatus\(false\)/)
  assert.match(resourceState, /loadFansList\(false\)/)
  assert.match(resourceState, /loadYubaStatus\(false\)/)
  assert.match(resourceState, /surfaceRefreshPending/)
  assert.match(resourceFans, /withForceRefresh\('\/api\/fans',\s*forceRefresh\)/)
  assert.match(resourceFans, /withForceRefresh\('\/api\/fans\/status\/base',\s*forceRefresh\)/)
  assert.match(resourceFans, /withForceRefresh\('\/api\/fans\/status\/details',\s*forceRefresh\)/)
  assert.match(resourceYuba, /withForceRefresh\('\/api\/yuba\/status',\s*forceRefresh\)/)
  assert.match(taskPageActions, /refreshOverviewSurface\(activeTab,\s*false\)/)
  assert.doesNotMatch(taskPageActions, /refreshOverviewSurface\(activeTab,\s*false,\s*true\)/)
})
