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
    if (name.startsWith('./')) {
      const dependencyPath = path.join(path.dirname(relativePath), `${name.slice(2)}.ts`)
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
