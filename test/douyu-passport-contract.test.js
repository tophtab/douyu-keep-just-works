const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const REFRESHED_MAIN_COOKIE = [
  'dy_did=did-redacted',
  'acf_uid=uid-redacted',
  'acf_auth=auth-redacted',
  'acf_stk=stk-redacted',
  'acf_ltkid=ltk-redacted',
  'acf_username=user-redacted',
  'acf_biz=biz-redacted',
  'acf_ct=ct-redacted',
].join('; ')

function createManualRecoveryDeps(overrides) {
  return {
    hasCookieCloudSource: () => false,
    persistEffectiveCookies: async () => {
      throw new Error('CookieCloud should not be used')
    },
    loadCookieCloudSnapshot: async () => {
      throw new Error('CookieCloud should not be loaded')
    },
    getCurrentMainCookie: () => '',
    getCurrentYubaCookie: () => '',
    getManualPassportCookie: () => '',
    persistManualCookieSnapshot: () => {
      throw new Error('should not persist')
    },
    validateMainCookie: async (mainCookie) => {
      if (mainCookie.includes('uid-old')) {
        throw new Error('请检查主站 Cookie')
      }
    },
    log: () => {},
    ...overrides,
  }
}

function recordManualCookieSnapshot(persisted) {
  return (mainCookie, yubaCookie) => {
    persisted.push({ mainCookie, yubaCookie })
    return { cookie: mainCookie, manualCookies: { main: mainCookie, yuba: yubaCookie } }
  }
}

function createCookieSourceManagerHarness(DockerCookieSourceManager, initialConfig, options = {}) {
  let config = initialConfig
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix ?? 'douyu-cookie-source-'))
  const configPath = path.join(tempDir, 'config.json')
  const manager = new DockerCookieSourceManager(
    () => config,
    (nextConfig) => {
      config = nextConfig
    },
    () => configPath,
    (nextConfig) => {
      config = nextConfig
    },
    options.log ?? (() => {}),
    options.invalidateCache ?? (() => {}),
  )

  return {
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
    configPath,
    getConfig: () => config,
    manager,
  }
}

test('CookieCloud can build passport cookie material without exposing the value in diagnostics', () => {
  const { createCookieDiagnostics, getCookieCloudPassportCookie } = loadTypeScriptModule('src/core/cookie-cloud.ts')
  const cookies = [
    { name: 'LTP0', value: 'redacted-ltp0', domain: '.passport.douyu.com', path: '/', secure: true },
    { name: 'LTP0', value: 'wrong-domain', domain: '.douyu.com', path: '/', secure: true },
    { name: 'dy_did', value: 'did-redacted', domain: '.douyu.com', path: '/', secure: true },
  ]

  const passportCookie = getCookieCloudPassportCookie(cookies)
  assert.equal(passportCookie, 'dy_did=did-redacted; LTP0=redacted-ltp0')

  const diagnostics = createCookieDiagnostics('cookieCloud', 'acf_uid=u; dy_did=d; acf_auth=a; acf_stk=s', '', {
    cookieCount: cookies.length,
    domains: ['passport.douyu.com'],
    passportLtp0Present: passportCookie.includes('LTP0='),
  })

  assert.equal(diagnostics.passportLtp0Present, true)
  assert.equal(JSON.stringify(diagnostics).includes('redacted-ltp0'), false)
})

test('safeAuth helper sends dy_did and LTP0 and merges returned main-site auth fields', async () => {
  let request
  const axiosMock = {
    get: async (url, options) => {
      request = { url, options }
      return {
        headers: {
          'set-cookie': [
            'acf_uid=uid-new; Path=/; Domain=.douyu.com',
            'acf_auth=auth-new; Path=/; Domain=.douyu.com',
            'acf_stk=stk-new; Path=/; Domain=.douyu.com',
            'acf_ltkid=ltk-new; Path=/; Domain=.douyu.com',
            'acf_username=user-new; Path=/; Domain=.douyu.com',
            'acf_biz=biz-new; Path=/; Domain=.douyu.com',
            'acf_ct=ct-new; Path=/; Domain=.douyu.com',
            'dy_auth=dy-auth-new; Path=/; Domain=.douyu.com',
            'acf_yb_t=ignored-yuba; Path=/; Domain=.douyu.com',
          ],
        },
      }
    },
  }
  const { refreshDouyuMainCookiesWithSafeAuth } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  const result = await refreshDouyuMainCookiesWithSafeAuth({
    mainCookie: 'dy_did=did-redacted; acf_uid=old; keep=kept',
    dyDid: 'did-redacted',
    ltp0: 'ltp0-redacted',
  })

  assert.equal(request.url, 'https://passport.douyu.com/lapi/passport/iframe/safeAuth')
  assert.equal(request.options.headers.Cookie, 'dy_did=did-redacted; LTP0=ltp0-redacted')
  assert.equal(request.options.params.client_id, '1')
  assert.equal(request.options.params.callback, 'axiosJsonpCallback')
  assert.notEqual(request.options.maxRedirects, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(result.returnedKeys)), [
    'acf_auth',
    'acf_biz',
    'acf_ct',
    'acf_ltkid',
    'acf_stk',
    'acf_uid',
    'acf_username',
    'dy_auth',
  ])
  assert.match(result.refreshedCookie, /keep=kept/)
  assert.match(result.refreshedCookie, /acf_uid=uid-new/)
  assert.match(result.refreshedCookie, /acf_ct=ct-new/)
  assert.doesNotMatch(result.refreshedCookie, /acf_yb_t=ignored-yuba/)
})

