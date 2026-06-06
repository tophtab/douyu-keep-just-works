import type { PassportQrLoginPublicStatus } from '../../core/types'
import { rawConfig } from './resource-config'
import { getManagedFans } from './resource-fans'
import { overview } from './resource-state'
import { hasCookieSourceConfigured } from './task-shared'
import { getCookieSourceLabel, hasManualPassport } from './cookie-source-state'

export function buildPassportQrLoginText(status: PassportQrLoginPublicStatus | null): string {
  if (!status) {
    return '扫码登录未开始'
  }
  const retryText = status.canRetryYuba ? '，鱼吧可重试' : ''
  const errorText = status.error ? `：${status.error}` : ''
  return `${status.message}${retryText}${errorText}`
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
