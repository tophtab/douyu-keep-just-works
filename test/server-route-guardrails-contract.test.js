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

function createInitialConfig() {
  return {
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
}

function createRouteTestContext() {
  let config = {
    ...createInitialConfig(),
  }
  const calls = {
    getEffectiveCookies: [],
    inspectCookieSource: [],
    persistEffectiveCookies: [],
    saveCookie: [],
    saveTaskConfig: [],
  }
  let lastSavePayload = null

  return {
    context: {
      webPassword: 'secret',
      getConfig: () => config,
      saveCookie: (cookies) => {
        calls.saveCookie.push(cookies)
        config = {
          ...config,
          cookie: cookies.main,
          manualCookies: cookies,
        }
      },
      saveTaskConfig: async (updates) => {
        calls.saveTaskConfig.push(updates)
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
      inspectCookieSource: async (...args) => {
        calls.inspectCookieSource.push(args)
        return {
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
        }
      },
      getEffectiveCookies: async (...args) => {
        calls.getEffectiveCookies.push(args)
        return {
          source: 'manual',
          mainCookie: config.manualCookies.main,
          yubaCookie: config.manualCookies.yuba,
          cookieCloudActive: Boolean(config.cookieCloud?.active),
          persistedLocally: true,
        }
      },
      persistEffectiveCookies: async (...args) => {
        calls.persistEffectiveCookies.push(args)
        return {
          config,
          effective: {
            source: 'manual',
            mainCookie: config.manualCookies.main,
            yubaCookie: config.manualCookies.yuba,
            cookieCloudActive: Boolean(config.cookieCloud?.active),
            persistedLocally: true,
          },
          updated: false,
        }
      },
      triggerTask: async () => {},
      fetchFans: async () => [],
      fetchFansStatusBase: async () => ({ fans: [], gift: {} }),
      fetchFansStatusDetails: async () => ({ fans: [], gift: {} }),
      fetchFansStatus: async () => ({ fans: [], gift: {} }),
      fetchYubaStatus: async () => ({ groups: [] }),
    },
    calls,
    getLastSavePayload: () => lastSavePayload,
    setConfig: (nextConfig) => {
      config = nextConfig
    },
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

test('createServer injects configured WebUI theme into served HTML', async () => {
  const { context, setConfig } = createRouteTestContext()
  setConfig({
    ...createInitialConfig(),
    ui: { themeMode: 'light' },
  })

  await withServer(createServer(context), async (baseUrl) => {
    const lightResponse = await fetch(`${baseUrl}/`)
    const lightHtml = await lightResponse.text()

    assert.equal(lightResponse.status, 200)
    assert.match(lightHtml, /initialThemeMode: 'light'/)
    assert.match(lightHtml, /<html lang="zh-CN" data-theme="light">/)
    assert.match(lightHtml, /<body data-theme="light" data-auth="login">/)
    assert.match(lightHtml, /<meta name="theme-color" content="#f4ede4" id="theme-color-meta">/)
    assert.doesNotMatch(lightHtml, /__INITIAL_THEME/)

    setConfig({
      ...createInitialConfig(),
      ui: { themeMode: 'neon' },
    })

    const fallbackResponse = await fetch(`${baseUrl}/`)
    const fallbackHtml = await fallbackResponse.text()

    assert.equal(fallbackResponse.status, 200)
    assert.match(fallbackHtml, /initialThemeMode: 'system'/)
    assert.match(fallbackHtml, /<html lang="zh-CN" data-theme="dark">/)
    assert.match(fallbackHtml, /<body data-theme="dark" data-auth="login">/)
    assert.match(fallbackHtml, /<meta name="theme-color" content="#000000" id="theme-color-meta">/)
  })
})

test('createServer protects config route and keeps overview summary free of config secrets', async () => {
  const { context } = createRouteTestContext()
  await withServer(createServer(context), async (baseUrl) => {
    const authStatus = await requestJson(`${baseUrl}/api/auth/status`)
    assert.equal(authStatus.response.status, 200)
    assert.deepEqual(authStatus.body, { authenticated: false })

    const unauthenticatedConfig = await requestJson(`${baseUrl}/api/config`)
    assert.equal(unauthenticatedConfig.response.status, 401)
    assert.deepEqual(unauthenticatedConfig.body, { error: '请先登录' })

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
    assert.equal(login.response.status, 200)
    const sessionCookie = getSessionCookie(login.response)

    const config = await requestJson(`${baseUrl}/api/config`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(config.response.status, 200)
    assert.equal(config.body.exists, true)
    assert.equal(config.body.data.cookie, MAIN_COOKIE)
    assert.equal(config.body.data.manualCookies.main, MAIN_COOKIE)
    assert.equal(config.body.data.manualCookies.yuba, YUBA_COOKIE)
    assert.equal(config.body.data.manualPassport.cookie, PASSPORT_COOKIE)
    assert.equal(config.body.data.cookieCloud.password, COOKIE_CLOUD_PASSWORD)

    const removedRawConfig = await fetch(`${baseUrl}/api/config/raw`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(removedRawConfig.status, 404)

    const overview = await requestJson(`${baseUrl}/api/overview`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(overview.response.status, 200)
    assert.equal(overview.body.manualPassportConfigured, true)
    const overviewJson = JSON.stringify(overview.body)
    assert.equal(overviewJson.includes('main-auth-redacted-secret-value'), false)
    assert.equal(overviewJson.includes('passport-ltp0-redacted-secret-value'), false)
    assert.equal(overviewJson.includes('cookiecloud-password-redacted-secret-value'), false)
  })
})

test('createServer returns complete config in config mutation responses', async () => {
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
    assert.equal(saveResult.body.data.config.manualPassport.cookie, nextPassportCookie)
  })
})

test('createServer config mutations validate before save and return JSON envelopes', async () => {
  const { calls, context } = createRouteTestContext()
  const nextMainCookie = 'acf_uid=next-uid-redacted; acf_auth=next-main-redacted-secret-value'
  const nextYubaCookie = 'acf_yb_uid=next-yb-redacted; acf_yb_t=next-yuba-redacted-secret-value'

  await withServer(createServer(context), async (baseUrl) => {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
    const sessionCookie = getSessionCookie(login.response)

    const missingCookie = await requestJson(`${baseUrl}/api/cookie`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ mainCookie: ' ', yubaCookie: '' }),
    })
    assert.equal(missingCookie.response.status, 400)
    assert.deepEqual(missingCookie.body, { error: '缺少 cookie' })
    assert.deepEqual(calls.saveCookie, [])

    const saveCookie = await requestJson(`${baseUrl}/api/cookie`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        mainCookie: ` ${nextMainCookie} `,
        yubaCookie: nextYubaCookie,
      }),
    })
    assert.equal(saveCookie.response.status, 200)
    assert.deepEqual(saveCookie.body, { ok: true })
    assert.deepEqual(calls.saveCookie, [{
      main: nextMainCookie,
      yuba: nextYubaCookie,
    }])

    const invalidConfig = await requestJson(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ manualPassport: [] }),
    })
    assert.equal(invalidConfig.response.status, 400)
    assert.deepEqual(invalidConfig.body, { error: 'manualPassport 配置无效' })
    assert.deepEqual(calls.saveTaskConfig, [])

    const validConfig = await requestJson(`${baseUrl}/api/config`, {
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
        ui: {
          theme: 'dark',
        },
      }),
    })
    assert.equal(validConfig.response.status, 200)
    assert.equal(validConfig.body.ok, true)
    assert.equal(validConfig.body.data.config.ui.theme, 'dark')
    assert.deepEqual(calls.saveTaskConfig, [{
      manualCookies: {
        main: MAIN_COOKIE,
        yuba: YUBA_COOKIE,
      },
      manualPassport: undefined,
      cookieCloud: undefined,
      ui: {
        theme: 'dark',
      },
    }])
  })
})

