const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function getBlockBody(source, declaration) {
  const functionIndex = source.indexOf(declaration)
  assert.notEqual(functionIndex, -1, `Missing ${declaration}`)

  let openBrace = -1
  let lineStart = functionIndex
  while (lineStart < source.length) {
    const lineEnd = source.indexOf('\n', lineStart)
    assert.notEqual(lineEnd, -1, `Missing body for ${declaration}`)
    const line = source.slice(lineStart, lineEnd)
    if (line.trimEnd().endsWith('{')) {
      openBrace = lineStart + line.lastIndexOf('{')
      break
    }
    lineStart = lineEnd + 1
  }
  assert.notEqual(openBrace, -1, `Missing body for ${declaration}`)

  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(openBrace + 1, index)
      }
    }
  }

  throw new Error(`Unclosed body for ${declaration}`)
}

function getFunctionBody(source, functionName) {
  return getBlockBody(source, `function ${functionName}`)
}

test('overview fans-status failures use durable page feedback with short explicit toasts', () => {
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceState = readRepoFile('src/docker/webui/resource-state.ts')
  const overview = readRepoFile('src/docker/webui/overview.ts')

  const clearResourceErrorBody = getFunctionBody(resourceFans, 'clearResourceError')
  const clearFansCookieBackedDataBody = getFunctionBody(resourceFans, 'clearFansCookieBackedData')
  const loadFansStatusBody = getFunctionBody(resourceFans, 'loadFansStatus')

  assert.match(resourceFans, /export const fansStatusError = ref\(''\)/)
  assert.match(clearResourceErrorBody, /key === 'fansStatus'[\s\S]*fansStatusError\.value = ''/)
  assert.match(clearFansCookieBackedDataBody, /fansStatusError\.value = ''/)
  assert.match(loadFansStatusBody, /fansStatusError\.value = ''/)
  assert.match(loadFansStatusBody, /fansStatusError\.value = getErrorMessage\(error\)/)
  assert.match(loadFansStatusBody, /if \(showSuccessToast\) \{\s*showToast\('加载粉丝牌状态失败，请查看页面提示', false\)\s*\}/)
  assert.doesNotMatch(loadFansStatusBody, /showToast\(`加载粉丝牌状态失败：\$\{getErrorMessage\(error\)\}`/)

  assert.match(overview, /fansStatusError/)
  assert.match(overview, /overviewBackpackEmptyText/)
  assert.match(overview, /加载背包明细失败：\$\{fansStatusError\.value\}。请点击顶部“刷新”重试。/)
  assert.match(overview, /overviewFansFeedbackText/)
  assert.match(overview, /本次刷新失败：\$\{fansStatusError\.value\}/)
  assert.doesNotMatch(overview, /当前显示上次结果/)
  assert.match(overview, /加载粉丝牌状态失败：\$\{fansStatusError\.value\}。请点击顶部“刷新”重试。/)

  assert.match(resourceState, /fansStatusError/)
  assert.match(resourceState, /!fansStatusLoaded\.value && !fansStatusError\.value/)
})

test('logs page load failures stay page-local while clear-log failures remain toast-only', () => {
  const resourceState = readRepoFile('src/docker/webui/resource-state.ts')
  const logsResource = readRepoFile('src/docker/webui/logs-resource.ts')

  const clearProtectedStateBody = getFunctionBody(resourceState, 'clearProtectedState')
  const loadLogsBody = getFunctionBody(resourceState, 'loadLogs')
  const clearLogsBody = getFunctionBody(resourceState, 'clearLogs')

  assert.match(resourceState, /export const logsError = ref\(''\)/)
  assert.match(clearProtectedStateBody, /logsError\.value = ''/)
  assert.match(resourceState, /export async function loadLogs\(showSuccessToast = false\): Promise<boolean \| undefined>/)
  assert.match(loadLogsBody, /logsError\.value = ''/)
  assert.match(loadLogsBody, /logsError\.value = getErrorMessage\(error\)/)
  assert.match(loadLogsBody, /if \(showSuccessToast\) \{\s*showToast\('加载日志失败，请查看页面提示', false\)\s*\}/)
  assert.doesNotMatch(loadLogsBody, /showToast\(`加载日志失败：\$\{getErrorMessage\(error\)\}`/)

  assert.match(logsResource, /logsError/)
  assert.match(logsResource, /加载日志失败：\$\{logsError\.value\}。当前显示上次结果。最近刷新：\$\{refreshedAt\}/)
  assert.match(logsResource, /加载日志失败：\$\{logsError\.value\}。请稍后重试。/)
  assert.match(logsResource, /void loadLogs\(\)/)
  assert.match(logsResource, /refreshLogs: \(\) => loadLogs\(true\)/)

  assert.match(clearLogsBody, /showToast\(`清空日志失败：\$\{getErrorMessage\(error\)\}`, false\)/)
  assert.doesNotMatch(clearLogsBody, /logsError\.value/)
})

test('automatic resource loads avoid toasts and manual refresh uses a short page-feedback pointer', () => {
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceState = readRepoFile('src/docker/webui/resource-state.ts')
  const resourceYuba = readRepoFile('src/docker/webui/resource-yuba.ts')

  const syncFansBody = getFunctionBody(resourceFans, 'syncFans')
  const loadFansListBody = getFunctionBody(resourceFans, 'loadFansList')
  const loadFansStatusBody = getFunctionBody(resourceFans, 'loadFansStatus')
  const loadYubaStatusBody = getFunctionBody(resourceYuba, 'loadYubaStatus')
  const loadActiveTabDataBody = getFunctionBody(resourceState, 'loadActiveTabData')
  const refreshSurfaceBody = getFunctionBody(resourceState, 'runRefreshOverviewSurface')

  assert.match(syncFansBody, /if \(showSuccessToast\) \{\s*showToast\('请先保存 Cookie 或启用 CookieCloud', false\)\s*\}/)
  assert.match(syncFansBody, /if \(showSuccessToast\) \{\s*showToast\('同步粉丝牌失败，请查看页面提示', false\)\s*\}/)
  assert.match(loadFansListBody, /if \(showSuccessToast\) \{\s*showToast\('加载粉丝牌列表失败，请查看页面提示', false\)\s*\}/)
  assert.match(loadFansStatusBody, /if \(showSuccessToast\) \{\s*showToast\('加载粉丝牌状态失败，请查看页面提示', false\)\s*\}/)
  assert.match(loadYubaStatusBody, /if \(showSuccessToast\) \{\s*showToast\('加载鱼吧状态失败，请查看页面提示', false\)\s*\}/)

  assert.match(loadActiveTabDataBody, /await loadFansStatus\(false\)/)
  assert.match(loadActiveTabDataBody, /await loadFansList\(false\)/)
  assert.match(loadActiveTabDataBody, /await loadYubaStatus\(false\)/)
  assert.match(loadActiveTabDataBody, /await loadLogs\(\)/)

  assert.match(refreshSurfaceBody, /loadFansStatus\(false, forceRefresh\)/)
  assert.match(refreshSurfaceBody, /loadFansList\(false, forceRefresh\)/)
  assert.match(refreshSurfaceBody, /loadYubaStatus\(false, forceRefresh\)/)
  assert.match(refreshSurfaceBody, /const refreshFailed = results\.includes\(false\)/)
  assert.match(refreshSurfaceBody, /showToast\(refreshFailed \? '刷新失败，请查看页面提示' : '状态已刷新', !refreshFailed\)/)
})
