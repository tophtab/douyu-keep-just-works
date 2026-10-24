const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const { isScheduledTaskReady, resolveTaskPill } = loadTypeScriptModule('src/docker/webui/task-shared.ts', {
  './datetime': { formatDate: () => '-' },
  './request': { requestJson: async () => ({}) },
  './resource-config': {
    hasCookieSourceConfigured: () => false,
    saveConfigPatch: async () => null,
  },
  './toast': { showToast: () => {} },
})

function createConfig(overrides = {}) {
  return {
    loginCookies: { main: 'main-cookie', passport: '', yuba: 'yuba-cookie' },
    collectGift: { enabled: true, cron: '0 0 9 * * *' },
    keepalive: { enabled: true, cron: '0 0 9 * * *', roomAllocations: { 1001: { roomId: 1001, value: 1 } } },
    doubleCard: { enabled: true, cron: '0 0 9 * * *', roomAllocations: { 1001: { roomId: 1001, value: 1 } } },
    expiringGift: { enabled: true, cron: '0 0 9 * * *', roomAllocations: { 1001: { roomId: 1001, value: 1 } } },
    yubaCheckIn: { enabled: true, cron: '0 0 9 * * *' },
    ...overrides,
  }
}

test('scheduled task pill prioritizes switch state, then missing configuration', () => {
  assert.deepEqual(resolveTaskPill(false, false), { label: '未启动', kind: 'off' })
  assert.deepEqual(resolveTaskPill(false, true), { label: '未启动', kind: 'off' })
  assert.deepEqual(resolveTaskPill(true, false), { label: '未配置', kind: 'warn' })
  assert.deepEqual(resolveTaskPill(true, true), { label: '已启动', kind: 'ok' })
})

test('collect task needs its cron and the live cookie', () => {
  assert.equal(isScheduledTaskReady('collectGift', createConfig()), true)
  assert.equal(isScheduledTaskReady('collectGift', createConfig({ collectGift: { cron: ' ' } })), false)
  assert.equal(isScheduledTaskReady('collectGift', createConfig({ loginCookies: { main: '', yuba: 'yuba-cookie' } })), false)
  assert.equal(isScheduledTaskReady('collectGift', null), false)
})

test('allocation tasks need at least one room allocation', () => {
  for (const type of ['keepalive', 'doubleCard', 'expiringGift']) {
    assert.equal(isScheduledTaskReady(type, createConfig()), true, type)
    const emptyRooms = createConfig({
      [type]: { enabled: true, cron: '0 0 9 * * *', roomAllocations: {} },
    })
    assert.equal(isScheduledTaskReady(type, emptyRooms), false, type)
  }
  assert.equal(isScheduledTaskReady('collectGift', createConfig({ collectGift: { cron: '0 0 9 * * *' } })), true)
})

test('yuba task depends on the yuba cookie instead of the live cookie', () => {
  assert.equal(isScheduledTaskReady('yubaCheckIn', createConfig()), true)
  assert.equal(isScheduledTaskReady('yubaCheckIn', createConfig({ loginCookies: { main: 'main-cookie', yuba: '' } })), false)
  assert.equal(isScheduledTaskReady('yubaCheckIn', createConfig({ loginCookies: { main: '', yuba: 'yuba-cookie' } })), true)
  assert.equal(isScheduledTaskReady('yubaCheckIn', createConfig({ yubaCheckIn: { cron: '' } })), false)
})
