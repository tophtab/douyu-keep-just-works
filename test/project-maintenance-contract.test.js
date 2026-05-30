const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath)
}

function collectRepoFiles(relativeDir) {
  const root = repoPath(relativeDir)
  const entries = fs.readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const child = path.join(relativeDir, entry.name)
    return entry.isDirectory() ? collectRepoFiles(child) : [child]
  })
}

function extractExportedStringConstant(source, name) {
  const match = source.match(new RegExp(`export const ${name} = '([^']+)'`))
  assert.ok(match, `Missing exported constant ${name}`)
  return match[1]
}

test('Node runtime version is aligned across package metadata, Docker, CI, and docs', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const dockerfile = readRepoFile('Dockerfile')
  const workflow = readRepoFile('.github/workflows/docker.yml')
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.engines?.node, '>=24 <25')
  assert.match(dockerfile, /^FROM node:24-slim AS builder$/m)
  assert.match(dockerfile, /^FROM node:24-slim AS runtime$/m)
  assert.match(workflow, /^\s+node-version: 24$/m)
  assert.match(contributing, /- Node\.js 24/)
  assert.doesNotMatch(contributing, /Node\.js 18/)
})

test('npm test remains a contract-test plus Docker-build quality gate', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.scripts?.['test:contracts'], 'node --test test/*.test.js')
  assert.equal(packageJson.scripts?.test, 'npm run test:contracts && npm run build:docker')
  assert.match(contributing, /contract tests and then the Docker\s+build/)
})

