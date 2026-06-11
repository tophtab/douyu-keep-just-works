import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, ManualCookieConfig, ManualPassportConfig, PassportQrLoginPublicStatus } from '../../core/types'
import { reactive, ref } from 'vue'
import { DEFAULT_COOKIE_CLOUD_SYNC_CRON } from '../../core/task-defaults'
import { useCronPreview } from './composables/use-cron-preview'
import { setRawConfig } from './resource-config'

export const mainCookie = ref('')
export const yubaCookie = ref('')
export const passportCookie = ref('')
export const cookieDiagnostics = ref<CookieDiagnostics | null>(null)
export const passportQrLogin = ref<PassportQrLoginPublicStatus | null>(null)
export const passportQrLoginBusy = ref(false)
export const cookieCloud = reactive({
  active: false,
  endpoint: '',
  uuid: '',
  cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  password: '',
})

const { cronPreviewText, ensureCronPreview, loadCronPreview } = useCronPreview(() => cookieCloud.cron)

export { cronPreviewText }
export const loadCookieCloudCronPreview = loadCronPreview

function getManualCookiesConfig(config: DockerConfig | null): ManualCookieConfig {
  return config?.manualCookies || {
    main: String(config?.cookie || ''),
    yuba: '',
  }
}

export function getCookieCloudConfig(config: DockerConfig | null): CookieCloudConfig {
  return config?.cookieCloud || {
    active: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  }
}

function getManualPassportConfig(config: DockerConfig | null): ManualPassportConfig {
  return config?.manualPassport || {
    cookie: '',
  }
}

export function hasManualPassport(config: DockerConfig | null): boolean {
  return Boolean(getManualPassportConfig(config).cookie.trim())
}

export function getCookieSourceLabel(config: DockerConfig | null): string {
  return getCookieCloudConfig(config).active ? 'CookieCloud' : '手填'
}

export function clearCookieDiagnostics(): void {
  cookieDiagnostics.value = null
}

export function applyRawConfig(config: DockerConfig | null): void {
  const manualCookies = getManualCookiesConfig(config)
  mainCookie.value = manualCookies.main || ''
  yubaCookie.value = manualCookies.yuba || ''
  passportCookie.value = getManualPassportConfig(config).cookie || ''

  const nextCookieCloud = getCookieCloudConfig(config)
  cookieCloud.active = nextCookieCloud.active === true
  cookieCloud.endpoint = nextCookieCloud.endpoint || ''
  cookieCloud.uuid = nextCookieCloud.uuid || ''
  cookieCloud.cron = nextCookieCloud.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON
  cookieCloud.password = nextCookieCloud.password || ''
  void ensureCronPreview()
}

export function applyManualPassportSaveResponse(config: DockerConfig, rawPassportCookie: string): void {
  const nextConfig = {
    ...config,
    manualPassport: rawPassportCookie ? { cookie: rawPassportCookie } : undefined,
  }
  setRawConfig(nextConfig)
  applyRawConfig(nextConfig)
}