test('safeAuth helper rejects responses without usable main-site auth fields', () => {
  const { mergeMainCookieWithSetCookieHeaders } = loadTypeScriptModule('src/core/douyu-passport.ts')

  assert.throws(
    () => mergeMainCookieWithSetCookieHeaders('dy_did=did-redacted', ['acf_yb_t=ignored; Path=/']),
    /safeAuth 未返回可用主站登录字段/,
  )
})

test('QR challenge carries backend-owned passport device cookie', async () => {
  let request
  const axiosMock = {
    post: async (url, body, options) => {
      request = { url, body, options }
      return {
        data: {
          error: 0,
          data: {
            code: 'scan-code-redacted',
            url: 'https://m.douyu.com/topic/scan-login-middle-page?scan_code=scan-code-redacted',
            expire: 300,
          },
        },
      }
    },
  }
  const { createDouyuPassportDeviceCookie, generateDouyuPassportQrChallenge } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })
  const passportDeviceCookie = createDouyuPassportDeviceCookie('did-redacted')

  const challenge = await generateDouyuPassportQrChallenge(1000, passportDeviceCookie)

  assert.equal(passportDeviceCookie, 'dy_did=did-redacted; acf_did=did-redacted; game_did=did-redacted')
  assert.equal(request.url, 'https://passport.douyu.com/scan/generateCode')
  assert.equal(request.body, 'client_id=1&isMultiAccount=0')
  assert.equal(request.options.headers.Cookie, passportDeviceCookie)
  assert.equal(challenge.code, 'scan-code-redacted')
  assert.equal(challenge.expiresAt, 301000)
})

test('QR auth poll exposes scanned and cancelled states without login material', async () => {
  const requests = []
  const responses = [
    { data: { error: 1, msg: '客户端已扫码' }, headers: {} },
    { data: { error: -1, msg: '客户端取消登录' }, headers: {} },
  ]
  const axiosMock = {
    get: async (url, options) => {
      requests.push({ url, options })
      return responses.shift()
    },
  }
  const { pollDouyuPassportQrAuth } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  const scanned = await pollDouyuPassportQrAuth('scan-code-redacted', 'dy_did=did-redacted')
  const cancelled = await pollDouyuPassportQrAuth('scan-code-redacted', 'dy_did=did-redacted')

  assert.equal(requests[0].url, 'https://passport.douyu.com/japi/scan/auth')
  assert.equal(requests[0].options.headers.Cookie, 'dy_did=did-redacted')
  assert.equal(requests[0].options.params.code, 'scan-code-redacted')
  assert.equal(scanned.status, 'scanned')
  assert.equal(scanned.message, '客户端已扫码')
  assert.equal(scanned.passportCookie, undefined)
  assert.equal(scanned.loginUrl, undefined)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.message, '客户端取消登录')
})

