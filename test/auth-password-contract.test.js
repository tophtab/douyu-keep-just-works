const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const { WebPasswordStore } = loadTypeScriptModule('src/docker/auth-password.ts')

function createTempAuthPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyu-auth-password-'))
  return {
    filePath: path.join(dir, 'auth.json'),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('WEB_PASSWORD 作为无 auth.json 时的兜底密码', () => {
  const temp = createTempAuthPath()
  try {
    const store = new WebPasswordStore({
      filePath: temp.filePath,
      initialPassword: 'secret123',
    })

    assert.equal(store.verify('secret123'), true)
    assert.equal(store.verify('password'), false)
    assert.equal(store.info().source, 'env')

    // Guardrail: info() 只允许暴露来源/提示，绝不能带出明文密码
    const exposed = JSON.parse(JSON.stringify(store.info()))
    assert.deepEqual(Object.keys(exposed).sort(), ['source'])
    assert.equal(JSON.stringify(exposed).includes('secret123'), false)
  } finally {
    temp.cleanup()
  }
})

test('未设置或为空的 WEB_PASSWORD 回落到内置默认密码', () => {
  const temp = createTempAuthPath()
  try {
    const omitted = new WebPasswordStore({ filePath: temp.filePath })
    assert.equal(omitted.verify('password'), true)
    assert.equal(omitted.verify('secret123'), false)
    assert.equal(omitted.info().source, 'default')

    const empty = new WebPasswordStore({ filePath: temp.filePath, initialPassword: '' })
    assert.equal(empty.verify('password'), true)
    assert.equal(empty.info().source, 'default')
  } finally {
    temp.cleanup()
  }
})

test('界面改过密码后 auth.json 优先于 WEB_PASSWORD', () => {
  const temp = createTempAuthPath()
  try {
    const store = new WebPasswordStore({
      filePath: temp.filePath,
      initialPassword: 'secret123',
    })
    assert.equal(store.change('secret123', 'newsecret').ok, true)

    const reloaded = new WebPasswordStore({
      filePath: temp.filePath,
      initialPassword: 'secret123',
    })
    assert.equal(reloaded.verify('newsecret'), true)
    assert.equal(reloaded.verify('secret123'), false)
    assert.equal(reloaded.info().source, 'file')

    // Guardrail: auth.json 分支只暴露来源/更新时间/hint，不含明文
    const exposed = JSON.parse(JSON.stringify(reloaded.info()))
    assert.deepEqual(Object.keys(exposed).sort(), ['source', 'updatedAt'])
    assert.equal(JSON.stringify(exposed).includes('newsecret'), false)
  } finally {
    temp.cleanup()
  }
})

test('auth.json 优先于新启动时的任意 WEB_PASSWORD 值', () => {
  const temp = createTempAuthPath()
  try {
    const store = new WebPasswordStore({
      filePath: temp.filePath,
      initialPassword: 'secret123',
    })
    assert.equal(store.change('secret123', 'newsecret').ok, true)

    const withEnvPassword = new WebPasswordStore({
      filePath: temp.filePath,
      initialPassword: 'envpass',
    })
    assert.equal(withEnvPassword.verify('newsecret'), true)
    assert.equal(withEnvPassword.verify('envpass'), false)
    assert.equal(withEnvPassword.info().source, 'file')
  } finally {
    temp.cleanup()
  }
})
