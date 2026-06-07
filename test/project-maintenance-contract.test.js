const assert = require('node:assert/strict')
const fs = require('node:fs')
const { test } = require('node:test')
const {
  collectRepoFiles,
  readRepoFile,
  repoPath,
} = require('./helpers/source-inspection')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

function extractExportedStringConstant(source, name) {
  const match = source.match(new RegExp(`export const ${name} = '([^']+)'`))
  assert.ok(match, `Missing exported constant ${name}`)
  return match[1]
}

test('Node runtime version is aligned across package metadata, Docker, CI, and docs', () => {
  // Contract label: Guardrail. Node runtime alignment is a static repo invariant.
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const dockerfile = readRepoFile('Dockerfile')
  const workflow = readRepoFile('.github/workflows/docker.yml')
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.engines?.node, '>=24 <25')
  assert.match(dockerfile, /^FROM node:24-slim AS deps$/m)
  assert.match(dockerfile, /^FROM node:24-slim AS runtime$/m)
  assert.match(workflow, /^\s+node-version: 24$/m)
  assert.match(contributing, /- Node\.js 24/)
  assert.doesNotMatch(contributing, /Node\.js 18/)
})

test('npm test remains a contract-test plus Docker-build quality gate', () => {
  // Contract label: Guardrail. The Docker-first quality gate must stay wired.
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.scripts?.['test:contracts'], 'node --test test/*.test.js')
  assert.equal(packageJson.scripts?.test, 'npm run test:contracts && npm run build:docker')
  assert.match(contributing, /contract tests and then the Docker\s+build/)
})

test('Docker image build installs dependencies once and prunes for runtime', () => {
  // Contract label: Guardrail. The runtime image should not repeat network dependency install.
  const dockerfile = readRepoFile('Dockerfile')
  const npmCiCommands = dockerfile.match(/^RUN npm ci\b/gm) ?? []

  assert.equal(npmCiCommands.length, 1)
  assert.match(dockerfile, /FROM deps AS production-deps\n\nRUN npm prune --omit=dev --omit=optional/)
  assert.match(dockerfile, /FROM deps AS builder\n\nCOPY src \.\/src/)
  assert.match(dockerfile, /npm prune --omit=dev --omit=optional/)
  assert.match(dockerfile, /COPY --from=production-deps \/app\/node_modules \.\/node_modules/)
  assert.doesNotMatch(dockerfile, /FROM node:24-slim AS runtime[\s\S]*RUN npm ci/)
})

test('Docker context is limited to current image build inputs', () => {
  // Contract label: Guardrail. Local metadata and docs should not affect Docker cache keys.
  const dockerignore = readRepoFile('.dockerignore')
  const activeRules = dockerignore
    .split(/\r?\n/)
    .filter(line => line !== '' && !line.startsWith('#'))

  assert.deepEqual(activeRules, [
    '*',
    '!Dockerfile',
    '!.dockerignore',
    '!package.json',
    '!package-lock.json',
    '!tsconfig.docker.json',
    '!tsconfig.webui.json',
    '!vite.config.ts',
    '!src/',
    '!src/**',
  ])
})

test('Docker workflow triggers only for image-affecting paths on branches and PRs', () => {
  // Contract label: Guardrail. Documentation-only changes should not spend Docker build minutes.
  const workflow = readRepoFile('.github/workflows/docker.yml')

  assert.match(workflow, /push:\n\s+branches: \[master\]\n\s+tags: \['V\*\.\*\.\*', 'v\*\.\*\.\*'\]\n\s+paths:/)
  assert.match(workflow, /pull_request:\n\s+branches: \[master\]\n\s+paths:/)
  for (const imagePath of [
    '.github/workflows/docker.yml',
    '.dockerignore',
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'tsconfig.docker.json',
    'tsconfig.webui.json',
    'vite.config.ts',
    'src/**',
  ]) {
    assert.ok(workflow.includes(`- '${imagePath}'`))
  }
})

