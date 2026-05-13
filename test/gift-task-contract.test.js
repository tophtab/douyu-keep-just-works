const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function loadGiftTaskModule() {
  const source = fs.readFileSync(path.join(repoRoot, 'src/core/gift-task.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const exports = {}
  const module = { exports }
  vm.runInNewContext(output, { exports, module, require }, { filename: 'gift-task.js' })
  return module.exports
}

test('gift task helpers preserve enabled room filtering and gift send preparation', () => {
  const {
    applyGiftIdToSendJobs,
    buildEnabledSendConfig,
    buildGiftSendGroups,
    countPositiveGiftTargets,
    hasActiveDoubleCardRoom,
  } = loadGiftTaskModule()

  const send = {
    1001: { roomId: 1001, giftId: 268, count: 2 },
    1002: { roomId: 1002, giftId: 268, count: 0 },
    1003: { roomId: 1003, giftId: 268, count: 5 },
  }

  assert.deepEqual(Object.keys(buildEnabledSendConfig({
    send,
    enabled: { 1001: true, 1002: false, 1003: true },
  })), ['1001', '1003'])
  assert.deepEqual(Object.keys(buildEnabledSendConfig({ send })), ['1001', '1002', '1003'])

  const jobs = {
    1001: { roomId: 1001, giftId: 268, count: 2 },
    1002: { roomId: 1002, giftId: 268, count: 0 },
  }
  assert.equal(applyGiftIdToSendJobs(jobs, 999), jobs)
  assert.equal(jobs[1001].giftId, 999)
  assert.equal(jobs[1002].giftId, 999)
  assert.equal(countPositiveGiftTargets(jobs), 1)

  assert.deepEqual(JSON.parse(JSON.stringify(buildGiftSendGroups({
    giftCounts: { 268: 4, 999: 2 },
    giftNames: { 268: '荧光棒' },
  }))), [
    { giftId: 268, giftName: '荧光棒', giftCount: 4 },
    { giftId: 999, giftName: '未知礼物', giftCount: 2 },
  ])

  assert.equal(hasActiveDoubleCardRoom({ 1001: false, 1002: true }), true)
  assert.equal(hasActiveDoubleCardRoom({ 1001: false, 1002: false }), false)
})
