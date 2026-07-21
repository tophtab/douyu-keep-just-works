const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

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

test('gift task helpers separate participating allocation intent from runtime send jobs', () => {
  const {
    applyGiftIdToSendJobs,
    buildParticipatingAllocation,
    buildGiftSendGroups,
    countPositiveGiftTargets,
    hasActiveDoubleCardRoom,
  } = loadGiftTaskModule()
  const {
    computeGiftCountOfNumber,
    computeGiftCountOfProportion,
  } = loadTypeScriptModule('src/core/gift.ts')

  const fixedAllocation = buildParticipatingAllocation({
    enabled: true,
    cron: '0 0 8 * * 3',
    giftScope: 'glowStick',
    participatingRoomIds: [1001, 1003],
    allocationMode: 'fixed',
    roomAllocations: {
      1001: { count: 2 },
      1002: { count: 0 },
      1003: { count: -1 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(fixedAllocation)), {
    allocationMode: 'fixed',
    roomAllocations: {
      1001: { count: 2 },
      1003: { count: -1 },
    },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(computeGiftCountOfNumber(7, fixedAllocation.roomAllocations))), {
    1001: { roomId: 1001, giftId: 268, count: 2 },
    1003: { roomId: 1003, giftId: 268, count: 5 },
  })

  const weightedJobs = computeGiftCountOfProportion(10, {
    1001: { weight: 1 },
    1002: { weight: 3 },
  })
  assert.deepEqual(JSON.parse(JSON.stringify(weightedJobs)), {
    1001: { roomId: 1001, giftId: 268, count: 2 },
    1002: { roomId: 1002, giftId: 268, count: 8 },
  })

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