test('QR main login exchange adds JSONP parameters and merges main-site auth fields', async () => {
  let request
  const axiosMock = {
    get: async (url, options) => {
      request = { url, options }
      return {
        data: 'appClient_json_callback({"error":0,"msg":"ok","data":[]})',
        headers: {
          'set-cookie': [
            'acf_uid=uid-new; Path=/; Domain=.douyu.com',
            'acf_auth=auth-new; Path=/; Domain=.douyu.com',
            'acf_stk=stk-new; Path=/; Domain=.douyu.com',
            'acf_ltkid=ltk-new; Path=/; Domain=.douyu.com',
            'acf_biz=biz-new; Path=/; Domain=.douyu.com',
            'acf_ct=ct-new; Path=/; Domain=.douyu.com',
            'dy_auth=dy-auth-new; Path=/; Domain=.douyu.com',
          ],
        },
      }
    },
  }
  const { fetchDouyuMainCookiesFromLoginUrl } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  const result = await fetchDouyuMainCookiesFromLoginUrl({
    loginUrl: 'https://www.douyu.com/api/passport/login?uid=uid-redacted&code=login-ticket-redacted&loginType=scanCheck&state=&client_id=1',
    mainCookie: 'existing=kept',
    passportCookie: 'LTP0=passport-ltp0-redacted',
  })

  const requestedUrl = new URL(request.url)
  assert.equal(requestedUrl.origin, 'https://www.douyu.com')
  assert.equal(requestedUrl.pathname, '/api/passport/login')
  assert.equal(requestedUrl.searchParams.get('code'), 'login-ticket-redacted')
  assert.equal(requestedUrl.searchParams.get('callback'), 'appClient_json_callback')
  assert.ok(requestedUrl.searchParams.get('_'))
  assert.equal(request.options.headers.Cookie, 'LTP0=passport-ltp0-redacted; existing=kept')
  assert.deepEqual(JSON.parse(JSON.stringify(result.returnedKeys)), [
    'acf_auth',
    'acf_biz',
    'acf_ct',
    'acf_ltkid',
    'acf_stk',
    'acf_uid',
    'dy_auth',
  ])
  assert.match(result.refreshedCookie, /existing=kept/)
  assert.match(result.refreshedCookie, /acf_auth=auth-new/)
})

test('QR main login exchange reports QR-specific missing main-site auth fields', async () => {
  const axiosMock = {
    get: async () => ({
      data: 'appClient_json_callback({"error":0,"msg":"ok","data":[]})',
      headers: {
        'set-cookie': ['acf_yb_t=ignored-yuba; Path=/; Domain=.douyu.com'],
      },
    }),
  }
  const { fetchDouyuMainCookiesFromLoginUrl } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  await assert.rejects(
    async () => await fetchDouyuMainCookiesFromLoginUrl({
      loginUrl: 'https://www.douyu.com/api/passport/login?code=login-ticket-redacted',
      passportCookie: 'LTP0=passport-ltp0-redacted',
    }),
    (error) => {
      assert.match(error.message, /扫码登录主站未返回可用登录字段/)
      assert.doesNotMatch(error.message, /safeAuth/)
      return true
    },
  )
})

test('Yuba SSO follows passport safeAuth bridge location and merges full Yuba cookies', async () => {
  const requests = []
  const axiosMock = {
    get: async (url, options) => {
      requests.push({ url, options })
      if (url === 'https://yuba.douyu.com/mygroups') {
        return {
          headers: {
            'set-cookie': ['dy_did=did-redacted; Path=/; Domain=.douyu.com'],
          },
        }
      }
      if (url === 'https://yuba.douyu.com/wbapi/web/leaderboardTop') {
        return {
          headers: {
            'set-cookie': ['acf_yb_t=yb-t-redacted; Path=/; Domain=yuba.douyu.com'],
          },
        }
      }
      if (url === 'https://passport.douyu.com/lapi/passport/iframe/safeAuth') {
        return {
          headers: {
            location: '//yuba.douyu.com/ybapi/authlogin?callback=axiosJsonpCallback&code=bridge-code-redacted&loginType=safeAuth&uid=uid-redacted',
          },
        }
      }
      if (url === 'https://yuba.douyu.com/ybapi/authlogin?callback=axiosJsonpCallback&code=bridge-code-redacted&loginType=safeAuth&uid=uid-redacted') {
        return {
          headers: {
            'set-cookie': [
              'acf_yb_auth=yb-auth-redacted; Path=/; Domain=yuba.douyu.com',
              'acf_yb_uid=yb-uid-redacted; Path=/; Domain=yuba.douyu.com',
              'acf_yb_new_uid=yb-new-uid-redacted; Path=/; Domain=yuba.douyu.com',
              'acf_jwt_token=jwt-redacted; Path=/; Domain=yuba.douyu.com',
              'acf_dmjwt_token=dmjwt-redacted; Path=/; Domain=yuba.douyu.com',
            ],
          },
        }
      }
      throw new Error(`unexpected url: ${url}`)
    },
  }
  const { fetchDouyuYubaCookiesWithPassport } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  const result = await fetchDouyuYubaCookiesWithPassport({
    passportCookie: 'dy_did=did-redacted; LTP0=ltp0-redacted',
    mainCookie: 'acf_uid=uid-redacted; acf_auth=main-auth-redacted; acf_stk=stk-redacted; acf_ltkid=ltk-redacted; acf_biz=biz-redacted; acf_ct=ct-redacted',
    yubaCookie: 'acf_yb_auth=stale-yb-auth-redacted; acf_yb_uid=stale-yb-uid-redacted; acf_yb_t=stale-yb-t-redacted',
  })

  assert.deepEqual(requests.map(request => request.url), [
    'https://yuba.douyu.com/mygroups',
    'https://yuba.douyu.com/wbapi/web/leaderboardTop',
    'https://passport.douyu.com/lapi/passport/iframe/safeAuth',
    'https://yuba.douyu.com/ybapi/authlogin?callback=axiosJsonpCallback&code=bridge-code-redacted&loginType=safeAuth&uid=uid-redacted',
  ])
  assert.equal(requests[2].options.maxRedirects, 0)
  assert.equal(requests[2].options.params.client_id, '5')
  assert.equal(requests[2].options.params.did, 'did-redacted')
  assert.doesNotMatch(requests[2].options.headers.Cookie, /stale-yb-auth-redacted/)
  assert.doesNotMatch(requests[3].options.headers.Cookie, /stale-yb-auth-redacted/)
  assert.notEqual(requests[3].url, 'https://yuba.douyu.com/ybapi/authlogin')
  assert.deepEqual(JSON.parse(JSON.stringify(result.returnedKeys)), [
    'acf_dmjwt_token',
    'acf_jwt_token',
    'acf_yb_auth',
    'acf_yb_new_uid',
    'acf_yb_uid',
  ])
  assert.match(result.yubaCookie, /acf_yb_t=yb-t-redacted/)
  assert.match(result.yubaCookie, /acf_yb_auth=yb-auth-redacted/)
  assert.match(result.yubaCookie, /acf_yb_uid=yb-uid-redacted/)
  assert.match(result.yubaCookie, /acf_jwt_token=jwt-redacted/)
  assert.match(result.yubaCookie, /acf_dmjwt_token=dmjwt-redacted/)
  assert.doesNotMatch(result.yubaCookie, /stale-yb-auth-redacted/)
})

