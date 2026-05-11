const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function getFunctionBody(source, functionName) {
  const declaration = `function ${functionName}`
  const functionIndex = source.indexOf(declaration)
  assert.notEqual(functionIndex, -1, `Missing function ${functionName}`)

  let openBrace = -1
  let lineStart = functionIndex
  while (lineStart < source.length) {
    const lineEnd = source.indexOf('\n', lineStart)
    assert.notEqual(lineEnd, -1, `Missing function body for ${functionName}`)
    const line = source.slice(lineStart, lineEnd)
    if (line.trimEnd().endsWith('{')) {
      openBrace = lineStart + line.lastIndexOf('{')
      break
    }
    lineStart = lineEnd + 1
  }
  assert.notEqual(openBrace, -1, `Missing function body for ${functionName}`)

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

  throw new Error(`Unclosed function body for ${functionName}`)
}

test('Docker WebUI coalesces duplicate local Douyu-backed reads without client cooldowns', () => {
  const webui = readRepoFile('src/docker/webui/index.html')

  assert.match(getFunctionBody(webui, 'createResourceRequest'), /pending:\s*null/)
  assert.match(getFunctionBody(webui, 'createResourceRequest'), /fetchedAt:\s*0/)
  assert.match(getFunctionBody(webui, 'createResourceRequest'), /requestSeq:\s*0/)

  for (const functionName of ['syncFans', 'loadFansList', 'loadFansStatus', 'loadYubaStatus']) {
    const body = getFunctionBody(webui, functionName)
    assert.match(body, /if\s*\(\s*resource\.pending\s*\)/, `${functionName} must reuse an in-flight request`)
    assert.match(body, /return\s+resource\.pending/, `${functionName} must return the in-flight request`)
    assert.match(body, /trackResourceRequest\(resource,\s*requestSeq,\s*pending\)/, `${functionName} must track request sequence`)
  }

  assert.doesNotMatch(webui, /\b(cooldown|nextAllowed|minInterval|lastRequest|lastRequested|rateLimit|throttle|debounce)\b/i)
  assert.doesNotMatch(webui, /Date\.now\(\)\s*-\s*resource\.fetchedAt/)
})

test('Docker runtime keeps backend cache TTLs and pending-promise coalescing authoritative', () => {
  const runtime = readRepoFile('src/docker/runtime.ts')

  assert.match(runtime, /const FANS_LIST_CACHE_TTL_MS = 60 \* 1000/)
  assert.match(runtime, /const FANS_STATUS_CACHE_TTL_MS = 5 \* 60 \* 1000/)
  assert.match(runtime, /const YUBA_STATUS_CACHE_TTL_MS = 10 \* 60 \* 1000/)

  const fansListBody = getFunctionBody(runtime, 'getCachedFansList')
  assert.match(fansListBody, /fansListCache\.pending/)
  assert.match(fansListBody, /return await fansListCache\.pending/)
  assert.match(fansListBody, /fansListCache\.pending = pending/)
  assert.match(fansListBody, /getFansList\(cookie\)/)

  const statusBody = getFunctionBody(runtime, 'getCachedStatus')
  assert.match(statusBody, /cache\.pending/)
  assert.match(statusBody, /return await cache\.pending/)
  assert.match(statusBody, /cache\.pending = pending/)
  assert.match(statusBody, /cache\.snapshot = snapshot/)
})

test('Fans reconcile remains a side-effecting operation, not a cached whole response', () => {
  const server = readRepoFile('src/docker/server.ts')
  const runtime = readRepoFile('src/docker/runtime.ts')

  assert.match(server, /app\.post\('\/api\/fans\/reconcile'[\s\S]*ctx\.syncWithFans\(\)/)

  const syncBody = getFunctionBody(runtime, 'syncConfigWithFans')
  assert.match(syncBody, /const fans = await getCachedFansList\(cookie\)/)
  assert.match(syncBody, /const nextConfig = reconcileDockerConfig\(sourceConfig,\s*fans\)/)
  assert.match(syncBody, /saveConfigToDisk\(activeConfigPath,\s*nextConfig\)/)
  assert.doesNotMatch(syncBody, /getCachedStatus|reconcileCache|cachedReconcile|syncWithFansCache/)
})

test('Docker WebUI does not install or mount a mandatory global Express rate limiter', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const server = readRepoFile('src/docker/server.ts')

  assert.equal(packageJson.dependencies?.['express-rate-limit'], undefined)
  assert.equal(packageJson.devDependencies?.['express-rate-limit'], undefined)
  assert.doesNotMatch(server, /express-rate-limit/)
  assert.doesNotMatch(server, /app\.use\(\s*(?:rateLimit|limiter)\b/)
})
