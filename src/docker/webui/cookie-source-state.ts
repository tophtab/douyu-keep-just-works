import type { CookieDiagnostics, DockerConfig, LoginCookiesConfig, PassportQrLoginPublicStatus } from '../../core/types'
import { ref } from 'vue'
import { setRawConfig } from './resource-config'

export const mainCookie = ref('')
export const yubaCookie = ref('')
export const passportCookie = ref('')
export const cookieDiagnostics = ref<CookieDiagnostics | null>(null)
export const passportQrLogin = ref<PassportQrLoginPublicStatus | null>(null)
export const passportQrLoginBusy = ref(false)

function getLoginCookiesConfig(config: DockerConfig | null): LoginCookiesConfig {
  return config?.loginCookies || { passport: '', main: '', yuba: '' }
}

export function hasLocalPassportCookie(config: DockerConfig | null): boolean {
  return Boolean(getLoginCookiesConfig(config).passport.trim())
}

export function clearCookieDiagnostics(): void {
  cookieDiagnostics.value = null
}

export function applyRawConfig(config: DockerConfig | null): void {
  const loginCookies = getLoginCookiesConfig(config)
  passportCookie.value = loginCookies.passport
  mainCookie.value = loginCookies.main
  yubaCookie.value = loginCookies.yuba
}

export function applyLoginCookieSaveResponse(config: DockerConfig): void {
  setRawConfig(config)
  applyRawConfig(config)
}