test('Yuba SSO rejects missing passport bridge location with a Yuba-specific error', async () => {
  const axiosMock = {
    get: async (url) => {
      if (url === 'https://yuba.douyu.com/mygroups' || url === 'https://yuba.douyu.com/wbapi/web/leaderboardTop') {
        return {
          headers: {
            'set-cookie': ['acf_yb_t=yb-t-redacted; Path=/; Domain=yuba.douyu.com'],
          },
        }
      }
      if (url === 'https://passport.douyu.com/lapi/passport/iframe/safeAuth') {
        return { headers: {} }
      }
      throw new Error(`unexpected url: ${url}`)
    },
  }
  const { fetchDouyuYubaCookiesWithPassport } = loadTypeScriptModule('src/core/douyu-passport.ts', { axios: axiosMock })

  await assert.rejects(
    async () => await fetchDouyuYubaCookiesWithPassport({
      passportCookie: 'dy_did=did-redacted; LTP0=ltp0-redacted',
      mainCookie: 'acf_uid=uid-redacted; acf_auth=main-auth-redacted; acf_stk=stk-redacted',
    }),
    /鱼吧 SSO 未返回 authlogin 跳转地址/,
  )
})

test('Docker config normalizes manual passport cookie as optional recovery material', () => {
  const { normalizeDockerConfig } = loadTypeScriptModule('src/core/config-normalization.ts')

  assert.deepEqual(JSON.parse(JSON.stringify(normalizeDockerConfig({
    cookie: '',
    manualPassport: { cookie: '  dy_did=did-redacted; LTP0=ltp0-redacted  ' },
  }).manualPassport)), { cookie: 'dy_did=did-redacted; LTP0=ltp0-redacted' })

  assert.equal(normalizeDockerConfig({
    cookie: '',
    manualPassport: { cookie: '   ' },
  }).manualPassport, undefined)
})

test('manual passport cookie is returned by authenticated config without a raw alias', () => {
  const { registerConfigRoutes } = loadTypeScriptModule('src/docker/server-config-routes.ts')
  const passportCookie = 'dy_did=did-redacted; LTP0=manual-ltp0-redacted-secret-value'
  const config = {
    cookie: 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted',
    manualCookies: {
      main: 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted',
      yuba: '',
    },
    manualPassport: {
      cookie: passportCookie,
    },
  }
  const routes = new Map()
  const app = {
    get: (pathname, handler) => {
      routes.set(`GET ${pathname}`, handler)
    },
    post: (pathname, handler) => {
      routes.set(`POST ${pathname}`, handler)
    },
    delete: () => {},
  }
  registerConfigRoutes(app, {
    webPassword: '',
    getConfig: () => config,
    saveCookie: () => {},
    saveTaskConfig: async () => ({ config, fans: [] }),
    syncWithFans: async () => ({ config, fans: [] }),
    getStatus: () => ({}),
    getLogs: () => [],
    clearLogs: () => {},
    inspectCookieSource: async () => ({}),
    getEffectiveCookies: async () => ({}),
    persistEffectiveCookies: async () => ({}),
    triggerTask: async () => {},
    fetchFans: async () => [],
    fetchFansStatusBase: async () => ({}),
    fetchFansStatusDetails: async () => ({}),
    fetchFansStatus: async () => ({}),
    fetchYubaStatus: async () => ({}),
  })

  function readRoute(method, pathname, requestBody = {}) {
    let responseBody
    const handler = routes.get(`${method} ${pathname}`)
    assert.equal(typeof handler, 'function')
    const result = handler({ body: requestBody }, {
      json: (value) => {
        responseBody = value
      },
      status: () => ({
        json: (value) => {
          responseBody = value
        },
      }),
    })
    if (result && typeof result.then === 'function') {
      return result.then(() => responseBody)
    }
    return responseBody
  }

  const editableConfig = readRoute('GET', '/api/config')
  assert.equal(routes.has('GET /api/config/raw'), false)
  return readRoute('POST', '/api/config', {
    manualPassport: {
      cookie: passportCookie,
    },
  }).then((postConfig) => {
    assert.equal(editableConfig.data.manualPassport.cookie, passportCookie)
    assert.equal(postConfig.data.config.manualPassport.cookie, passportCookie)
  })
})

