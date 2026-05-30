const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const { createServer } = loadTypeScriptModule('src/docker/server.ts')

const MAIN_COOKIE = 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=main-auth-redacted-secret-value; acf_stk=main-stk-redacted'
const YUBA_COOKIE = 'acf_yb_uid=yb-uid-redacted; acf_yb_t=yuba-token-redacted-secret-value; acf_yb_auth=yuba-auth-redacted'
const PASSPORT_COOKIE = 'dy_did=did-redacted; LTP0=passport-ltp0-redacted-secret-value'
const COOKIE_CLOUD_PASSWORD = 'cookiecloud-password-redacted-secret-value'

function createJobStatus() {
  return {
    running: false,
    lastRun: null,
    nextRun: null,
  }
}

function createRouteTestContext() {
  let config = {
    cookie: MAIN_COOKIE,
    manualCookies: {
      main: MAIN_COOKIE,
      yuba: YUBA_COOKIE,
    },
    manualPassport: {
      cookie: PASSPORT_COOKIE,
    },
    cookieCloud: {
      active: true,
      endpoint: 'https://cookiecloud.example.com',
      uuid: 'uuid-redacted',
      password: COOKIE_CLOUD_PASSWORD,
      cron: '0 0 */6 * * *',
      cryptoType: 'legacy',
    },
  }
  let lastSavePayload = null

  return {
    context: {
      webPassword: 'secret',
      getConfig: () => config,
      saveCookie: (cookies) => {
        config = {
          ...config,
          cookie: cookies.main,
          manualCookies: cookies,
        }
      },
      saveTaskConfig: async (updates) => {
        lastSavePayload = updates
        config = {
          ...config,
          ...updates,
          cookie: updates.manualCookies?.main ?? config.cookie,
        }
        return { config, fans: [] }
      },
      syncWithFans: async () => ({ config, fans: [] }),
      getStatus: () => ({
        collectGift: createJobStatus(),
        keepalive: createJobStatus(),
        doubleCard: createJobStatus(),
        expiringGift: createJobStatus(),
        yubaCheckIn: createJobStatus(),
      }),
      getLogs: () => [],
      clearLogs: () => {},
      inspectCookieSource: async () => ({
        source: 'manual',
        mainCookieReady: true,
        yubaDyTokenReady: true,
        yubaCookieReady: true,
        missingMainKeys: [],
        missingYubaDyTokenKeys: [],
        missingYubaCookieKeys: [],
        missingYubaKeys: [],
        cookieCount: 3,
        domains: ['local'],
      }),
      getEffectiveCookies: async () => ({
        source: 'manual',
        mainCookie: config.manualCookies.main,
        yubaCookie: config.manualCookies.yuba,
        cookieCloudActive: Boolean(config.cookieCloud?.active),
        persistedLocally: true,
      }),
      persistEffectiveCookies: async () => ({
        config,
        effective: {
          source: 'manual',
          mainCookie: config.manualCookies.main,
          yubaCookie: config.manualCookies.yuba,
          cookieCloudActive: Boolean(config.cookieCloud?.active),
          persistedLocally: true,
        },
        updated: false,
      }),
      triggerTask: async () => {},
      fetchFans: async () => [],
      fetchFansStatusBase: async () => ({ fans: [], gift: {} }),
      fetchFansStatusDetails: async () => ({ fans: [], gift: {} }),
      fetchFansStatus: async () => ({ fans: [], gift: {} }),
      fetchYubaStatus: async () => ({ groups: [] }),
    },
    getLastSavePayload: () => lastSavePayload,
  }
}

async function withServer(app, run) {
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  return {
    body: text ? JSON.parse(text) : null,
    response,
  }
}

function getSessionCookie(response) {
  const cookieHeader = response.headers.get('set-cookie')
  assert.ok(cookieHeader, 'login must issue a session cookie')
  return cookieHeader.split(';')[0]
}

test('createServer protects config routes and masks public config secrets', async () => {
  const { context } = createRouteTestContext()
  await withServer(createServer(context), async (baseUrl) => {
    const authStatus = await requestJson(`${baseUrl}/api/auth/status`)
    assert.equal(authStatus.response.status, 200)
    assert.deepEqual(authStatus.body, { authenticated: false })

    const unauthenticatedConfig = await requestJson(`${baseUrl}/api/config`)
    assert.equal(unauthenticatedConfig.response.status, 401)
    assert.deepEqual(unauthenticatedConfig.body, { error: '请先登录' })

    const unauthenticatedRawConfig = await requestJson(`${baseUrl}/api/config/raw`)
    assert.equal(unauthenticatedRawConfig.response.status, 401)
    assert.deepEqual(unauthenticatedRawConfig.body, { error: '请先登录' })

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
    assert.equal(login.response.status, 200)
    const sessionCookie = getSessionCookie(login.response)

    const maskedConfig = await requestJson(`${baseUrl}/api/config`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(maskedConfig.response.status, 200)
    assert.equal(maskedConfig.body.exists, true)
    assert.notEqual(maskedConfig.body.data.cookie, MAIN_COOKIE)
    assert.notEqual(maskedConfig.body.data.manualCookies.main, MAIN_COOKIE)
    assert.notEqual(maskedConfig.body.data.manualCookies.yuba, YUBA_COOKIE)
    assert.notEqual(maskedConfig.body.data.manualPassport.cookie, PASSPORT_COOKIE)
    assert.notEqual(maskedConfig.body.data.cookieCloud.password, COOKIE_CLOUD_PASSWORD)
    assert.equal(JSON.stringify(maskedConfig.body).includes('main-auth-redacted-secret-value'), false)
    assert.equal(JSON.stringify(maskedConfig.body).includes('passport-ltp0-redacted-secret-value'), false)
    assert.equal(JSON.stringify(maskedConfig.body).includes('cookiecloud-password-redacted-secret-value'), false)

    const rawConfig = await requestJson(`${baseUrl}/api/config/raw`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(rawConfig.response.status, 200)
    assert.equal(rawConfig.body.data.manualPassport.cookie, PASSPORT_COOKIE)
    assert.equal(rawConfig.body.data.cookieCloud.password, COOKIE_CLOUD_PASSWORD)
  })
})

test('createServer masks manual passport material in config mutation responses', async () => {
  const { context, getLastSavePayload } = createRouteTestContext()
  const nextPassportCookie = 'dy_did=did-next-redacted; LTP0=next-passport-ltp0-redacted-secret-value'

  await withServer(createServer(context), async (baseUrl) => {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
    const sessionCookie = getSessionCookie(login.response)

    const saveResult = await requestJson(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        manualCookies: {
          main: MAIN_COOKIE,
          yuba: YUBA_COOKIE,
        },
        manualPassport: {
          cookie: nextPassportCookie,
        },
      }),
    })

    assert.equal(saveResult.response.status, 200)
    assert.equal(getLastSavePayload().manualPassport.cookie, nextPassportCookie)
    assert.notEqual(saveResult.body.data.config.manualPassport.cookie, nextPassportCookie)
    assert.equal(JSON.stringify(saveResult.body).includes('next-passport-ltp0-redacted-secret-value'), false)
  })
})
