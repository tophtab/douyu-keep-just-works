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
  // Architecture guardrail: WebUI resource modules may coalesce in-flight reads,
  // but client-side cooldown/rate-limit timing belongs outside the Vue layer.
  const resourceRequest = readRepoFile('src/docker/webui/resource-request.ts')
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceYuba = readRepoFile('src/docker/webui/resource-yuba.ts')

  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /pending:\s*null/)
  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /fetchedAt:\s*0/)
  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /requestSeq:\s*0/)

  for (const functionName of ['syncFans', 'loadFansList', 'loadFansStatus']) {
    const body = getFunctionBody(resourceFans, functionName)
    assert.match(body, /if\s*\(\s*resource\.pending\s*\)/, `${functionName} must reuse an in-flight request`)
    assert.match(body, /return\s+resource\.pending/, `${functionName} must return the in-flight request`)
    assert.match(body, /trackResourceRequest\(resource,\s*requestSeq,\s*pending\)/, `${functionName} must track request sequence`)
    assert.match(body, /resource\.requestSeq\s*!==\s*requestSeq/, `${functionName} must ignore stale responses`)
  }

  const yubaBody = getFunctionBody(resourceYuba, 'loadYubaStatus')
  assert.match(yubaBody, /if\s*\(\s*yubaStatusRequest\.pending\s*\)/, 'loadYubaStatus must reuse an in-flight request')
  assert.match(yubaBody, /return\s+yubaStatusRequest\.pending/, 'loadYubaStatus must return the in-flight request')
  assert.match(yubaBody, /trackResourceRequest\(yubaStatusRequest,\s*requestSeq,\s*pending\)/, 'loadYubaStatus must track request sequence')
  assert.match(yubaBody, /yubaStatusRequest\.requestSeq\s*!==\s*requestSeq/, 'loadYubaStatus must ignore stale responses')

  const webuiResources = [resourceRequest, resourceFans, resourceYuba].join('\n')
  assert.doesNotMatch(webuiResources, /\b(cooldown|nextAllowed|minInterval|lastRequest|lastRequested|rateLimit|throttle|debounce)\b/i)
  assert.doesNotMatch(webuiResources, /Date\.now\(\)\s*-\s*resource\.fetchedAt/)
})

test('Docker runtime keeps backend cache TTLs and pending-promise coalescing authoritative', () => {
  // Architecture guardrail: backend cache TTLs and pending-promise coalescing stay
  // authoritative so frontend refactors do not duplicate freshness policy.
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
  // Behavioral boundary guardrail: fans reconcile must persist the reconciled config
  // and merge the latest local cookie snapshot instead of serving a cached response.
  const fansRoutes = readRepoFile('src/docker/server-fans-routes.ts')
  const fansSync = readRepoFile('src/docker/runtime-fans-sync.ts')

  assert.match(fansRoutes, /app\.post\('\/api\/fans\/reconcile'[\s\S]*ctx\.syncWithFans\(\)/)

  const syncBody = getAsyncMethodBody(fansSync, 'syncConfigWithFans')
  assert.match(syncBody, /const fans = await this\.deps\.getFansList\(cookie\)/)
  assert.match(syncBody, /const cookieConfig = shouldMergeLatestCookieSnapshot \? this\.mergeLatestCookieSnapshot\(sourceConfig\) : sourceConfig/)
  assert.match(syncBody, /const nextConfig = reconcileDockerConfig\(cookieConfig,\s*fans\)/)
  assert.match(syncBody, /this\.deps\.saveConfig\(this\.deps\.getConfigPath\(\),\s*nextConfig\)/)
  assert.doesNotMatch(syncBody, /getCachedStatus|reconcileCache|cachedReconcile|syncWithFansCache/)
})

test('Docker WebUI does not install or mount a mandatory global Express rate limiter', () => {
  // Forbidden-pattern guardrail: avoid a mandatory global Express limiter unless a
  // future task explicitly changes the local Docker WebUI request policy.
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const serverSources = readServerSources()

  assert.equal(packageJson.dependencies?.['express-rate-limit'], undefined)
  assert.equal(packageJson.devDependencies?.['express-rate-limit'], undefined)
  assert.doesNotMatch(serverSources, /express-rate-limit/)
  assert.doesNotMatch(serverSources, /app\.use\(\s*(?:rateLimit|limiter)\b/)
})
