import type { CookieDiagnostics } from '../../core/types'
import { formatDate } from './datetime'
import { rawConfig } from './resource-config'
import { getManagedFans } from './resource-fans'
import { overview } from './resource-state'
import { hasCookieSourceConfigured } from './task-shared'
import { getCookieCloudConfig, getCookieSourceLabel, hasManualPassport } from './cookie-source-state'

export function buildCookieCheckText(result: CookieDiagnostics | null): string {
  if (!result) {
    const configCookieCloud = getCookieCloudConfig(rawConfig.value)
    if (!configCookieCloud.active) {
      return `手填 passport Cookie ${hasManualPassport(rawConfig.value) ? '已配置' : '未配置'}。启用 CookieCloud 后会先从浏览器同步斗鱼相关 Cookie；手填模式会在主站 Cookie 失效后使用已保存的 LTP0 和 dy_did 恢复。`
    }
    if (!configCookieCloud.endpoint.trim() || !configCookieCloud.uuid.trim() || !configCookieCloud.password.trim()) {
      return 'CookieCloud 已启用，但服务器地址 / UUID / 密码 还没填完整。'
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
  const passportText = result.passportLtp0Present === undefined
    ? ''
    : ` passport Cookie ${result.passportLtp0Present ? '已配置' : '未配置'}。`
  return `来源: ${sourceLabel}${updateText}。${mainText}；${yubaDyTokenText}；${yubaText}。${passportText}`
}

export function buildLoginStatus() {
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
      { label: 'passport Cookie', value: hasManualPassport(config) ? '已配置' : '未配置' },
    ],
  }
}
