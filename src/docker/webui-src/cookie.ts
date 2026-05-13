import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, ManualCookieConfig } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface LoginOverview {
  cookieSaved?: boolean
  ready?: boolean
}

interface LoginPageDetail {
  cookieCheck?: CookieDiagnostics | null
  fansCount?: number
  overview?: LoginOverview | null
  rawConfig?: DockerConfig | null
}

interface LegacyCookieDeps {
  state: {
    rawConfig: DockerConfig | null
    cookieCheck: CookieDiagnostics | null
  }
  clearCookieBackedData: () => void
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
  renderLoginPage: () => void
  renderCookieCheck: () => void
}

interface LegacyCookieActions {
  syncCookieCloudToLoginCookies: (showToast?: boolean, rethrowError?: boolean) => Promise<unknown>
  saveCookie: () => Promise<void>
  saveCookieCloud: (options?: SaveCookieCloudOptions) => Promise<void>
  checkCookieSource: (showToast?: boolean) => Promise<CookieDiagnostics | undefined>
  saveCookieCloudToggle: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
  saveAndEnableCookieCloud: () => Promise<void>
  disableCookieCloud: () => Promise<void>
}

interface SaveCookieCloudOptions {
  forceEnable?: boolean
  forceDisable?: boolean
  quietSuccess?: boolean
  revertActiveTo?: boolean
}

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

const DEFAULT_COOKIE_CLOUD_CRON = '0 5 0 * * *'
const LOGIN_PAGE_EVENT_NAME = 'douyu-keep-webui:login-page'

