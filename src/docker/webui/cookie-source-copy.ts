import type { CookieDiagnostics, PassportQrLoginPublicStatus } from '../../core/types'
import { cookieDiagnostics } from './cookie-source-state'
import { overview } from './resource-state'

export function buildPassportQrLoginText(status: PassportQrLoginPublicStatus | null): string {
  if (!status) {
    return '扫码登录未开始'
  }
  const retryText = status.canRetryYuba ? '，鱼吧可重试' : ''
  const errorText = status.error ? `：${status.error}` : ''
  return `${status.message}${retryText}${errorText}`
}

function formatCookieStatus(valid: boolean | undefined): string {
  return valid ? '有效' : '无效'
}

function buildCookieStatusCells(diagnostics: CookieDiagnostics | null) {
  return [
    { label: 'passport Cookie', value: formatCookieStatus(diagnostics?.passport.ltp0Present) },
    { label: '直播 Cookie', value: formatCookieStatus(diagnostics?.main.ready) },
    { label: '鱼吧 Cookie', value: formatCookieStatus(diagnostics?.yuba.cookieReady) },
  ]
}

export function buildLoginStatus() {
  const cells = buildCookieStatusCells(cookieDiagnostics.value)
  if (!overview.value) {
    return {
      pills: [{ label: '等待加载', kind: 'off' }],
      cells,
    }
  }

  return {
    pills: [
      { label: overview.value.cookieSaved ? '已就绪' : '未配置', kind: overview.value.cookieSaved ? 'ok' : 'off' },
      { label: overview.value.ready ? '可运行' : '待配置', kind: overview.value.ready ? 'warn' : 'off' },
    ],
    cells,
  }
}