test('config example cron defaults stay aligned with core defaults', () => {
  // Contract label: Guardrail. Sample config must stay aligned with exported defaults.
  const taskDefaults = readRepoFile('src/core/task-defaults.ts')
  const configExample = JSON.parse(readRepoFile('config.example.json'))

  assert.equal(configExample.cookieCloud?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_COOKIE_CLOUD_SYNC_CRON'))
  assert.equal(configExample.collectGift?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_COLLECT_GIFT_CRON'))
  assert.equal(configExample.keepalive?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_KEEPALIVE_CRON'))
  assert.equal(configExample.doubleCard?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_DOUBLE_CARD_CRON'))
  assert.equal(configExample.expiringGift?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_EXPIRING_GIFT_CRON'))
  assert.equal(configExample.yubaCheckIn?.cron, extractExportedStringConstant(taskDefaults, 'DEFAULT_YUBA_CHECK_IN_CRON'))
  assert.equal(configExample.doubleCard?.active, false)
  assert.match(taskDefaults, /doubleCard:\s*\{[\s\S]*?active: false/)
})

test('Docker WebUI build is Vite-backed and served as Docker static assets', () => {
  // Contract label: Guardrail. Docker WebUI build and serving paths must stay static.
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const viteConfig = readRepoFile('vite.config.ts')
  const webui = readRepoFile('src/docker/webui.ts')
  const webuiRoutes = readRepoFile('src/docker/server-webui-routes.ts')
  const viteIndex = readRepoFile('src/docker/webui/index.html')
  const main = readRepoFile('src/docker/webui/main.ts')

  assert.equal(packageJson.scripts?.['build:webui'], 'npm run type-check:webui && vite build')
  assert.equal(packageJson.scripts?.['type-check:webui'], 'vue-tsc -p tsconfig.webui.json --noEmit')
  assert.match(packageJson.scripts?.['build:docker'], /npm run build:webui/)
  assert.doesNotMatch(packageJson.scripts?.['build:docker'], /cp -R src\/docker\/webui/)
  assert.equal(packageJson.dependencies?.vue, undefined)
  assert.match(packageJson.devDependencies?.vue, /^\^3\./)
  assert.match(packageJson.devDependencies?.vite, /^\^/)
  assert.match(packageJson.devDependencies?.['@vitejs/plugin-vue'], /^\^/)

  assert.match(viteConfig, /@vitejs\/plugin-vue/)
  assert.match(viteConfig, /outDir: '\.\.\/\.\.\/\.\.\/build\/docker\/docker\/webui'/)
  assert.match(viteConfig, /input: 'index\.html'/)
  assert.match(viteConfig, /root: 'src\/docker\/webui'/)
  assert.match(webui, /WEBUI_ASSET_ROOT = path\.join\(__dirname, 'webui'\)/)
  assert.match(webui, /WEBUI_TEMPLATE_PATH = path\.join\(WEBUI_ASSET_ROOT, 'index\.html'\)/)
  assert.match(webui, /replaceToken\(html, '__DOCKER_WEBUI_PAGE_ROUTES_JSON__', JSON\.stringify\(DOCKER_WEBUI_PAGE_ROUTES\)\)/)
  assert.match(webuiRoutes, /express\.static\(WEBUI_ASSET_ROOT/)

  assert.match(viteIndex, /<div id="app"><\/div>/)
  assert.match(viteIndex, /<link rel="icon" type="image\/png" href="\/icon\.png">/)
  assert.match(viteIndex, /DOUYU_KEEP_WEBUI_BOOTSTRAP/)
  assert.match(viteIndex, /__INITIAL_THEME_MODE__/)
  assert.match(viteIndex, /__INITIAL_THEME__/)
  assert.match(viteIndex, /__INITIAL_THEME_COLOR__/)
  assert.match(viteIndex, /__DOCKER_WEBUI_PAGE_ROUTES_JSON__/)
  assert.match(viteIndex, /src="\/main\.ts"/)
  assert.equal(fs.existsSync(repoPath('src/docker/webui/public/icon.png')), true)
  assert.match(main, /createApp\(App\)\.mount\('#app'\)/)
  assert.match(main, /import '\.\/styles\/base\.css'/)
  assert.match(main, /import '\.\/styles\/shell\.css'/)
  assert.match(main, /import '\.\/styles\/components\.css'/)
  assert.match(main, /import '\.\/styles\/tables\.css'/)
  assert.match(main, /import '\.\/styles\/responsive\.css'/)
})

test('Docker WebUI remains Vue-only without legacy bridge files', () => {
  // Contract label: Guardrail. Legacy imperative WebUI runtime must stay deleted.
  const main = readRepoFile('src/docker/webui/main.ts')
  const webuiModuleFiles = collectRepoFiles('src/docker/webui')
    .filter(file => /\.(?:ts|vue)$/.test(file))
  const webuiModuleSource = webuiModuleFiles.map(readRepoFile).join('\n')
  const webuiWithoutBootstrap = webuiModuleSource.replace(/DOUYU_KEEP_WEBUI_BOOTSTRAP/g, '')

  assert.doesNotMatch(main, /installLegacy|startLegacyApp|DOUYU_KEEP_WEBUI_|await import\('\.\.\/webui\/app|await import\('\.\/app/)
  assert.doesNotMatch(webuiModuleSource, /data-action=|data-trigger=|id="app-shell" style="display:none"/)
  assert.doesNotMatch(webuiWithoutBootstrap, /installLegacy|startLegacyApp|WEBUI_BRIDGE_EVENTS|bridge-contract|useLegacyPageEvents|DOUYU_KEEP_WEBUI_/)
  for (const deletedFile of [
    'src/docker/webui/actions.ts',
    'src/docker/webui/bridge-contract.ts',
    'src/docker/webui/legacy-app.ts',
    'src/docker/webui/legacy-core.ts',
    'src/docker/webui/legacy-state.ts',
    'src/docker/webui/pages.ts',
    'src/docker/webui/resources.ts',
    'src/docker/webui/task-actions.ts',
    'src/docker/webui/task-pages.ts',
    'src/docker/webui/components/TaskTableSection.vue',
    'src/docker/webui/app.js',
    'src/docker/webui/app-actions.js',
    'src/docker/webui/app-pages.js',
    'src/docker/webui/app-task-pages.js',
  ]) {
    assert.equal(fs.existsSync(repoPath(deletedFile)), false, `${deletedFile} should stay deleted`)
  }
})

test('Docker WebUI cron preview ignores unauthorized pre-auth responses', async () => {
  const unauthorizedError = new Error('请先登录')
  unauthorizedError.status = 401

  const { useCronPreview } = loadTypeScriptModule('src/docker/webui/composables/use-cron-preview.ts', {
    '../request': {
      requestJson: async () => {
        throw unauthorizedError
      },
    },
  })

  const preview = useCronPreview(() => '0 5 0 * * *')
  await preview.loadCronPreview()

  assert.equal(preview.cronPreview.value.error, '')
  assert.doesNotMatch(preview.cronPreviewText.value, /请先登录|cron 校验失败/)
})

test('Docker WebUI cron preview hides empty and loading helper text', async () => {
  let resolveRequest
  const requestPromise = new Promise((resolve) => {
    resolveRequest = resolve
  })
  const { useCronPreview } = loadTypeScriptModule('src/docker/webui/composables/use-cron-preview.ts', {
    '../request': {
      requestJson: async () => requestPromise,
    },
  })

  const preview = useCronPreview(() => '0 31 8 */7 * *')
  assert.equal(preview.cronPreviewText.value, '')

  const loadPromise = preview.loadCronPreview()
  assert.equal(preview.cronPreview.value.loading, true)
  assert.equal(preview.cronPreviewText.value, '')

  resolveRequest({ runs: [] })
  await loadPromise
})

test('Docker WebUI cron preview does not render future run lists', async () => {
  const { useCronPreview } = loadTypeScriptModule('src/docker/webui/composables/use-cron-preview.ts', {
    '../request': {
      requestJson: async () => ({
        runs: [
          '2026-06-08T08:31:00.000+08:00',
          '2026-06-15T08:31:00.000+08:00',
          '2026-06-22T08:31:00.000+08:00',
        ],
      }),
    },
  })

  const preview = useCronPreview(() => '0 31 8 */7 * *')
  await preview.loadCronPreview()

  assert.equal(preview.cronPreview.value.runs.length, 3)
  assert.equal(preview.cronPreviewText.value, '')
})

test('Docker task scheduling uses shared task metadata for inventory facts', () => {
  // Contract label: Mixed. Centralized task metadata is a guardrail; exact
  // scheduler/runner calls are shape checks.
  const taskMetadata = readRepoFile('src/docker/task-metadata.ts')
  const scheduler = readRepoFile('src/docker/runtime-scheduler.ts')

  assert.match(taskMetadata, /export function getTaskConfig/)
  assert.match(taskMetadata, /export function getTriggerableTaskConfig/)
  assert.match(taskMetadata, /export function getTaskCron/)
  assert.match(taskMetadata, /export function getTaskScheduleSummary/)
  assert.match(taskMetadata, /export function hasActiveTaskConfig/)
  assert.doesNotMatch(scheduler, /private startCollectGiftTask/)
  assert.doesNotMatch(scheduler, /private startKeepaliveTask/)
  assert.doesNotMatch(scheduler, /private startDoubleCardTask/)
  assert.doesNotMatch(scheduler, /private startExpiringGiftTask/)
  assert.doesNotMatch(scheduler, /private startYubaCheckInTask/)
})

test('CookieCloud sync-and-check persists first, then checks the local snapshot only', () => {
  // Contract label: Mixed. Local-only diagnostics are a guardrail, while route
  // sequencing and UI copy can move toward behavior tests.
  const cookieSource = readRepoFile('src/docker/runtime-cookie-source.ts')
  const effectiveCookies = readRepoFile('src/docker/runtime-effective-cookies.ts')
  const snapshotStore = readRepoFile('src/docker/runtime-cookie-snapshot-store.ts')
  const cookieRoutes = readRepoFile('src/docker/server-cookie-source-routes.ts')

  assert.match(cookieSource, /new DockerEffectiveCookieResolver/)
  assert.match(cookieSource, /new DockerCookieSnapshotStore/)
  assert.match(effectiveCookies, /shouldUseSourceCookie\(cloudMainCookie, mainCookie, COMPLETE_MAIN_COOKIE_KEYS\)/)
  assert.match(effectiveCookies, /shouldUseSourceCookie\(cloudYubaCookie, yubaCookie, COMPLETE_YUBA_COOKIE_KEYS\)/)
  assert.match(effectiveCookies, /yubaCookie = yubaCookie \|\| mainCookie/)
  assert.match(effectiveCookies, /getCookieCloudPassportCookie\(snapshot\.cookies\)\.trim\(\)/)
  assert.match(effectiveCookies, /buildCookieHeaderForUrl\(snapshot\.cookies, MAIN_DOUYU_URL\)/)
  assert.match(effectiveCookies, /buildCookieHeaderForUrl\(snapshot\.cookies, YUBA_DOUYU_URL\)/)
  assert.match(snapshotStore, /manualPassport:\s*\{\s*cookie: manualPassportCookie\s*\}/)
  assert.doesNotMatch(snapshotStore, /manualCookies:\s*snapshot\.cookies/)
  assert.doesNotMatch(snapshotStore, /manualPassport:\s*\{\s*cookie:\s*JSON\.stringify/)
  assert.match(cookieSource, /async inspectCookieSource\(\): Promise<CookieDiagnostics>/)
  const inspectStart = cookieSource.indexOf('async inspectCookieSource()')
  const inspectEnd = cookieSource.indexOf('private async loadCookieCloudSnapshot')
  assert.ok(inspectStart >= 0 && inspectEnd > inspectStart)
  assert.doesNotMatch(cookieSource.slice(inspectStart, inspectEnd), /loadCookieCloudSnapshot/)
  assert.match(cookieRoutes, /\/api\/cookie-source\/passport-login\/start/)
  assert.match(cookieRoutes, /ctx\.startPassportQrLogin\(\)/)
  assert.match(cookieRoutes, /ctx\.pollPassportQrLogin\(\)/)
})

test('Docker runtime retries cookie-backed work once after centralized credential recovery', () => {
  // Contract label: Mixed. Forbidden direct recovery calls are guardrails; exact
  // recovery sequencing checks are shape-sensitive.
  const runtime = readRepoFile('src/docker/runtime.ts')
  const recovery = readRepoFile('src/docker/runtime-cookie-recovery.ts')
  const cache = readRepoFile('src/docker/runtime-cache.ts')
  const errors = readRepoFile('src/docker/server-errors.ts')
  const fansRoutes = readRepoFile('src/docker/server-fans-routes.ts')
  const taskRoutes = readRepoFile('src/docker/server-task-routes.ts')
  const taskRunnerDirectSource = [
    readRepoFile('src/docker/runtime-task-runners.ts'),
    readRepoFile('src/core/job.ts'),
    readRepoFile('src/core/collect-gift-job.ts'),
    readRepoFile('src/core/keepalive-job.ts'),
    readRepoFile('src/core/double-card-job.ts'),
    readRepoFile('src/core/expiring-gift-job.ts'),
    readRepoFile('src/core/yuba-check-in-job.ts'),
    readRepoFile('src/core/job-gift-utils.ts'),
    readRepoFile('src/core/collect-gift.ts'),
    readRepoFile('src/core/gift-task.ts'),
    readRepoFile('src/core/double-card.ts'),
    readRepoFile('src/core/yuba-check-in.ts'),
    readRepoFile('src/core/yuba-status.ts'),
  ].join('\n')

  assert.match(errors, /export function isCookieCredentialMessage/)
  assert.match(errors, /message\.includes\('Cookie中没有找到'\)/)
  assert.match(errors, /message\.includes\('主站 Cookie 缺少'\)/)
  assert.match(runtime, /new DockerRuntimeCookieRecoveryService/)
  assert.match(runtime, /new DockerRuntimeFansSyncService/)
  assert.match(runtime, /createRuntimeAppContext/)
  assert.doesNotMatch(runtime, /function syncConfigWithFans|function mergeLatestCookieSnapshot|function hasSendRooms/)
  assert.match(recovery, /export class DockerRuntimeCookieRecoveryService/)
  assert.match(recovery, /async refreshCookieSourceAfterFailure/)
  assert.match(recovery, /isCookieCredentialMessage\(message\)/)
  assert.match(recovery, /async runWithCookieSourceRetry/)
  assert.match(readRepoFile('src/docker/runtime-cookie-source.ts'), /recoverCredentialSnapshotWithDeps/)
  assert.match(recovery, /export async function recoverCredentialSnapshot/)
  assert.match(recovery, /validateRecoveredMainCookie\(syncedCookie, deps\.validateMainCookie\)[\s\S]*await deps\.persistEffectiveCookies\(true\)[\s\S]*validateRecoveredMainCookie\(syncedCookie, deps\.validateMainCookie\)[\s\S]*refreshDouyuMainCookiesWithSafeAuth[\s\S]*validateRecoveredMainCookie\(safeAuthResult\.refreshedCookie, deps\.validateMainCookie\)/)
  assert.match(recovery, /getCurrentMainCookie/)
  assert.match(recovery, /getManualPassportCookie/)
  assert.match(readRepoFile('src/core/douyu-passport.ts'), /passport\.douyu\.com\/lapi\/passport\/iframe\/safeAuth/)
  assert.match(readRepoFile('src/core/cookie-cloud.ts'), /export function getCookieCloudPassportCookie/)
  assert.doesNotMatch(taskRunnerDirectSource, /safeAuth|LTP0|ltp0|refreshDouyuMainCookiesWithSafeAuth/)
  assert.match(cache, /if \(isCookieCredentialMessage\(message\)\) \{\s*throw error\s*\}/)
  assert.match(fansRoutes, /isCookieCredentialMessage/)
  assert.match(taskRoutes, /isCookieCredentialMessage/)
})

test('manual passport cookie uses authenticated config and is saved from login config UI', () => {
  // Contract label: Mixed. Secret-boundary guardrails cross backend config,
  // public routes, and WebUI shape checks.
  const types = readRepoFile('src/core/types.ts')
  const defaults = readRepoFile('src/core/task-defaults.ts')
  const configStore = readRepoFile('src/docker/config-store.ts')
  const configRoutes = readRepoFile('src/docker/server-config-routes.ts')
  const cookieSourceActions = readRepoFile('src/docker/webui/cookie-source-actions.ts')
  const cookieSourceCopy = readRepoFile('src/docker/webui/cookie-source-copy.ts')
  const cookieSourceState = readRepoFile('src/docker/webui/cookie-source-state.ts')
  const configExample = JSON.parse(readRepoFile('config.example.json'))

  assert.match(types, /export interface ManualPassportConfig \{[\s\S]*cookie: string/)
  assert.match(types, /manualPassport\?: ManualPassportConfig/)
  assert.deepEqual(configExample.manualPassport, { cookie: 'dy_did=YOUR_DY_DID; LTP0=YOUR_PASSPORT_LTP0' })
  assert.match(defaults, /manualPassport:\s*\{\s*cookie: ''/)
  assert.match(configStore, /manualPassport\?: ManualPassportConfig/)
  assert.match(configStore, /updates\.manualPassport !== undefined/)

  assert.doesNotMatch(configRoutes, /function maskManualPassport/)
  assert.doesNotMatch(configRoutes, /function maskConfigManualPassport/)
  assert.match(configRoutes, /app\.get\('\/api\/config'[\s\S]*data: config/)
  assert.doesNotMatch(configRoutes, /app\.get\('\/api\/config\/raw'/)
  assert.match(configRoutes, /app\.post\('\/api\/config'[\s\S]*ctx\.saveTaskConfig/)
  assert.match(configRoutes, /manualPassport: payload\.manualPassport/)

  assert.match(cookieSourceState, /export const passportCookie = ref\(''\)/)
  assert.match(cookieSourceState, /passportCookie\.value = getManualPassportConfig\(config\)\.cookie/)
  assert.match(cookieSourceActions, /const nextPassportCookie = passportCookie\.value\.trim\(\)/)
  assert.match(cookieSourceActions, /manualCookies:\s*\{[\s\S]*main: mainCookie\.value\.trim\(\),[\s\S]*yuba: yubaCookie\.value\.trim\(\),[\s\S]*\},[\s\S]*manualPassport:\s*\{[\s\S]*cookie: nextPassportCookie/)
  assert.match(cookieSourceActions, /manualPassport:\s*\{\s*cookie: nextPassportCookie/)
  assert.match(cookieSourceActions, /applyManualPassportSaveResponse\(data\.data\.config, nextPassportCookie\)/)
  assert.doesNotMatch(cookieSourceActions, /saveManualPassport/)
  assert.match(cookieSourceCopy, /passport Cookie', value: hasManualPassport\(config\) \? '已配置' : '未配置'/)
  assert.doesNotMatch(cookieSourceActions + cookieSourceCopy + cookieSourceState, /ltp0[^'\n]*redacted-secret-value/)
})