test('createServer cookie-source routes keep diagnostics local and persist with force refresh', async () => {
  const { calls, context, setConfig } = createRouteTestContext()

  await withServer(createServer(context), async (baseUrl) => {
    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })
    const sessionCookie = getSessionCookie(login.response)

    const check = await requestJson(`${baseUrl}/api/cookie-source/check`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    })
    assert.equal(check.response.status, 200)
    assert.equal(check.body.source, 'manual')
    assert.deepEqual(calls.inspectCookieSource, [[]])

    const effective = await requestJson(`${baseUrl}/api/cookie-source/effective`, {
      headers: { Cookie: sessionCookie },
    })
    assert.equal(effective.response.status, 200)
    assert.equal(effective.body.persistedLocally, true)
    assert.deepEqual(calls.getEffectiveCookies, [[true]])

    setConfig({
      ...createInitialConfig(),
      cookieCloud: {
        active: false,
        endpoint: 'https://cookiecloud.example.com',
        uuid: 'uuid-redacted',
        password: COOKIE_CLOUD_PASSWORD,
        cron: '0 0 */6 * * *',
        cryptoType: 'legacy',
      },
    })
    const inactivePersist = await requestJson(`${baseUrl}/api/cookie-source/persist`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    })
    assert.equal(inactivePersist.response.status, 400)
    assert.deepEqual(inactivePersist.body, { error: 'CookieCloud 未启用' })
    assert.deepEqual(calls.persistEffectiveCookies, [])

    setConfig(createInitialConfig())
    const activePersist = await requestJson(`${baseUrl}/api/cookie-source/persist`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    })
    assert.equal(activePersist.response.status, 200)
    assert.equal(activePersist.body.ok, true)
    assert.equal(activePersist.body.data.updated, false)
    assert.deepEqual(calls.persistEffectiveCookies, [[true]])
  })
})