const rawConfig = ref<DockerConfig | null>(null)
const overview = ref<LoginOverview | null>(null)
const fansCount = ref(0)
const cookieCheck = ref<CookieDiagnostics | null>(null)
const mainCookie = ref('')
const yubaCookie = ref('')
const cookieCloud = reactive({
  active: false,
  endpoint: '',
  uuid: '',
  cron: DEFAULT_COOKIE_CLOUD_CRON,
  password: '',
})
const cronPreview = reactive<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyDeps: LegacyCookieDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_COOKIE_ACTIONS?: {
      create: (deps: LegacyCookieDeps) => LegacyCookieActions
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isUnauthorizedError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

function getManualCookiesConfig(config: DockerConfig | null): ManualCookieConfig {
  return config?.manualCookies || {
    main: String(config?.cookie || ''),
    yuba: '',
  }
}

function getCookieCloudConfig(config: DockerConfig | null): CookieCloudConfig {
  return config?.cookieCloud || {
    active: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_CRON,
    cryptoType: 'legacy',
  }
}

function hasCookieSourceConfigured(config: DockerConfig | null): boolean {
  const manualCookies = getManualCookiesConfig(config)
  const configCookieCloud = getCookieCloudConfig(config)
  return Boolean(
    manualCookies.main.trim()
    || manualCookies.yuba.trim()
    || (
      configCookieCloud.active
      && configCookieCloud.endpoint.trim()
      && configCookieCloud.uuid.trim()
      && configCookieCloud.password.trim()
    ),
  )
}

function getCookieSourceLabel(config: DockerConfig | null): string {
  return getCookieCloudConfig(config).active ? 'CookieCloud' : '手填'
}

function applyRawConfig(config: DockerConfig | null): void {
  rawConfig.value = config
  if (legacyDeps) {
    legacyDeps.state.rawConfig = config
  }

  const manualCookies = getManualCookiesConfig(config)
  mainCookie.value = manualCookies.main || ''
  yubaCookie.value = manualCookies.yuba || ''

  const nextCookieCloud = getCookieCloudConfig(config)
  cookieCloud.active = nextCookieCloud.active === true
  cookieCloud.endpoint = nextCookieCloud.endpoint || ''
  cookieCloud.uuid = nextCookieCloud.uuid || ''
  cookieCloud.cron = nextCookieCloud.cron || DEFAULT_COOKIE_CLOUD_CRON
  cookieCloud.password = nextCookieCloud.password || ''
  void ensureCronPreview()
}

function applyLoginPageDetail(detail: LoginPageDetail): void {
  if ('rawConfig' in detail) {
    applyRawConfig(detail.rawConfig || null)
  }
  if ('overview' in detail) {
    overview.value = detail.overview || null
  }
  if (typeof detail.fansCount === 'number') {
    fansCount.value = detail.fansCount
  }
  if ('cookieCheck' in detail) {
    cookieCheck.value = detail.cookieCheck || null
  }
}

function buildCookieCheckText(result: CookieDiagnostics | null): string {
  if (!result) {
    const configCookieCloud = getCookieCloudConfig(rawConfig.value)
    if (!configCookieCloud.active) {
      return '启用后会先从 CookieCloud 提取斗鱼主站和鱼吧相关 Cookie，并同步到上方两个本地登录 Cookie 输入框。运行时不会临时再拉 CookieCloud，而是直接使用这里保存的本地快照。'
    }
    if (!configCookieCloud.endpoint.trim() || !configCookieCloud.uuid.trim() || !configCookieCloud.password.trim()) {
      return 'CookieCloud 已启用，但 endpoint / UUID / 密码 还没填完整。'
    }
    return 'CookieCloud 已启用。系统会在启动时同步一次，并按这里配置的同步 Cron 自动刷新本地登录 Cookie。点击“同步并校验”会先同步 CookieCloud，再检查当前结果是否齐全。'
  }

  const sourceLabel = result.source === 'cookieCloud' ? 'CookieCloud' : '手填 Cookie'
  const mainText = result.mainCookieReady
    ? '主站请求就绪'
    : `主站缺少 ${(result.missingMainKeys || []).join(', ')}`
  const yubaText = result.yubaCookieReady
    ? '完整鱼吧 Cookie 就绪'
    : `完整鱼吧 Cookie 缺少 ${(result.missingYubaCookieKeys || result.missingYubaKeys || []).join(', ')}`
  const yubaDyTokenText = result.yubaDyTokenReady
    ? '鱼吧 dy-token 就绪'
    : `鱼吧 dy-token 缺少 ${(result.missingYubaDyTokenKeys || []).join(', ')}`
  const updateText = result.updateTime ? `，更新时间: ${formatDate(result.updateTime)}` : ''
  return `来源: ${sourceLabel}，Cookie 数: ${result.cookieCount || 0}${updateText}。${mainText}；${yubaDyTokenText}；${yubaText}。`
}

function setCronPreview(nextPreview: CronPreview): void {
  cronPreview.value = nextPreview.value
  cronPreview.runs = nextPreview.runs
  cronPreview.error = nextPreview.error
  cronPreview.loading = nextPreview.loading
}

async function loadCronPreview(): Promise<void> {
  const value = cookieCloud.cron.trim()
  cronPreviewSeq += 1
  const requestSeq = cronPreviewSeq

  if (!value) {
    setCronPreview({ value: '', runs: [], error: '', loading: false })
    return
  }

  setCronPreview({ value, runs: [], error: '', loading: true })
  try {
    const data = await requestJson<{ runs?: string[] }>(`/api/cron-preview?value=${encodeURIComponent(value)}`)
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    setCronPreview({ value, runs: data.runs || [], error: '', loading: false })
  } catch (error) {
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    setCronPreview({ value, runs: [], error: getErrorMessage(error), loading: false })
  }
}

function ensureCronPreview(): Promise<void> {
  const value = cookieCloud.cron.trim()
  if (cronPreview.value !== value || (!cronPreview.loading && !cronPreview.error && !cronPreview.runs.length)) {
    return loadCronPreview()
  }
  return Promise.resolve()
}

async function refreshOverviewAfterCookieChange(showSuccessToast: boolean): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
  if (showSuccessToast) {
    showToast('状态已刷新', true)
  }
}

