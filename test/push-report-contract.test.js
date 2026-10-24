const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

const { buildDailyReportCard, currentDayKey, previousDayKey, recordTaskRun } = loadTypeScriptModule('src/docker/runtime-notify.ts')
const { buildTaskRunSummary, collectDeliveries } = loadTypeScriptModule('src/docker/runtime-task-summary.ts')
const { createDefaultRawDockerConfig } = loadTypeScriptModule('src/core/task-defaults.ts')

function shanghaiDayKey(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function cardText(card) {
  return [
    card.fallbackText,
    ...card.elements.map(element => (typeof element.content === 'string' ? element.content : '')),
  ].join('\n')
}

/** 只保留一个已启用任务，方便断言单个任务落在哪个桶 */
function onlyKeepalive(cron) {
  const config = createDefaultRawDockerConfig()
  for (const type of ['collectGift', 'doubleCard', 'expiringGift', 'yubaCheckIn']) {
    config[type].enabled = false
  }
  config.keepalive.enabled = true
  config.keepalive.cron = cron
  return config
}

test('collectDeliveries still reads 赠送失败 lines with a space after the comma', () => {
  const logs = [
    '84452房间赠送失败: Error: timeout of 10000ms exceeded, 5个荧光棒(268)自动移交给下一个房间',
    '84453房间赠送失败: Request failed with status code 500, retry later, 3个荧光棒(268)自动移交给下一个房间',
  ]

  assert.deepEqual(collectDeliveries(logs).failed, [
    { roomId: '84452', count: 5 },
    { roomId: '84453', count: 3 },
  ])
})

test('buildTaskRunSummary reports 未送出 rooms when a task only logged failures', () => {
  const summary = buildTaskRunSummary({
    type: 'keepalive',
    label: '保活任务',
    startedAt: '2026-10-24T20:00:00.000Z',
    finishedAt: '2026-10-24T20:00:05.000Z',
    ok: true,
    logs: ['84452房间赠送失败: boom, 5个荧光棒(268)自动移交给下一个房间'],
  })

  assert.ok(summary.rows.some(row => row.item === '未送出' && row.value.includes('84452')))
  assert.match(summary.headline, /5 个未能送出/)
})

test('manual 今日汇总 labels tasks whose cron still fires today as 待执行, not 未执行', () => {
  // 每秒执行：无论当前几点，今天都还有没到点的计划
  const card = buildDailyReportCard(onlyKeepalive('* * * * * *'), undefined, { dayKey: currentDayKey() })
  const text = cardText(card)

  assert.match(text, /待执行/)
  assert.match(text, /保活任务/)
  assert.doesNotMatch(text, /未执行/)
  assert.ok(card.tags.some(tag => /待执行|稍后执行/.test(tag.text)))
})

test('scheduled report defaults to the previous day', () => {
  // 默认 09:00 推送：当天任务还没跑，只有前一天是完整的一天
  const card = buildDailyReportCard(onlyKeepalive('* * * * * *'))
  const text = cardText(card)

  assert.match(text, new RegExp(previousDayKey()))
  assert.match(text, /前一日/)
  assert.match(text, /保活任务：未执行/)
  assert.doesNotMatch(text, /待执行/)
})

test('daily report for a past day treats missing runs as 未执行', () => {
  const yesterday = shanghaiDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const card = buildDailyReportCard(onlyKeepalive('* * * * * *'), undefined, { dayKey: yesterday })
  const text = cardText(card)

  assert.match(text, /保活任务：未执行/)
  assert.doesNotMatch(text, /待执行/)
  assert.ok(card.tags.some(tag => tag.text.includes('无执行记录')))
})

test('recordTaskRun scrubs secrets before recording', () => {
  const record = recordTaskRun({
    type: 'keepalive',
    ok: false,
    startedAt: '2026-10-24T20:00:00.000Z',
    error: new Error('request failed: dy_did=secretvalue123'),
    logs: ['Authorization: Bearer abcdefghijklmnop'],
  })

  assert.ok(!record.error.includes('secretvalue123'))
  assert.ok(!record.logs[0].includes('abcdefghijklmnop'))
  assert.match(record.logs[0], /\*\*\*/)
})
