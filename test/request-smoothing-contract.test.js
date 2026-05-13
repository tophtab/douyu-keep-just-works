const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function readServerSources() {
  return fs.readdirSync(path.join(repoRoot, 'src/docker'))
    .filter(file => /^server.*\.ts$/.test(file))
    .sort()
    .map(file => readRepoFile(`src/docker/${file}`))
    .join('\n')
}

function readWebuiResourceActionSources() {
  return [
    'src/docker/webui/resources.ts',
    'src/docker/webui/yuba.ts',
  ].map(readRepoFile).join('\n')
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

function getAsyncMethodBody(source, methodName) {
  return getBlockBody(source, `async ${methodName}`)
}

test('Docker WebUI coalesces duplicate local Douyu-backed reads without client cooldowns', () => {
  const webui = readRepoFile('src/docker/webui/legacy-app.ts')
  const legacyState = readRepoFile('src/docker/webui/legacy-state.ts')
  const actions = readWebuiResourceActionSources()

  assert.match(getFunctionBody(legacyState, 'createResourceRequest'), /pending:\s*null/)
  assert.match(getFunctionBody(legacyState, 'createResourceRequest'), /fetchedAt:\s*0/)
  assert.match(getFunctionBody(legacyState, 'createResourceRequest'), /requestSeq:\s*0/)

  for (const functionName of ['syncFans', 'loadFansList', 'loadFansStatus', 'loadYubaStatus']) {
    const body = getFunctionBody(actions, functionName)
    assert.match(body, /if\s*\(\s*resource\.pending\s*\)/, `${functionName} must reuse an in-flight request`)
    assert.match(body, /return\s+resource\.pending/, `${functionName} must return the in-flight request`)
    assert.match(body, /trackResourceRequest\(resource,\s*requestSeq,\s*pending\)/, `${functionName} must track request sequence`)
  }

  assert.doesNotMatch(webui + legacyState + actions, /\b(cooldown|nextAllowed|minInterval|lastRequest|lastRequested|rateLimit|throttle|debounce)\b/i)
  assert.doesNotMatch(webui + legacyState + actions, /Date\.now\(\)\s*-\s*resource\.fetchedAt/)
})

test('Docker runtime keeps backend cache TTLs and pending-promise coalescing authoritative', () => {
  const runtimeCache = readRepoFile('src/docker/runtime-cache.ts')

  assert.match(runtimeCache, /const FANS_LIST_CACHE_TTL_MS = 60 \* 1000/)
  assert.match(runtimeCache, /const FANS_STATUS_CACHE_TTL_MS = 5 \* 60 \* 1000/)
  assert.match(runtimeCache, /const YUBA_STATUS_CACHE_TTL_MS = 10 \* 60 \* 1000/)

  const fansListBody = getAsyncMethodBody(runtimeCache, 'getFansList')
  assert.match(fansListBody, /this\.fansListCache\.pending/)
  assert.match(fansListBody, /return await this\.fansListCache\.pending/)
  assert.match(fansListBody, /this\.fansListCache\.pending = pending/)
  assert.match(fansListBody, /getFansList\(cookie\)/)

  const statusBody = getFunctionBody(runtimeCache, 'getCachedStatus')
  assert.match(statusBody, /cache\.pending/)
  assert.match(statusBody, /return await cache\.pending/)
  assert.match(statusBody, /cache\.pending = pending/)
  assert.match(statusBody, /cache\.snapshot = snapshot/)
})

test('Fans reconcile remains a side-effecting operation, not a cached whole response', () => {
  const fansRoutes = readRepoFile('src/docker/server-fans-routes.ts')
  const runtime = readRepoFile('src/docker/runtime.ts')

  assert.match(fansRoutes, /app\.post\('\/api\/fans\/reconcile'[\s\S]*ctx\.syncWithFans\(\)/)

  const syncBody = getFunctionBody(runtime, 'syncConfigWithFans')
  assert.match(syncBody, /const fans = await runtimeCache\.getFansList\(cookie\)/)
  assert.match(syncBody, /const nextConfig = reconcileDockerConfig\(sourceConfig,\s*fans\)/)
  assert.match(syncBody, /saveConfigToDisk\(activeConfigPath,\s*nextConfig\)/)
  assert.doesNotMatch(syncBody, /getCachedStatus|reconcileCache|cachedReconcile|syncWithFansCache/)
})

test('Docker WebUI does not install or mount a mandatory global Express rate limiter', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const serverSources = readServerSources()

  assert.equal(packageJson.dependencies?.['express-rate-limit'], undefined)
  assert.equal(packageJson.devDependencies?.['express-rate-limit'], undefined)
  assert.doesNotMatch(serverSources, /express-rate-limit/)
  assert.doesNotMatch(serverSources, /app\.use\(\s*(?:rateLimit|limiter)\b/)
})
