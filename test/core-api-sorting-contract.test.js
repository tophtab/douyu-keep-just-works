const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function loadApiModule(axiosMock) {
  const source = fs.readFileSync(path.join(repoRoot, 'src/core/api.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const exports = {}
  const module = { exports }
  function localRequire(name) {
    if (name === 'axios') {
      return axiosMock
    }
    return require(name)
  }
  vm.runInNewContext(output, { exports, module, require: localRequire }, { filename: 'api.js' })
  return module.exports
}

function fansRow({ name, roomId, level, rank, intimacy, today }) {
  return `<tr data-anchor_name="${name}" data-fans-room="${roomId}" data-fans-level="${level}" data-fans-rank="${rank}">
    <td>${name}</td><td>${roomId}</td><td>${intimacy}</td><td>${today}</td>
  </tr>`
}

test('getFansList sorts fans by current intimacy descending', async () => {
  const axiosMock = {
    get: async () => ({
      data: `<table class="fans-badge-list">
        <tr><th>name</th><th>room</th><th>intimacy</th><th>today</th></tr>
        ${fansRow({ name: 'high-level-low-intimacy', roomId: 1001, level: 30, rank: 1, intimacy: '10/999', today: 0 })}
        ${fansRow({ name: 'low-level-high-intimacy', roomId: 1002, level: 1, rank: 2, intimacy: '200/999', today: 0 })}
        ${fansRow({ name: 'middle', roomId: 1003, level: 10, rank: 3, intimacy: '50/999', today: 0 })}
      </table>`,
    }),
  }
  const { getFansList } = loadApiModule(axiosMock)

  const fans = await getFansList('cookie')

  assert.deepEqual(JSON.parse(JSON.stringify(fans.map(fan => fan.roomId))), [1002, 1003, 1001])
})

test('getBackpackStatus sorts backpack rows by count descending', async () => {
  const axiosMock = {
    get: async () => ({
      data: {
        error: 0,
        data: {
          list: [
            { id: 268, name: 'small', count: 1 },
            { id: 999, name: 'large', count: '9' },
            { id: 268, name: 'middle', count: 3 },
          ],
        },
      },
    }),
  }
  const { getBackpackStatus } = loadApiModule(axiosMock)

  const status = await getBackpackStatus('cookie')

  assert.deepEqual(JSON.parse(JSON.stringify(status.rows.map(row => row.count))), [9, 3, 1])
  assert.equal(status.glowStickCount, 4)
})
