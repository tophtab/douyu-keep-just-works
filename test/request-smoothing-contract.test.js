const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  getAsyncMethodBody,
  getFunctionBody,
  readDockerServerSources,
  readRepoFile,
} = require('./helpers/source-inspection')

test('Docker WebUI coalesces duplicate local Douyu-backed reads without client cooldowns', () => {
  // Architecture guardrail: WebUI resource modules may coalesce in-flight reads,
  // but client-side cooldown/rate-limit timing belongs outside the Vue layer.
  const resourceRequest = readRepoFile('src/docker/webui/resource-request.ts')
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceYuba = readRepoFile('src/docker/webui/resource-yuba.ts')

  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /pending:\s*null/)
  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /fetchedAt:\s*0/)
  assert.match(getFunctionBody(resourceRequest, 'createResourceRequest'), /requestSeq:\s*0/)

  const trackedRequestBody = getFunctionBody(resourceRequest, 'runTrackedResourceRequest')
  assert.match(trackedRequestBody, /if\s*\(\s*resource\.pending\s*\)/, 'shared tracked request helper must reuse an in-flight request')
  assert.match(trackedRequestBody, /return\s+resource\.pending\s+as\s+Promise<T>/, 'shared tracked request helper must return the in-flight request')
  assert.match(trackedRequestBody, /const requestSeq = resource\.requestSeq \+ 1/, 'shared tracked request helper must allocate a request sequence')
  assert.match(trackedRequestBody, /trackResourceRequest\(resource,\s*requestSeq,\s*pending\)/, 'shared tracked request helper must track request sequence')
  assert.match(trackedRequestBody, /isCurrent:\s*\(\) => resource\.requestSeq === requestSeq/, 'shared tracked request helper must expose stale response guard')

  for (const functionName of ['syncFans', 'loadFansList', 'loadFansStatus']) {
    const body = getFunctionBody(resourceFans, functionName)
    assert.match(body, /runTrackedResourceRequest\(resource,\s*\(\{ isCurrent \}\)/, `${functionName} must use shared tracked request helper`)
    assert.match(body, /if\s*\(\s*!isCurrent\(\)\s*\)/, `${functionName} must ignore stale responses`)
  }

  const yubaBody = getFunctionBody(resourceYuba, 'loadYubaStatus')
  assert.match(yubaBody, /runTrackedResourceRequest\(yubaStatusRequest,\s*\(\{ isCurrent \}\)/, 'loadYubaStatus must use shared tracked request helper')
  assert.match(yubaBody, /if\s*\(\s*!isCurrent\(\)\s*\)/, 'loadYubaStatus must ignore stale responses')

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
  const serverSources = readDockerServerSources()

  assert.equal(packageJson.dependencies?.['express-rate-limit'], undefined)
  assert.equal(packageJson.devDependencies?.['express-rate-limit'], undefined)
  assert.doesNotMatch(serverSources, /express-rate-limit/)
  assert.doesNotMatch(serverSources, /app\.use\(\s*(?:rateLimit|limiter)\b/)
})
