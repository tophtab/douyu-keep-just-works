import type { CookieCloudConfig, CookieDiagnostics, DockerConfig, LoginCookiesConfig, PassportQrLoginPublicStatus } from '../../core/types'
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
  enabled: false,
  endpoint: '',
  uuid: '',
  cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  password: '',
})

const { cronPreviewText, ensureCronPreview, loadCronPreview } = useCronPreview(() => cookieCloud.cron)

export { cronPreviewText }
export const loadCookieCloudCronPreview = loadCronPreview

function getLoginCookiesConfig(config: DockerConfig | null): LoginCookiesConfig {
  return config?.loginCookies || { passport: '', main: '', yuba: '' }
}

export function getCookieCloudConfig(config: DockerConfig | null): CookieCloudConfig {
  return config?.cookieCloud || {
    enabled: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  }
}

export function hasLocalPassportCookie(config: DockerConfig | null): boolean {
  return Boolean(getLoginCookiesConfig(config).passport.trim())
}

export function getCookieSourceLabel(config: DockerConfig | null): string {
  return getCookieCloudConfig(config).enabled ? 'CookieCloud' : '本地'
}

export function clearCookieDiagnostics(): void {
  cookieDiagnostics.value = null
}

export function applyRawConfig(config: DockerConfig | null): void {
  const loginCookies = getLoginCookiesConfig(config)
  passportCookie.value = loginCookies.passport
  mainCookie.value = loginCookies.main
  yubaCookie.value = loginCookies.yuba

  const nextCookieCloud = getCookieCloudConfig(config)
  cookieCloud.enabled = nextCookieCloud.enabled
  cookieCloud.endpoint = nextCookieCloud.endpoint
  cookieCloud.uuid = nextCookieCloud.uuid
  cookieCloud.cron = nextCookieCloud.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON
  cookieCloud.password = nextCookieCloud.password
  void ensureCronPreview()
}

export function applyLoginCookieSaveResponse(config: DockerConfig): void {
  setRawConfig(config)
  applyRawConfig(config)
}