async function saveCookie(): Promise<void> {
  try {
    const data = await requestJson<{ data?: { config?: DockerConfig } }>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manualCookies: {
          main: mainCookie.value.trim(),
          yuba: yubaCookie.value.trim(),
        },
      }),
    })
    if (data.data?.config) {
      applyRawConfig(data.data.config)
    }
    legacyDeps?.clearCookieBackedData()
    showToast('手填 Cookie 已保存', true)
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存手填 Cookie 失败：${getErrorMessage(error)}`, false)
  }
}

async function syncCookieCloudToLoginCookies(showSuccessToast?: boolean, rethrowError?: boolean): Promise<unknown> {
  if (!getCookieCloudConfig(rawConfig.value).active) {
    return null
  }

  try {
    const data = await requestJson<{ data?: { config?: DockerConfig, updated?: boolean } }>('/api/cookie-source/persist', {
      method: 'POST',
    })
    if (data.data?.config) {
      applyRawConfig(data.data.config)
    }
    if (data.data?.updated) {
      legacyDeps?.clearCookieBackedData()
    }
    legacyDeps?.renderLoginPage()
    if (showSuccessToast) {
      showToast(data.data?.updated ? 'CookieCloud 已同步到本地登录 Cookie' : '本地登录 Cookie 已是最新同步结果', true)
    }
    return data
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return undefined
    }
    if (showSuccessToast) {
      showToast(`同步 CookieCloud 到登录 Cookie 失败：${getErrorMessage(error)}`, false)
    }
    if (rethrowError) {
      throw error
    }
    return undefined
  }
}

async function checkCookieSource(showSuccessToast = true): Promise<CookieDiagnostics | undefined> {
  try {
    await syncCookieCloudToLoginCookies(false, true)
    const data = await requestJson<CookieDiagnostics>('/api/cookie-source/check', {
      method: 'POST',
    })
    cookieCheck.value = data
    if (legacyDeps) {
      legacyDeps.state.cookieCheck = data
    }
    legacyDeps?.renderCookieCheck()
    if (showSuccessToast !== false) {
      const readyForDyTokenYuba = data.mainCookieReady && data.yubaDyTokenReady
      showToast(readyForDyTokenYuba ? '登录凭证已同步，dy-token 鱼吧请求已就绪' : '登录凭证已同步并校验，请查看缺失项', readyForDyTokenYuba)
    }
    return data
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return undefined
    }
    cookieCheck.value = null
    if (legacyDeps) {
      legacyDeps.state.cookieCheck = null
    }
    legacyDeps?.renderCookieCheck()
    showToast(`同步并校验登录凭证失败：${getErrorMessage(error)}`, false)
    return undefined
  }
}

async function saveCookieCloud(options: SaveCookieCloudOptions = {}): Promise<void> {
  if (options.forceEnable) {
    cookieCloud.active = true
  }
  if (options.forceDisable) {
    cookieCloud.active = false
  }
  const shouldEnable = cookieCloud.active

  try {
    const payload = {
      cookieCloud: {
        active: shouldEnable,
        endpoint: cookieCloud.endpoint.trim(),
        uuid: cookieCloud.uuid.trim(),
        cron: cookieCloud.cron.trim(),
        password: cookieCloud.password.trim(),
        cryptoType: 'legacy',
      },
    }
    const data = await requestJson<{ data?: { config?: DockerConfig } }>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    cookieCheck.value = null
    if (legacyDeps) {
      legacyDeps.state.cookieCheck = null
    }
    if (data.data?.config) {
      applyRawConfig(data.data.config)
    }
    legacyDeps?.clearCookieBackedData()
    if (!options.quietSuccess) {
      showToast(shouldEnable ? 'CookieCloud 已保存并启用' : 'CookieCloud 配置已保存', true)
    }
    if (payload.cookieCloud.active) {
      await checkCookieSource(false)
    } else {
      legacyDeps?.renderLoginPage()
    }
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (options.revertActiveTo !== undefined) {
      cookieCloud.active = options.revertActiveTo
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`${shouldEnable ? '保存并启用 CookieCloud 失败：' : '保存 CookieCloud 失败：'}${getErrorMessage(error)}`, false)
  }
}

function saveCookieCloudToggle(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  return saveCookieCloud({
    revertActiveTo: options?.revertCheckboxOnError ? !cookieCloud.active : undefined,
    quietSuccess: true,
  })
}

function saveAndEnableCookieCloud(): Promise<void> {
  const previousActive = cookieCloud.active
  return saveCookieCloud({
    forceEnable: true,
    revertActiveTo: previousActive,
  })
}

function disableCookieCloud(): Promise<void> {
  return saveCookieCloud({
    forceDisable: true,
    revertActiveTo: true,
    quietSuccess: true,
  })
}

export function useCookieLoginPage() {
  const cookieCheckText = computed(() => buildCookieCheckText(cookieCheck.value))
  const cronPreviewText = computed(() => {
    if (!cronPreview.value) {
      return '填写 cron 后显示未来三次执行时间。'
    }
    if (cronPreview.loading) {
      return '正在计算未来执行时间…'
    }
    if (cronPreview.error) {
      return `cron 校验失败：${cronPreview.error}`
    }
    if (!cronPreview.runs.length) {
      return '暂未生成未来执行时间。'
    }
    return `未来三次：${cronPreview.runs.map(item => formatDate(item)).join(' / ')}`
  })
  const loginStatus = computed(() => {
    const config = rawConfig.value
    const sourceReady = hasCookieSourceConfigured(config)
    if (!overview.value) {
      return {
        pills: [{ label: '等待加载', kind: 'off' }],
        cells: [
          { label: '系统就绪', value: '-' },
          { label: '粉丝牌', value: '-' },
          { label: '来源', value: '-' },
        ],
      }
    }

    return {
      pills: [
        { label: overview.value.cookieSaved ? '已就绪' : '未配置', kind: overview.value.cookieSaved ? 'ok' : 'off' },
        { label: overview.value.ready ? '可运行' : '待配置', kind: overview.value.ready ? 'warn' : 'off' },
      ],
      cells: [
        { label: '系统就绪', value: overview.value.ready ? '已就绪' : '待配置' },
        { label: '粉丝牌', value: sourceReady ? `${fansCount.value} 个` : '未同步' },
        { label: '来源', value: getCookieSourceLabel(config) },
      ],
    }
  })

  function handleLoginPageEvent(event: Event): void {
    applyLoginPageDetail((event as CustomEvent<LoginPageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: DockerConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: LoginOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

  function handleCookieCloudToggle(): void {
    if (cookieCloud.active) {
      void saveCookieCloudToggle({ revertCheckboxOnError: true })
      return
    }
    void disableCookieCloud()
  }

  onMounted(() => {
    document.addEventListener(LOGIN_PAGE_EVENT_NAME, handleLoginPageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(LOGIN_PAGE_EVENT_NAME, handleLoginPageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
  })

  return {
    checkCookieSource,
    cookieCheckText,
    cookieCloud,
    cronPreviewText,
    handleCookieCloudToggle,
    loadCookieCloudCronPreview: loadCronPreview,
    loginStatus,
    mainCookie,
    saveAndEnableCookieCloud,
    saveCookie,
    yubaCookie,
  }
}

function createLegacyCookieActions(deps: LegacyCookieDeps): LegacyCookieActions {
  legacyDeps = deps
  if (deps.state.rawConfig) {
    applyRawConfig(deps.state.rawConfig)
  }
  if (deps.state.cookieCheck) {
    cookieCheck.value = deps.state.cookieCheck
  }

  return {
    syncCookieCloudToLoginCookies,
    saveCookie,
    saveCookieCloud,
    checkCookieSource,
    saveCookieCloudToggle,
    saveAndEnableCookieCloud,
    disableCookieCloud,
  }
}

export function dispatchLoginPageState(detail: LoginPageDetail): void {
  document.dispatchEvent(new CustomEvent(LOGIN_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyCookieActionBridge(): void {
  window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS = {
    create: createLegacyCookieActions,
  }
}