test('credential recovery uses manual passport cookie to refresh main and Yuba cookies when CookieCloud is inactive', async () => {
  let safeAuthArgs
  let yubaSsoArgs
  const { recoverCredentialSnapshot } = loadTypeScriptModule('src/docker/runtime-cookie-recovery.ts', {
    '../core/douyu-passport': {
      refreshDouyuMainCookiesWithSafeAuth: async (args) => {
        safeAuthArgs = args
        return {
          refreshedCookie: REFRESHED_MAIN_COOKIE,
          returnedKeys: ['acf_auth', 'acf_uid'],
        }
      },
      fetchDouyuYubaCookiesWithPassport: async (args) => {
        yubaSsoArgs = args
        return {
          yubaCookie: 'acf_yb_auth=yb-auth-redacted; acf_yb_uid=yb-uid-redacted; acf_yb_t=yb-t-redacted',
          returnedKeys: ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t'],
        }
      },
    },
  })
  const persisted = []

  const result = await recoverCredentialSnapshot(createManualRecoveryDeps({
    getCurrentMainCookie: () => 'acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old',
    getCurrentYubaCookie: () => 'yuba=kept',
    getManualPassportCookie: () => 'dy_did=did-from-passport; LTP0=manual-ltp0-redacted',
    persistManualCookieSnapshot: recordManualCookieSnapshot(persisted),
    recoverYubaCookie: true,
  }))

  assert.equal(result.recovered, true)
  assert.equal(result.refreshedBy, 'safeAuth')
  assert.match(result.reason, /鱼吧 SSO 已刷新鱼吧 Cookie/)
  assert.deepEqual(JSON.parse(JSON.stringify(safeAuthArgs)), {
    mainCookie: 'dy_did=did-from-passport; acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old',
    dyDid: 'did-from-passport',
    ltp0: 'manual-ltp0-redacted',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(yubaSsoArgs)), {
    passportCookie: 'dy_did=did-from-passport; LTP0=manual-ltp0-redacted',
    mainCookie: REFRESHED_MAIN_COOKIE,
  })
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].yubaCookie, 'acf_yb_auth=yb-auth-redacted; acf_yb_uid=yb-uid-redacted; acf_yb_t=yb-t-redacted')
})

test('credential recovery keeps existing Yuba cookie when Yuba SSO fails after main recovery', async () => {
  const { recoverCredentialSnapshot } = loadTypeScriptModule('src/docker/runtime-cookie-recovery.ts', {
    '../core/douyu-passport': {
      refreshDouyuMainCookiesWithSafeAuth: async () => ({
        refreshedCookie: REFRESHED_MAIN_COOKIE,
        returnedKeys: ['acf_auth', 'acf_uid'],
      }),
      fetchDouyuYubaCookiesWithPassport: async () => {
        throw new Error('鱼吧 SSO 未返回 authlogin 跳转地址')
      },
    },
  })
  const persisted = []

  const result = await recoverCredentialSnapshot(createManualRecoveryDeps({
    getCurrentMainCookie: () => 'dy_did=did-redacted; acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old',
    getCurrentYubaCookie: () => 'acf_yb_auth=old-yuba; acf_yb_uid=old-uid; acf_yb_t=old-t',
    getManualPassportCookie: () => 'dy_did=did-redacted; LTP0=manual-ltp0-redacted',
    persistManualCookieSnapshot: recordManualCookieSnapshot(persisted),
    recoverYubaCookie: true,
  }))

  assert.equal(result.recovered, true)
  assert.equal(result.refreshedBy, 'safeAuth')
  assert.match(result.reason, /鱼吧 SSO 恢复失败/)
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].yubaCookie, 'acf_yb_auth=old-yuba; acf_yb_uid=old-uid; acf_yb_t=old-t')
})

