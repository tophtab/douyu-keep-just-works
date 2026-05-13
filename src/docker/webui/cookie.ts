import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, ManualCookieConfig } from '../../core/types'
import { computed, reactive, ref, watch } from 'vue'
import { DEFAULT_COOKIE_CLOUD_SYNC_CRON } from '../../core/task-defaults'
import { useCronPreview } from './composables/use-cron-preview'
import { formatDate } from './datetime'
import { requestJson } from './request'
import { clearCookieBackedData, getManagedFans, overview, rawConfig, refreshOverviewSurface, setRawConfig } from './resource-state'
import { getErrorMessage, hasCookieSourceConfigured, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'

interface SaveCookieCloudOptions {
  forceEnable?: boolean
  forceDisable?: boolean
  quietSuccess?: boolean
  revertActiveTo?: boolean
}

const cookieCheck = ref<CookieDiagnostics | null>(null)
const mainCookie = ref('')
const yubaCookie = ref('')
const cookieCloud = reactive({
  active: false,
  endpoint: '',
  uuid: '',
  cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  password: '',
})
const { cronPreviewText, ensureCronPreview, loadCronPreview } = useCronPreview(() => cookieCloud.cron)

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
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  }
}

function getCookieSourceLabel(config: DockerConfig | null): string {
  return getCookieCloudConfig(config).active ? 'CookieCloud' : '手填'
}

function applyRawConfig(config: DockerConfig | null): void {
  const manualCookies = getManualCookiesConfig(config)
  mainCookie.value = manualCookies.main || ''
  yubaCookie.value = manualCookies.yuba || ''

  const nextCookieCloud = getCookieCloudConfig(config)
  cookieCloud.active = nextCookieCloud.active === true
  cookieCloud.endpoint = nextCookieCloud.endpoint || ''
  cookieCloud.uuid = nextCookieCloud.uuid || ''
  cookieCloud.cron = nextCookieCloud.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON
  cookieCloud.password = nextCookieCloud.password || ''
  void ensureCronPreview()
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

async function refreshOverviewAfterCookieChange(showSuccessToast: boolean): Promise<void> {
  await refreshOverviewSurface('overview', false)
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
      setRawConfig(data.data.config)
      applyRawConfig(data.data.config)
    }
    clearCookieBackedData()
    showToast('手填 Cookie 已保存', true)
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return
    }
    showToast(`保存手填 Cookie 失败：${getErrorMessage(error)}`, false)
  }
}

export async function syncCookieCloudToLoginCookies(showSuccessToast?: boolean, rethrowError?: boolean): Promise<unknown> {
  if (!getCookieCloudConfig(rawConfig.value).active) {
    return null
  }

  try {
    const data = await requestJson<{ data?: { config?: DockerConfig, updated?: boolean } }>('/api/cookie-source/persist', {
      method: 'POST',
    })
    if (data.data?.config) {
      setRawConfig(data.data.config)
      applyRawConfig(data.data.config)
    }
    if (data.data?.updated) {
      clearCookieBackedData()
    }
    if (showSuccessToast) {
      showToast(data.data?.updated ? 'CookieCloud 已同步到本地登录 Cookie' : '本地登录 Cookie 已是最新同步结果', true)
    }
    return data
  } catch (error) {
    if (isHttpUnauthorized(error)) {
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
    if (showSuccessToast !== false) {
      const readyForDyTokenYuba = data.mainCookieReady && data.yubaDyTokenReady
      showToast(readyForDyTokenYuba ? '登录凭证已同步，dy-token 鱼吧请求已就绪' : '登录凭证已同步并校验，请查看缺失项', readyForDyTokenYuba)
    }
    return data
  } catch (error) {
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    cookieCheck.value = null
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
    if (data.data?.config) {
      setRawConfig(data.data.config)
      applyRawConfig(data.data.config)
    }
    clearCookieBackedData()
    if (!options.quietSuccess) {
      showToast(shouldEnable ? 'CookieCloud 已保存并启用' : 'CookieCloud 配置已保存', true)
    }
    if (payload.cookieCloud.active) {
      await checkCookieSource(false)
    }
    await refreshOverviewAfterCookieChange(false)
  } catch (error) {
    if (options.revertActiveTo !== undefined) {
      cookieCloud.active = options.revertActiveTo
    }
    if (isHttpUnauthorized(error)) {
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
        { label: '粉丝牌', value: sourceReady ? `${getManagedFans().length} 个` : '未同步' },
        { label: '来源', value: getCookieSourceLabel(config) },
      ],
    }
  })

  function handleCookieCloudToggle(): void {
    if (cookieCloud.active) {
      void saveCookieCloudToggle({ revertCheckboxOnError: true })
      return
    }
    void disableCookieCloud()
  }

  watch(rawConfig, applyRawConfig, { immediate: true })

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