test('config example cron defaults stay aligned with core defaults', () => {
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

test('Docker WebUI is Vue-only and served as Vite static Docker assets', () => {
  // Architecture guardrail: these source checks preserve the Vue-only WebUI runtime,
  // Vite asset pipeline, and deleted legacy bridge boundary during refactors.
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const viteConfig = readRepoFile('vite.config.ts')
  const webui = readRepoFile('src/docker/webui.ts')
  const webuiRoutes = readRepoFile('src/docker/server-webui-routes.ts')
  const viteIndex = readRepoFile('src/docker/webui/index.html')
  const main = readRepoFile('src/docker/webui/main.ts')
  const appVue = readRepoFile('src/docker/webui/App.vue')
  const appEvents = readRepoFile('src/docker/webui/app-events.ts')
  const appShell = readRepoFile('src/docker/webui/components/AppShell.vue')
  const sidebarNav = readRepoFile('src/docker/webui/components/SidebarNav.vue')
  const topToolbar = readRepoFile('src/docker/webui/components/TopToolbar.vue')
  const authShell = readRepoFile('src/docker/webui/components/AuthShell.vue')
  const overviewPage = readRepoFile('src/docker/webui/components/OverviewPage.vue')
  const loginConfigPage = readRepoFile('src/docker/webui/components/LoginConfigPage.vue')
  const collectPage = readRepoFile('src/docker/webui/components/CollectPage.vue')
  const yubaPage = readRepoFile('src/docker/webui/components/YubaPage.vue')
  const keepalivePage = readRepoFile('src/docker/webui/components/KeepalivePage.vue')
  const doublePage = readRepoFile('src/docker/webui/components/DoublePage.vue')
  const expiringPage = readRepoFile('src/docker/webui/components/ExpiringPage.vue')
  const logsPage = readRepoFile('src/docker/webui/components/LogsPage.vue')
  const taskStatusCard = readRepoFile('src/docker/webui/components/TaskStatusCard.vue')
  const cronField = readRepoFile('src/docker/webui/components/CronField.vue')
  const enableSwitch = readRepoFile('src/docker/webui/components/EnableSwitch.vue')
  const actionBar = readRepoFile('src/docker/webui/components/ActionBar.vue')
  const fansStatusTable = readRepoFile('src/docker/webui/components/FansStatusTable.vue')
  const yubaStatusTable = readRepoFile('src/docker/webui/components/YubaStatusTable.vue')
  const allocationTable = readRepoFile('src/docker/webui/components/AllocationTable.vue')
  const expiringBackpackTable = readRepoFile('src/docker/webui/components/ExpiringBackpackTable.vue')
  const auth = readRepoFile('src/docker/webui/auth.ts')
  const navigation = readRepoFile('src/docker/webui/navigation.ts')
  const request = readRepoFile('src/docker/webui/request.ts')
  const resources = readRepoFile('src/docker/webui/resource-state.ts')
  const resourceConfig = readRepoFile('src/docker/webui/resource-config.ts')
  const resourceFans = readRepoFile('src/docker/webui/resource-fans.ts')
  const resourceRequest = readRepoFile('src/docker/webui/resource-request.ts')
  const resourceYuba = readRepoFile('src/docker/webui/resource-yuba.ts')
  const logsResource = readRepoFile('src/docker/webui/logs-resource.ts')
  const cronPreview = readRepoFile('src/docker/webui/composables/use-cron-preview.ts')
  const taskPageActions = readRepoFile('src/docker/webui/task-page-actions.ts')
  const taskShared = readRepoFile('src/docker/webui/task-shared.ts')
  const fansBackedTaskPage = readRepoFile('src/docker/webui/fans-backed-task-page.ts')
  const overview = readRepoFile('src/docker/webui/overview.ts')
  const collect = readRepoFile('src/docker/webui/collect.ts')
  const keepalive = readRepoFile('src/docker/webui/keepalive.ts')
  const double = readRepoFile('src/docker/webui/double.ts')
  const expiring = readRepoFile('src/docker/webui/expiring.ts')
  const cookie = readRepoFile('src/docker/webui/cookie.ts')
  const yuba = readRepoFile('src/docker/webui/yuba.ts')
  const theme = readRepoFile('src/docker/webui/theme.ts')
  const toast = readRepoFile('src/docker/webui/toast.ts')
  const styles = readRepoFile('src/docker/webui/styles/base.css')
  const shellStyles = readRepoFile('src/docker/webui/styles/shell.css')
  const componentStyles = readRepoFile('src/docker/webui/styles/components.css')
  const tableStyles = readRepoFile('src/docker/webui/styles/tables.css')
  const responsiveStyles = readRepoFile('src/docker/webui/styles/responsive.css')
  const componentSurface = [
    appVue,
    appShell,
    sidebarNav,
    topToolbar,
    authShell,
    overviewPage,
    loginConfigPage,
    collectPage,
    yubaPage,
    keepalivePage,
    doublePage,
    expiringPage,
    logsPage,
    taskStatusCard,
    cronField,
    enableSwitch,
    actionBar,
    fansStatusTable,
    yubaStatusTable,
    allocationTable,
    expiringBackpackTable,
  ].join('\n')
  const webuiModuleFiles = collectRepoFiles('src/docker/webui')
    .filter(file => /\.(?:ts|vue)$/.test(file))
  const webuiModuleSource = webuiModuleFiles.map(readRepoFile).join('\n')
  const webuiWithoutBootstrap = webuiModuleSource.replace(/DOUYU_KEEP_WEBUI_BOOTSTRAP/g, '')

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
  assert.match(viteIndex, /DOUYU_KEEP_WEBUI_BOOTSTRAP/)
  assert.match(viteIndex, /__DOCKER_WEBUI_PAGE_ROUTES_JSON__/)
  assert.match(viteIndex, /src="\/main\.ts"/)
  assert.match(main, /createApp\(App\)\.mount\('#app'\)/)
  assert.doesNotMatch(main, /installLegacy|startLegacyApp|DOUYU_KEEP_WEBUI_|await import\('\.\.\/webui\/app|await import\('\.\/app/)
  assert.match(main, /import '\.\/styles\/base\.css'/)
  assert.match(main, /import '\.\/styles\/shell\.css'/)
  assert.match(main, /import '\.\/styles\/components\.css'/)
  assert.match(main, /import '\.\/styles\/tables\.css'/)
  assert.match(main, /import '\.\/styles\/responsive\.css'/)

  assert.match(appVue, /<script setup lang="ts">/)
  assert.match(appVue, /usePageNavigation\(bootstrap\.pageRoutes\)/)
  assert.match(appVue, /useAuthSession\(\{[\s\S]*clearProtectedState[\s\S]*loadProtectedData/)
  assert.match(appVue, /loadProtectedData\(activeTab\.value/)
  assert.doesNotMatch(appVue, /syncCookieCloudToLoginCookies/)
  assert.match(appVue, /watch\(\[authenticated, activeTab\]/)
  assert.match(appVue, /loadActiveTabData\(nextTab\)/)
  assert.match(appVue, /useOverviewPage\(activeTab\)/)
  assert.match(appVue, /useThemeMode\(\)/)
  assert.match(appVue, /useToastRegion\(\)/)
  assert.match(appVue, /<AuthShell[\s\S]*v-show="!authenticated"/)
  assert.match(appVue, /<AppShell[\s\S]*v-show="authenticated"/)
  assert.match(appVue, /id="toast-live"[\s\S]*role="status"[\s\S]*aria-live="polite"/)

  assert.match(appShell, /<SidebarNav/)
  assert.match(appShell, /<TopToolbar/)
  assert.match(logsPage, /useLogsPage\(toRef\(props, 'activeTab'\), toRef\(props, 'authenticated'\)\)/)
  assert.match(collectPage, /useCollectTaskPage\(\)/)
  assert.match(keepalivePage, /useKeepaliveTaskPage\(\)/)
  assert.match(expiringPage, /useExpiringGiftTaskPage\(\)/)
  assert.match(yubaPage, /useYubaTaskPage\(\)/)
  assert.match(loginConfigPage, /useCookieLoginPage\(\)/)
  assert.match(sidebarNav, /v-for="tab in tabs"/)
  assert.match(sidebarNav, /v-for="option in themeModes"/)
  assert.match(topToolbar, /emit\('refresh'\)/)
  assert.match(authShell, /role="alert"/)
  assert.match(overviewPage, /v-for="cell in overviewStatusCells"/)
  assert.match(overviewPage, /v-for="metric in overviewGiftMetrics"/)
  assert.match(fansStatusTable, /v-for="row in rows"/)
  assert.match(yubaStatusTable, /v-for="row in rows"/)
  assert.match(allocationTable, /@change="emit\('enabledChange'/)
  assert.match(expiringBackpackTable, /v-for="row in rows"/)
  assert.doesNotMatch(componentSurface, /data-action=|data-trigger=|id="app-shell" style="display:none"/)

  assert.match(appEvents, /WEBUI_APP_EVENTS/)
  assert.match(appEvents, /douyu-keep-webui:auth-state/)
  assert.match(appEvents, /douyu-keep-webui:toast/)
  assert.match(appEvents, /douyu-keep-webui:unauthorized/)
  assert.match(auth, /WEBUI_APP_EVENTS\.authState/)
  assert.match(request, /WEBUI_APP_EVENTS\.unauthorized/)
  assert.match(toast, /WEBUI_APP_EVENTS\.toast/)
  assert.match(navigation, /export function usePageNavigation/)
  assert.doesNotMatch(navigation, /data-action|WEBUI_BRIDGE_EVENTS/)
  assert.doesNotMatch(auth + request + toast, /WEBUI_BRIDGE_EVENTS|bridge-contract/)

  assert.match(resources, /export async function loadProtectedData/)
  assert.doesNotMatch(resources, /syncCookieCloud/)
  assert.match(resources, /export async function refreshOverviewSurface/)
  assert.match(resources, /from '\.\/resource-config'/)
  assert.match(resources, /from '\.\/resource-fans'/)
  assert.match(resources, /from '\.\/resource-yuba'/)
  assert.match(resources, /clearFansCookieBackedData\(\)/)
  assert.match(resources, /clearYubaCookieBackedData\(\)/)
  assert.doesNotMatch(resources, /export\s*\{[\s\S]*DEFAULT_RAW_CONFIG/)
  assert.match(resourceConfig, /createDefaultRawDockerConfig/)
  assert.doesNotMatch(resourceConfig, /DEFAULT_RAW_CONFIG/)
  assert.match(readRepoFile('src/core/medal-sync.ts'), /createDefaultDoubleCardConfig\(fans: Fans\[\]\): DoubleCardConfig \{[\s\S]*?active: false/)
  assert.match(theme, /from '\.\/resource-config'/)
  assert.match(cookie, /from '\.\/resource-config'/)
  assert.match(cookie, /from '\.\/resource-fans'/)
  assert.match(fansBackedTaskPage, /from '\.\/resource-config'/)
  assert.match(fansBackedTaskPage, /from '\.\/resource-fans'/)
  assert.match(fansBackedTaskPage, /from '\.\/resource-state'/)
  assert.match(keepalive, /from '\.\/fans-backed-task-page'/)
  assert.match(double, /from '\.\/fans-backed-task-page'/)
  assert.match(expiring, /from '\.\/fans-backed-task-page'/)
  assert.match(expiring, /from '\.\/resource-fans'/)
  assert.match(yuba, /from '\.\/resource-yuba'/)
  assert.match(resourceRequest, /export function createResourceRequest/)
  assert.match(resourceRequest, /pending:\s*null/)
  assert.match(resourceRequest, /fetchedAt:\s*0/)
  assert.match(resourceRequest, /requestSeq:\s*0/)
  assert.match(resourceRequest, /export function trackResourceRequest/)
  assert.match(resourceConfig, /\/api\/config\/raw/)
  assert.match(resources, /\/api\/overview/)
  assert.match(resources, /\/api\/logs/)
  assert.match(resourceFans, /export async function syncFans/)
  assert.match(resourceFans, /export async function loadFansList/)
  assert.match(resourceFans, /export async function loadFansStatus/)
  assert.match(resourceFans, /\/api\/fans\/reconcile/)
  assert.match(resourceFans, /\/api\/fans\/status\/base/)
  assert.match(resourceFans, /\/api\/fans\/status\/details/)
  assert.match(resourceYuba, /export async function loadYubaStatus/)
  assert.match(resourceYuba, /\/api\/yuba\/status/)
  assert.match(logsResource, /window\.setInterval/)
  assert.match(overview, /refreshOverviewSurface\(activeTab\.value, true\)/)
  assert.match(cookie, /refreshOverviewSurface\('overview', false\)/)
  assert.match(theme, /watch\(rawConfig/)
  assert.match(taskShared, /export async function saveTaskConfig/)
  assert.match(taskShared, /export async function disableTaskConfig/)
  assert.match(taskShared, /export async function triggerTask/)
  assert.match(taskShared, /SaveTaskConfigResult/)
  assert.match(taskPageActions, /export async function saveEnabledTask/)
  assert.match(taskPageActions, /export async function disableEnabledTask/)
  assert.match(taskPageActions, /export function toggleEnabledTask/)
  assert.match(taskPageActions, /export async function triggerFansBackedTask/)
  assert.match(taskPageActions, /applyManagedFansResponse\(result, \{ updateFans: isFansBackedTab\(activeTab\) \}\)/)
  assert.match(taskPageActions, /refreshOverviewSurface\(activeTab, false\)/)
  assert.match(taskPageActions, /loadFansStatus\(false\)/)
  assert.match(resourceFans, /export function applyManagedFansResponse/)
  assert.match(resourceFans, /config: getRawConfig\(\)/)
  assert.match(fansBackedTaskPage, /export function createFansBackedTaskPageState/)
  assert.match(fansBackedTaskPage, /watchResourceState/)
  assert.match(fansBackedTaskPage, /getManagedConfig\(\)/)
  assert.match(fansBackedTaskPage, /getManagedFans\(\)/)
  assert.match(cronPreview, /\/api\/cron-preview/)
  assert.match(readRepoFile('src/core/task-defaults.ts'), /DEFAULT_KEEPALIVE_CRON = '0 0 8 \*\/7 \* \*'/)

  assert.match(collect, /watch\(rawConfig/)
  assert.match(collect, /refreshTaskSurface\('collect'\)/)
  assert.match(collect, /toggleEnabledTask\(collectEnabled, saveCollectConfig, disableCollectConfig\)/)
  assert.match(collect, /triggerFansBackedTask\('collectGift'\)/)
  assert.match(keepalive, /createFansBackedTaskPageState<KeepaliveOverview, RawKeepaliveConfig, Fans>/)
  assert.match(keepalive, /taskPage\.watchResourceState\(applyResourceState\)/)
  assert.match(keepalive, /refreshTaskSurface\('keepalive'\)/)
  assert.match(keepalive, /toggleEnabledTask\(keepaliveEnabled, saveKeepaliveConfig, disableKeepaliveConfig\)/)
  assert.match(keepalive, /triggerFansBackedTask\('keepalive'\)/)
  assert.match(double, /createFansBackedTaskPageState<DoubleOverview, RawDoubleConfig, DoubleFan>/)
  assert.match(double, /taskPage\.watchResourceState\(applyResourceState\)/)
  assert.match(double, /refreshTaskSurface\('double-card'\)/)
  assert.match(double, /toggleEnabledTask\(doubleEnabled, saveDoubleConfig, disableDoubleConfig\)/)
  assert.match(double, /triggerFansBackedTask\('doubleCard', applyResourceState\)/)
  assert.match(expiring, /createFansBackedTaskPageState<ExpiringOverview, RawExpiringConfig, Fans>/)
  assert.match(expiring, /taskPage\.watchResourceState\(applyResourceState, \[[\s\S]*sharedGiftStatus/)
  assert.match(expiring, /refreshTaskSurface\('expiring-gift'\)/)
  assert.match(expiring, /toggleEnabledTask\(expiringEnabled, saveExpiringGiftConfig, disableExpiringGiftConfig\)/)
  assert.match(expiring, /triggerFansBackedTask\('expiringGift', applyResourceState\)/)
  assert.match(yuba, /watch\(\[sharedRawConfig, sharedOverview, sharedYubaStatus/)
  assert.match(yuba, /refreshOverviewSurface\('yuba', false\)/)

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
    'src/docker/webui/app.js',
    'src/docker/webui/app-actions.js',
    'src/docker/webui/app-pages.js',
    'src/docker/webui/app-task-pages.js',
  ]) {
    assert.equal(fs.existsSync(repoPath(deletedFile)), false, `${deletedFile} should stay deleted`)
  }

  assert.match(styles, /:root\{/)
  assert.match(shellStyles, /\.shell\{/)
  assert.match(componentStyles, /\.grid\{/)
  assert.match(tableStyles, /\.table-shell\{/)
  assert.match(responsiveStyles, /@media \(prefers-reduced-motion: reduce\)/)
})

test('Docker task scheduling uses shared task metadata for inventory facts', () => {
  // Refactorable shape guardrail: task inventory facts should stay centralized in
  // task-metadata even if scheduler and runner internals are later reorganized.
  const taskMetadata = readRepoFile('src/docker/task-metadata.ts')
  const scheduler = readRepoFile('src/docker/runtime-scheduler.ts')
  const runners = readRepoFile('src/docker/runtime-task-runners.ts')

  assert.match(taskMetadata, /export function getTaskConfig/)
  assert.match(taskMetadata, /export function getTaskCron/)
  assert.match(taskMetadata, /export function getTaskScheduleSummary/)
  assert.match(taskMetadata, /export function hasActiveTaskConfig/)
  assert.match(scheduler, /getTaskConfig\(config, type\)/)
  assert.match(scheduler, /getTaskCron\(taskConfig\)/)
  assert.match(scheduler, /getTaskScheduleSummary\(type, taskConfig\)/)
  assert.match(scheduler, /runRuntimeTask\(type, taskConfig, this\.createTaskRunnerDeps\(\)\)/)
  assert.match(runners, /export async function triggerRuntimeTask/)
  assert.match(runners, /export async function runRuntimeTask/)
  assert.match(runners, /const taskConfigResolvers/)
  assert.match(runners, /const runtimeTaskRunners/)
  assert.doesNotMatch(scheduler, /private startCollectGiftTask/)
  assert.doesNotMatch(scheduler, /private startKeepaliveTask/)
  assert.doesNotMatch(scheduler, /private startDoubleCardTask/)
  assert.doesNotMatch(scheduler, /private startExpiringGiftTask/)
  assert.doesNotMatch(scheduler, /private startYubaCheckInTask/)
})

test('Docker config mutation routes use shared JSON error helpers', () => {
  // Refactorable shape guardrail: mutation routes should keep validation before
  // persistence and share the JSON success/error envelope helpers.
  const configRoutes = readRepoFile('src/docker/server-config-routes.ts')
  const routeUtils = readRepoFile('src/docker/server-route-utils.ts')

  assert.match(routeUtils, /export async function sendJsonOk/)
  assert.match(configRoutes, /import \{ sendJsonOk \} from '\.\/server-route-utils'/)
  assert.match(configRoutes, /app\.post\('\/api\/cookie', async \(req, res\)/)
  assert.match(configRoutes, /app\.post\('\/api\/config', async \(req, res\)/)
  assert.match(configRoutes, /sendJsonOk\(\s*res,\s*\(\) => ctx\.saveCookie/)
  assert.match(configRoutes, /sendJsonOk\(\s*res,\s*async \(\) => [\s\S]*ctx\.saveTaskConfig/)
  assert.doesNotMatch(configRoutes, /\.then\(\(result\)/)
  assert.doesNotMatch(configRoutes, /\.catch\(\(e: unknown\)/)
})

test('CookieCloud sync-and-check persists first, then checks the local snapshot only', () => {
  // Behavioral boundary guardrail: sync may fetch CookieCloud, but diagnostics must
  // inspect only the local persisted snapshot.
  const cookieWebUi = readRepoFile('src/docker/webui/cookie.ts')
  const cookieSource = readRepoFile('src/docker/runtime-cookie-source.ts')
  const cookieRoutes = readRepoFile('src/docker/server-cookie-source-routes.ts')

  assert.match(cookieRoutes, /ctx\.inspectCookieSource\(\)/)
  assert.doesNotMatch(cookieRoutes, /ctx\.inspectCookieSource\(true\)/)
  assert.match(cookieSource, /mainCookie = cloudMainCookie \|\| mainCookie/)
  assert.match(cookieSource, /yubaCookie = cloudYubaCookie \|\| yubaCookie \|\| mainCookie/)
  assert.match(cookieSource, /getCookieCloudPassportCookie\(snapshot\.cookies\)\.trim\(\)/)
  assert.match(cookieSource, /manualPassport:\s*\{\s*cookie: manualPassportCookie\s*\}/)
  assert.match(cookieSource, /async inspectCookieSource\(\): Promise<CookieDiagnostics>/)
  const inspectStart = cookieSource.indexOf('async inspectCookieSource()')
  const inspectEnd = cookieSource.indexOf('private async loadCookieCloudSnapshot')
  assert.ok(inspectStart >= 0 && inspectEnd > inspectStart)
  assert.doesNotMatch(cookieSource.slice(inspectStart, inspectEnd), /loadCookieCloudSnapshot/)
  assert.match(cookieWebUi, /await syncCookieCloudToLoginCookies\(false, true\)[\s\S]*requestJson<CookieDiagnostics>\('\/api\/cookie-source\/check'/)
})

test('Docker runtime retries cookie-backed work once after centralized credential recovery', () => {
  // Forbidden-pattern guardrail: task runners must use the shared recovery hook and
  // must not grow direct safeAuth, LTP0, or passport-refresh branches.
  const runtime = readRepoFile('src/docker/runtime.ts')
  const scheduler = readRepoFile('src/docker/runtime-scheduler.ts')
  const runners = readRepoFile('src/docker/runtime-task-runners.ts')
  const recovery = readRepoFile('src/docker/runtime-cookie-recovery.ts')
  const cache = readRepoFile('src/docker/runtime-cache.ts')
  const errors = readRepoFile('src/docker/server-errors.ts')
  const fansRoutes = readRepoFile('src/docker/server-fans-routes.ts')
  const taskRoutes = readRepoFile('src/docker/server-task-routes.ts')
  const taskRunnerDirectSource = [
    readRepoFile('src/docker/runtime-task-runners.ts'),
    readRepoFile('src/core/job.ts'),
    readRepoFile('src/core/collect-gift.ts'),
    readRepoFile('src/core/gift-task.ts'),
    readRepoFile('src/core/double-card.ts'),
    readRepoFile('src/core/yuba-check-in.ts'),
    readRepoFile('src/core/yuba-status.ts'),
  ].join('\n')

  assert.match(errors, /export function isCookieCredentialMessage/)
  assert.match(errors, /message\.includes\('Cookie中没有找到'\)/)
  assert.match(errors, /message\.includes\('主站 Cookie 缺少'\)/)
  assert.match(runtime, /async function refreshCookieSourceAfterFailure/)
  assert.match(runtime, /isCookieCredentialMessage\(message\)/)
  assert.match(runtime, /cookieSource\.hasPassportRecoveryMaterial\(\)/)
  assert.match(runtime, /cookieSource\.recoverCredentialSnapshot\(\{[\s\S]*validateMainCookie/)
  assert.match(runtime, /await runtimeCache\.getFansList\(mainCookie\)/)
  assert.match(runtime, /async function runWithCookieSourceRetry/)
  assert.match(runtime, /const refreshed = await refreshCookieSourceAfterFailure\(error, context\)/)
  assert.match(runtime, /fetchFans: async \(\) => await runWithCookieSourceRetry/)
  assert.match(runtime, /fetchYubaStatus: async \(\) => await runWithCookieSourceRetry/)
  assert.match(runtime, /const shouldMergeLatestCookieSnapshot = Boolean\(baseConfig && cookieSnapshotEqual\(baseConfig, currentConfig\)\)/)
  assert.match(runtime, /const cookieConfig = shouldMergeLatestCookieSnapshot \? mergeLatestCookieSnapshot\(sourceConfig\) : sourceConfig/)
  assert.match(scheduler, /refreshCookieSourceAfterFailure: this\.refreshCookieSourceAfterFailure/)
  assert.match(runners, /refreshCookieSourceAfterFailure: \(error: unknown, context: string\) => Promise<boolean>/)
  assert.match(runners, /await runtimeTaskRunners\[type\]\(config, deps\)[\s\S]*catch \(error: unknown\)[\s\S]*await deps\.refreshCookieSourceAfterFailure\(error, getTaskLabel\(type\)\)[\s\S]*await runtimeTaskRunners\[type\]\(config, deps\)/)
  assert.match(readRepoFile('src/docker/runtime-cookie-source.ts'), /recoverCredentialSnapshotWithDeps/)
  assert.match(recovery, /export async function recoverCredentialSnapshot/)
  assert.match(recovery, /validateRecoveredMainCookie\(syncedCookie, deps\.validateMainCookie\)[\s\S]*await deps\.persistEffectiveCookies\(true\)[\s\S]*validateRecoveredMainCookie\(syncedCookie, deps\.validateMainCookie\)[\s\S]*refreshDouyuMainCookiesWithSafeAuth[\s\S]*validateRecoveredMainCookie\(safeAuthResult\.refreshedCookie, deps\.validateMainCookie\)/)
  assert.match(recovery, /getCurrentMainCookie/)
  assert.match(recovery, /getManualPassportCookie/)
  assert.match(readRepoFile('src/core/douyu-passport.ts'), /passport\.douyu\.com\/lapi\/passport\/iframe\/safeAuth/)
  assert.match(readRepoFile('src/core/cookie-cloud.ts'), /export function getCookieCloudPassportLtp0/)
  assert.doesNotMatch(taskRunnerDirectSource, /safeAuth|LTP0|ltp0|getCookieCloudPassportLtp0|refreshDouyuMainCookiesWithSafeAuth/)
  assert.match(cache, /if \(isCookieCredentialMessage\(message\)\) \{\s*throw error\s*\}/)
  assert.match(fansRoutes, /isCookieCredentialMessage/)
  assert.match(taskRoutes, /isCookieCredentialMessage/)
})

test('manual passport cookie stays masked outside raw config and is saved from login config UI', () => {
  // Cross-layer guardrail: manual passport material must share one config field,
  // stay editable in raw/login surfaces, and remain masked in public config paths.
  const types = readRepoFile('src/core/types.ts')
  const defaults = readRepoFile('src/core/task-defaults.ts')
  const configStore = readRepoFile('src/docker/config-store.ts')
  const configRoutes = readRepoFile('src/docker/server-config-routes.ts')
  const cookieWebUi = readRepoFile('src/docker/webui/cookie.ts')
  const loginConfigPage = readRepoFile('src/docker/webui/components/LoginConfigPage.vue')
  const taskStatusCard = readRepoFile('src/docker/webui/components/TaskStatusCard.vue')
  const configExample = JSON.parse(readRepoFile('config.example.json'))

  assert.match(types, /export interface ManualPassportConfig \{[\s\S]*cookie: string/)
  assert.match(types, /manualPassport\?: ManualPassportConfig/)
  assert.deepEqual(configExample.manualPassport, { cookie: 'dy_did=YOUR_DY_DID; LTP0=YOUR_PASSPORT_LTP0' })
  assert.match(defaults, /manualPassport:\s*\{\s*cookie: ''/)
  assert.match(configStore, /manualPassport\?: ManualPassportConfig/)
  assert.match(configStore, /updates\.manualPassport !== undefined/)

  assert.match(configRoutes, /function maskManualPassport/)
  assert.match(configRoutes, /function maskConfigManualPassport/)
  assert.match(configRoutes, /manualPassport: maskManualPassport\(config\.manualPassport\)/)
  assert.match(configRoutes, /app\.get\('\/api\/config\/raw'[\s\S]*res\.json\(\{ exists: true, data: config \}\)/)
  assert.match(configRoutes, /app\.post\('\/api\/config'[\s\S]*maskConfigManualPassport\(await ctx\.saveTaskConfig/)
  assert.match(configRoutes, /manualPassport: payload\.manualPassport/)

  assert.match(cookieWebUi, /const passportCookie = ref\(''\)/)
  assert.match(cookieWebUi, /passportCookie\.value = getManualPassportConfig\(config\)\.cookie/)
  assert.match(cookieWebUi, /const nextPassportCookie = passportCookie\.value\.trim\(\)/)
  assert.match(cookieWebUi, /manualCookies:\s*\{[\s\S]*main: mainCookie\.value\.trim\(\),[\s\S]*yuba: yubaCookie\.value\.trim\(\),[\s\S]*\},[\s\S]*manualPassport:\s*\{[\s\S]*cookie: nextPassportCookie/)
  assert.match(cookieWebUi, /manualPassport:\s*\{\s*cookie: nextPassportCookie/)
  assert.match(cookieWebUi, /applyManualPassportSaveResponse\(data\.data\.config, nextPassportCookie\)/)
  assert.doesNotMatch(cookieWebUi, /saveManualPassport/)
  assert.match(cookieWebUi, /passport Cookie', value: hasManualPassport\(config\) \? '已配置' : '未配置'/)
  assert.match(cookieWebUi, /服务器地址 \/ UUID \/ 密码/)
  assert.doesNotMatch(cookieWebUi, /ltp0[^'\n]*redacted-secret-value/)
  assert.match(loginConfigPage, /登录 Cookie[\s\S]*<div class="grid cols-3"[\s\S]*v-model="mainCookie"[\s\S]*v-model="yubaCookie"[\s\S]*v-model="passportCookie"/)
  assert.match(loginConfigPage, /<textarea[\s\S]*v-model="passportCookie"/)
  assert.match(loginConfigPage, /<label class="field-label" for="cookie-cloud-endpoint">服务器地址<\/label>/)
  assert.doesNotMatch(loginConfigPage, />Endpoint</)
  assert.doesNotMatch(loginConfigPage, /v-model="passportCookie"[\s\S]{0,160}type="password"/)
  assert.doesNotMatch(loginConfigPage, /手填 passport Cookie/)
  assert.doesNotMatch(loginConfigPage, /保存 passport Cookie/)
  assert.doesNotMatch(loginConfigPage, /@action="saveManualPassport"/)
  assert.match(taskStatusCard, /:class="\{ quad: cells\.length === 4 \}"/)
})
