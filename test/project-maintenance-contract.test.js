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

test('Docker WebUI is Vue-only and served as Vite static Docker assets', () => {
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
  assert.match(appVue, /syncCookieCloudToLoginCookies\(false\)/)
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
  assert.match(resources, /export async function refreshOverviewSurface/)
  assert.match(resources, /from '\.\/resource-config'/)
  assert.match(resources, /from '\.\/resource-fans'/)
  assert.match(resources, /from '\.\/resource-yuba'/)
  assert.match(resources, /clearFansCookieBackedData\(\)/)
  assert.match(resources, /clearYubaCookieBackedData\(\)/)
  assert.doesNotMatch(resources, /export\s*\{[\s\S]*DEFAULT_RAW_CONFIG/)
  assert.match(theme, /from '\.\/resource-config'/)
  assert.match(cookie, /from '\.\/resource-config'/)
  assert.match(cookie, /from '\.\/resource-fans'/)
  assert.match(keepalive, /from '\.\/resource-fans'/)
  assert.match(double, /from '\.\/resource-fans'/)
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
  assert.match(taskPageActions, /export async function saveEnabledTask/)
  assert.match(taskPageActions, /export async function disableEnabledTask/)
  assert.match(taskPageActions, /export function toggleEnabledTask/)
  assert.match(taskPageActions, /export async function triggerFansBackedTask/)
  assert.match(taskPageActions, /refreshOverviewSurface\(activeTab, false\)/)
  assert.match(taskPageActions, /loadFansStatus\(false\)/)
  assert.match(cronPreview, /\/api\/cron-preview/)

  assert.match(collect, /watch\(rawConfig/)
  assert.match(collect, /refreshTaskSurface\('collect'\)/)
  assert.match(collect, /toggleEnabledTask\(collectEnabled, saveCollectConfig, disableCollectConfig\)/)
  assert.match(collect, /triggerFansBackedTask\('collectGift'\)/)
  assert.match(keepalive, /watch\(\[sharedRawConfig, managed, sharedFansStatus, sharedOverview/)
  assert.match(keepalive, /refreshTaskSurface\('keepalive'\)/)
  assert.match(keepalive, /toggleEnabledTask\(keepaliveEnabled, saveKeepaliveConfig, disableKeepaliveConfig\)/)
  assert.match(keepalive, /triggerFansBackedTask\('keepalive'\)/)
  assert.match(double, /watch\(\[sharedRawConfig, managed, sharedFansStatus, sharedOverview/)
  assert.match(double, /refreshTaskSurface\('double-card'\)/)
  assert.match(double, /toggleEnabledTask\(doubleEnabled, saveDoubleConfig, disableDoubleConfig\)/)
  assert.match(double, /triggerFansBackedTask\('doubleCard', applyResourceState\)/)
  assert.match(expiring, /watch\(\[[\s\S]*sharedGiftStatus/)
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