test('credential recovery uses CookieCloud passport dy_did when synced main cookie lacks dy_did', async () => {
  let safeAuthArgs
  const { recoverCredentialSnapshot } = loadTypeScriptModule('src/docker/runtime-cookie-recovery.ts', {
    '../core/douyu-passport': {
      refreshDouyuMainCookiesWithSafeAuth: async (args) => {
        safeAuthArgs = args
        return {
          refreshedCookie: [
            'dy_did=did-from-cookiecloud',
            'acf_uid=uid-redacted',
            'acf_auth=auth-redacted',
            'acf_stk=stk-redacted',
            'acf_ltkid=ltk-redacted',
            'acf_username=user-redacted',
            'acf_biz=biz-redacted',
            'acf_ct=ct-redacted',
          ].join('; '),
          returnedKeys: ['acf_auth', 'acf_uid'],
        }
      },
    },
  })

  const syncedMain = 'acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old'
  const result = await recoverCredentialSnapshot({
    hasCookieCloudSource: () => true,
    persistEffectiveCookies: async () => ({
      updated: true,
      config: { cookie: syncedMain, manualCookies: { main: syncedMain, yuba: '' } },
    }),
    loadCookieCloudSnapshot: async () => ({
      cookies: [
        { name: 'LTP0', value: 'cookiecloud-ltp0-redacted', domain: '.passport.douyu.com', path: '/', secure: true },
        { name: 'dy_did', value: 'did-from-cookiecloud', domain: '.douyu.com', path: '/', secure: true },
      ],
      cryptoType: 'legacy',
      domains: ['douyu.com', 'passport.douyu.com'],
    }),
    getCurrentMainCookie: () => syncedMain,
    getCurrentYubaCookie: () => '',
    getManualPassportCookie: () => '',
    persistManualCookieSnapshot: mainCookie => ({ cookie: mainCookie, manualCookies: { main: mainCookie, yuba: '' } }),
    validateMainCookie: async (mainCookie) => {
      if (mainCookie.includes('uid-old')) {
        throw new Error('请检查主站 Cookie')
      }
    },
    log: () => {},
  })

  assert.equal(result.recovered, true)
  assert.equal(result.refreshedBy, 'safeAuth')
  assert.equal(safeAuthArgs.dyDid, 'did-from-cookiecloud')
  assert.equal(safeAuthArgs.ltp0, 'cookiecloud-ltp0-redacted')
  assert.match(safeAuthArgs.mainCookie, /dy_did=did-from-cookiecloud/)
})

test('credential recovery reports missing dy_did when passport and main cookies lack dy_did', async () => {
  const { recoverCredentialSnapshot } = loadTypeScriptModule('src/docker/runtime-cookie-recovery.ts', {
    '../core/douyu-passport': {
      refreshDouyuMainCookiesWithSafeAuth: async () => {
        throw new Error('safeAuth should not be called')
      },
    },
  })

  const result = await recoverCredentialSnapshot({
    hasCookieCloudSource: () => false,
    persistEffectiveCookies: async () => {
      throw new Error('CookieCloud should not be used')
    },
    loadCookieCloudSnapshot: async () => {
      throw new Error('CookieCloud should not be loaded')
    },
    getCurrentMainCookie: () => 'acf_uid=uid-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted; acf_ltkid=ltk-redacted; acf_username=user-redacted; acf_biz=biz-redacted; acf_ct=ct-redacted',
    getCurrentYubaCookie: () => '',
    getManualPassportCookie: () => 'LTP0=manual-ltp0-redacted',
    persistManualCookieSnapshot: () => {
      throw new Error('should not persist')
    },
    validateMainCookie: async () => {
      throw new Error('请检查主站 Cookie')
    },
    log: () => {},
  })

  assert.equal(result.recovered, false)
  assert.match(result.reason, /均缺少 dy_did/)
})

