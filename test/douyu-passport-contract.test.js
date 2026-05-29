const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function loadTypeScriptModule(relativePath, mocks = {}) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const exports = {}
  const module = { exports }
  function localRequire(name) {
    if (mocks[name]) {
      return mocks[name]
    }
    if (name.startsWith('.')) {
      const dependencyPath = path.normalize(path.join(path.dirname(relativePath), `${name}.ts`))
      return loadTypeScriptModule(dependencyPath, mocks)
    }
    return require(name)
  }
  vm.runInNewContext(output, { exports, module, require: localRequire, URL }, { filename: relativePath })
  return module.exports
}

test('CookieCloud can detect passport LTP0 without exposing the value in diagnostics', () => {
  const { createCookieDiagnostics, getCookieCloudPassportLtp0 } = loadTypeScriptModule('src/core/cookie-cloud.ts')
  const cookies = [
    { name: 'LTP0', value: 'redacted-ltp0', domain: '.passport.douyu.com', path: '/', secure: true },
    { name: 'LTP0', value: 'wrong-domain', domain: '.douyu.com', path: '/', secure: true },
  ]

  assert.equal(getCookieCloudPassportLtp0(cookies), 'redacted-ltp0')

  const diagnostics = createCookieDiagnostics('cookieCloud', 'acf_uid=u; dy_did=d; acf_auth=a; acf_stk=s', '', {
    cookieCount: cookies.length,
    domains: ['passport.douyu.com'],
    passportLtp0Present: Boolean(getCookieCloudPassportLtp0(cookies)),
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

test('Docker config normalizes manual passport LTP0 as optional secret recovery material', () => {
  const { normalizeDockerConfig } = loadTypeScriptModule('src/core/medal-sync.ts')

  assert.deepEqual(JSON.parse(JSON.stringify(normalizeDockerConfig({
    cookie: '',
    manualPassport: { ltp0: '  ltp0-redacted  ' },
  }).manualPassport)), { ltp0: 'ltp0-redacted' })

  assert.equal(normalizeDockerConfig({
    cookie: '',
    manualPassport: { ltp0: '   ' },
  }).manualPassport, undefined)
})

test('manual passport LTP0 is masked by public config while raw config stays raw', () => {
  const { registerConfigRoutes } = loadTypeScriptModule('src/docker/server-config-routes.ts')
  const config = {
    cookie: 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted',
    manualCookies: {
      main: 'acf_uid=uid-redacted; dy_did=did-redacted; acf_auth=auth-redacted; acf_stk=stk-redacted',
      yuba: '',
    },
    manualPassport: {
      ltp0: 'manual-ltp0-redacted-secret-value',
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

  const masked = readRoute('GET', '/api/config')
  const raw = readRoute('GET', '/api/config/raw')
  return readRoute('POST', '/api/config', {
    manualPassport: {
      ltp0: 'manual-ltp0-redacted-secret-value',
    },
  }).then((postMasked) => {
    assert.equal(masked.data.manualPassport.ltp0.includes('manual-ltp0-redacted-secret-value'), false)
    assert.equal(masked.data.manualPassport.ltp0.includes('...'), true)
    assert.equal(raw.data.manualPassport.ltp0, 'manual-ltp0-redacted-secret-value')
    assert.equal(postMasked.data.config.manualPassport.ltp0.includes('manual-ltp0-redacted-secret-value'), false)
    assert.equal(postMasked.data.config.manualPassport.ltp0.includes('...'), true)
  })
})

test('credential recovery uses manual passport LTP0 when CookieCloud is inactive', async () => {
  let safeAuthArgs
  const { recoverCredentialSnapshot } = loadTypeScriptModule('src/docker/runtime-cookie-recovery.ts', {
    '../core/douyu-passport': {
      refreshDouyuMainCookiesWithSafeAuth: async (args) => {
        safeAuthArgs = args
        return {
          refreshedCookie: [
            'dy_did=did-redacted',
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
  const persisted = []

  const result = await recoverCredentialSnapshot({
    hasCookieCloudSource: () => false,
    persistEffectiveCookies: async () => {
      throw new Error('CookieCloud should not be used')
    },
    loadCookieCloudSnapshot: async () => {
      throw new Error('CookieCloud should not be loaded')
    },
    getCurrentMainCookie: () => 'dy_did=did-redacted; acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old',
    getCurrentYubaCookie: () => 'yuba=kept',
    getManualPassportLtp0: () => 'manual-ltp0-redacted',
    persistManualCookieSnapshot: (mainCookie, yubaCookie) => {
      persisted.push({ mainCookie, yubaCookie })
      return { cookie: mainCookie, manualCookies: { main: mainCookie, yuba: yubaCookie } }
    },
    validateMainCookie: async (mainCookie) => {
      if (mainCookie.includes('uid-old')) {
        throw new Error('请检查主站 Cookie')
      }
    },
    log: () => {},
  })

  assert.equal(result.recovered, true)
  assert.equal(result.refreshedBy, 'safeAuth')
  assert.deepEqual(JSON.parse(JSON.stringify(safeAuthArgs)), {
    mainCookie: 'dy_did=did-redacted; acf_uid=uid-old; acf_auth=auth-old; acf_stk=stk-old; acf_ltkid=ltk-old; acf_username=user-old; acf_biz=biz-old; acf_ct=ct-old',
    dyDid: 'did-redacted',
    ltp0: 'manual-ltp0-redacted',
  })
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].yubaCookie, 'yuba=kept')
})

test('credential recovery reports missing dy_did before using manual passport LTP0', async () => {
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
    getManualPassportLtp0: () => 'manual-ltp0-redacted',
    persistManualCookieSnapshot: () => {
      throw new Error('should not persist')
    },
    validateMainCookie: async () => {
      throw new Error('请检查主站 Cookie')
    },
    log: () => {},
  })

  assert.equal(result.recovered, false)
  assert.match(result.reason, /主站 Cookie 缺少 dy_did/)
})