test('CookieCloud persist stores passport cookie in the local manual passport snapshot', async () => {
  const { DockerCookieSourceManager } = loadTypeScriptModule('src/docker/runtime-cookie-source.ts', {
    '../core/cookie-cloud': {
      buildCookieHeaderForUrl: (_cookies, targetUrl) => targetUrl.includes('yuba.douyu.com')
        ? 'acf_yb_auth=yb-auth-redacted; acf_yb_uid=yb-uid-redacted; acf_yb_t=yb-t-redacted'
        : 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted',
      createCookieDiagnostics: () => ({}),
      fetchCookieCloudSnapshot: async () => ({
        cookies: [],
        cryptoType: 'legacy',
        domains: ['douyu.com', 'passport.douyu.com'],
      }),
      getCookieCloudPassportCookie: () => 'dy_did=did-redacted; LTP0=ltp0-redacted',
      isCookieCloudReady: config => Boolean(config?.active && config.endpoint && config.uuid && config.password),
    },
  })
  const initialConfig = {
    cookie: '',
    cookieCloud: {
      active: true,
      endpoint: 'https://cookiecloud.example.com',
      uuid: 'uuid-redacted',
      password: 'password-redacted',
    },
  }
  const cacheInvalidations = []
  const harness = createCookieSourceManagerHarness(DockerCookieSourceManager, initialConfig, {
    invalidateCache: (scope) => {
      cacheInvalidations.push(scope)
    },
  })

  try {
    const result = await harness.manager.persistEffectiveCookies(true)
    const savedConfig = JSON.parse(fs.readFileSync(harness.configPath, 'utf8'))

    assert.equal(result.config.manualPassport.cookie, 'dy_did=did-redacted; LTP0=ltp0-redacted')
    assert.equal(savedConfig.manualPassport.cookie, 'dy_did=did-redacted; LTP0=ltp0-redacted')
    assert.equal(savedConfig.manualCookies.main.includes('acf_auth=auth-redacted'), true)
    assert.deepEqual(cacheInvalidations, ['all'])
  } finally {
    harness.cleanup()
  }
})

test('CookieCloud persist keeps complete local snapshots when fresh CookieCloud cookies are incomplete', async () => {
  const completeMain = 'acf_uid=uid-local; dy_did=did-local; acf_auth=auth-local; acf_stk=stk-local; acf_ltkid=ltk-local; acf_biz=biz-local; acf_ct=ct-local'
  const completeYuba = 'acf_yb_auth=yb-auth-local; acf_yb_uid=yb-uid-local; acf_yb_t=yb-t-local'
  const { DockerCookieSourceManager } = loadTypeScriptModule('src/docker/runtime-cookie-source.ts', {
    qrcode: {
      __esModule: true,
      default: { toDataURL: async () => 'data:image/png;base64,qr-redacted' },
    },
    '../core/cookie-cloud': {
      buildCookieHeaderForUrl: (_cookies, targetUrl) => targetUrl.includes('yuba.douyu.com')
        ? 'acf_yb_t=yb-t-incomplete'
        : 'acf_uid=uid-cloud; dy_did=did-cloud',
      createCookieDiagnostics: () => ({}),
      fetchCookieCloudSnapshot: async () => ({
        cookies: [],
        cryptoType: 'legacy',
        domains: ['douyu.com', 'yuba.douyu.com'],
      }),
      getCookieCloudPassportCookie: () => '',
      isCookieCloudReady: config => Boolean(config?.active && config.endpoint && config.uuid && config.password),
    },
  })
  const initialConfig = {
    cookie: completeMain,
    manualCookies: {
      main: completeMain,
      yuba: completeYuba,
    },
    cookieCloud: {
      active: true,
      endpoint: 'https://cookiecloud.example.com',
      uuid: 'uuid-redacted',
      password: 'password-redacted',
    },
  }
  const harness = createCookieSourceManagerHarness(DockerCookieSourceManager, initialConfig)

  try {
    const result = await harness.manager.persistEffectiveCookies(true)
    assert.equal(result.config.manualCookies.main, completeMain)
    assert.equal(result.config.manualCookies.yuba, completeYuba)
  } finally {
    harness.cleanup()
  }
})

test('passport QR login session persists passport and main before retryable Yuba success without public secrets', async () => {
  const secretScanCode = 'scan-code-redacted-secret-value'
  const secretLoginTicket = 'login-ticket-redacted-secret-value'
  const secretPassport = 'passport-ltp0-redacted-secret-value'
  const secretMainAuth = 'main-auth-redacted-secret-value'
  const secretYubaAuth = 'yuba-auth-redacted-secret-value'
  let pollAttempts = 0
  let yubaAttempts = 0
  const initialConfig = {
    cookie: '',
    manualCookies: {
      main: '',
      yuba: 'acf_yb_auth=old-yuba; acf_yb_uid=old-uid; acf_yb_t=old-t',
    },
  }
  const { DockerCookieSourceManager } = loadTypeScriptModule('src/docker/runtime-cookie-source.ts', {
    qrcode: {
      __esModule: true,
      default: {
        toDataURL: async (url) => {
          assert.match(url, new RegExp(secretScanCode))
          return 'data:image/png;base64,qr-redacted'
        },
      },
    },
    '../core/douyu-passport': {
      createDouyuPassportDeviceCookie: () => 'dy_did=did-redacted; acf_did=did-redacted; game_did=did-redacted',
      generateDouyuPassportQrChallenge: async (_now, passportCookie) => {
        assert.equal(passportCookie, 'dy_did=did-redacted; acf_did=did-redacted; game_did=did-redacted')
        return {
          code: secretScanCode,
          qrUrl: `https://m.douyu.com/topic/scan-login-middle-page?scan_code=${secretScanCode}`,
          expiresIn: 300,
          expiresAt: Date.now() + 300000,
        }
      },
      pollDouyuPassportQrAuth: async (_code, currentPassportCookie) => {
        assert.equal(currentPassportCookie, 'dy_did=did-redacted; acf_did=did-redacted; game_did=did-redacted')
        pollAttempts += 1
        if (pollAttempts === 1) {
          return {
            status: 'scanned',
            message: '客户端已扫码',
          }
        }
        return {
          status: 'confirmed',
          message: 'success',
          passportCookie: `${currentPassportCookie}; LTP0=${secretPassport}`,
          loginUrl: `https://www.douyu.com/api/passport/login?code=${secretLoginTicket}`,
        }
      },
      fetchDouyuMainCookiesFromLoginUrl: async (args) => {
        assert.match(args.loginUrl, new RegExp(secretLoginTicket))
        assert.match(args.passportCookie, /dy_did=did-redacted/)
        assert.match(args.passportCookie, new RegExp(secretPassport))
        return {
          refreshedCookie: `dy_did=did-redacted; acf_uid=uid-redacted; acf_auth=${secretMainAuth}; acf_stk=stk-redacted; acf_ltkid=ltk-redacted; acf_biz=biz-redacted; acf_ct=ct-redacted`,
          returnedKeys: ['acf_auth'],
        }
      },
      fetchDouyuYubaCookiesWithPassport: async () => {
        yubaAttempts += 1
        if (yubaAttempts === 1) {
          throw new Error('Yuba SSO failed once')
        }
        return {
          yubaCookie: `acf_yb_auth=${secretYubaAuth}; acf_yb_uid=yb-uid-redacted; acf_yb_t=yb-t-redacted`,
          returnedKeys: ['acf_yb_auth', 'acf_yb_uid', 'acf_yb_t'],
        }
      },
    },
  })
  const harness = createCookieSourceManagerHarness(DockerCookieSourceManager, initialConfig, {
    prefix: 'douyu-qr-login-',
  })

  try {
    const { manager } = harness

    const started = await manager.startPassportQrLogin()
    assert.equal(started.status, 'waiting')
    assert.equal(started.passportSaved, false)
    assert.equal(started.qrImageDataUrl, 'data:image/png;base64,qr-redacted')
    assert.equal(JSON.stringify(started).includes(secretScanCode), false)
    assert.equal(JSON.stringify(started).includes('did-redacted'), false)

    const scanned = await manager.pollPassportQrLogin()
    assert.equal(scanned.status, 'scanned')
    assert.equal(scanned.message, '已扫码，等待确认')
    assert.equal(scanned.passportSaved, false)
    assert.equal(scanned.qrImageDataUrl, 'data:image/png;base64,qr-redacted')
    assert.equal(JSON.stringify(scanned).includes(secretScanCode), false)

    const passportConfirmed = await manager.pollPassportQrLogin()
    assert.equal(passportConfirmed.status, 'passport_confirmed')
    assert.equal(passportConfirmed.passportSaved, true)
    assert.equal(JSON.stringify(passportConfirmed).includes(secretPassport), false)
    assert.equal(JSON.stringify(passportConfirmed).includes(secretLoginTicket), false)

    const mainSaved = await manager.pollPassportQrLogin()
    assert.equal(mainSaved.status, 'main_saved')
    assert.equal(mainSaved.mainSaved, true)
    const config = harness.getConfig()
    assert.equal(config.manualPassport.cookie.includes(secretPassport), true)
    assert.equal(config.manualPassport.cookie.includes('dy_did=did-redacted'), true)
    assert.equal(config.manualCookies.main.includes(secretMainAuth), true)
    assert.equal(config.manualCookies.main.includes('dy_did=did-redacted'), true)
    assert.equal(config.manualCookies.yuba.includes('old-yuba'), true)
    assert.equal(JSON.stringify(mainSaved).includes(secretMainAuth), false)

    const yubaFailed = await manager.pollPassportQrLogin()
    assert.equal(yubaFailed.status, 'yuba_failed')
    assert.equal(yubaFailed.canRetryYuba, true)
    assert.equal(config.manualCookies.yuba.includes('old-yuba'), true)

    const yubaSaved = await manager.retryPassportQrLoginYuba()
    assert.equal(yubaSaved.status, 'yuba_saved')
    assert.equal(yubaSaved.yubaSaved, true)
    assert.equal(harness.getConfig().manualCookies.yuba.includes(secretYubaAuth), true)
    assert.equal(JSON.stringify(yubaSaved).includes(secretYubaAuth), false)
  } finally {
    harness.cleanup()
  }
})
