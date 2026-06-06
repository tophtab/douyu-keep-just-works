import type { FanStatus, GiftStatus } from '../../core/types'
import type { Ref } from 'vue'
import { computed } from 'vue'
import { buildBackpackDisplayRows, normalizeExpiringThresholdHours } from './backpack-display'
import type { FanDisplayRow } from './fan-display'
import { buildFanDisplayRows } from './fan-display'
import { fansStatus, fansStatusDetailsLoaded, fansStatusDetailsLoading, fansStatusError, fansStatusLoaded, fansStatusLoading, giftStatus, managedLoading } from './resource-fans'
import { getRawConfig, hasCookieSourceConfigured } from './resource-config'
import { isActiveRefreshLoading, overview, refreshOverviewSurface } from './resource-state'
import type { WebUiPageTab } from './navigation'
import type { WebUiOverview } from './resource-state'

interface OverviewStatusCell {
  enabled: boolean
  enabledText: string
  disabledText: string
  label: string
}

interface OverviewFansRow extends FanDisplayRow {
  doubleLabel: string
  doubleKind: string
}

function hasGiftStatusError(status: GiftStatus | null): status is GiftStatus & { error: string } {
  return Boolean(status?.error)
}

function buildOverviewStatusCell(
  label: string,
  enabled: unknown,
  enabledText = '已开启',
  disabledText = '未开启',
): OverviewStatusCell {
  return {
    label,
    enabled: Boolean(enabled),
    enabledText,
    disabledText,
  }
}

export function useOverviewPage(activeTab: Readonly<Ref<WebUiPageTab>>) {
  const hasCookieSource = computed(() => hasCookieSourceConfigured())
  const refreshLoading = computed(() => isActiveRefreshLoading(activeTab.value))

  const overviewStatusCells = computed(() => {
    if (!overview.value) {
      return [
        buildOverviewStatusCell('登录', false, '-', '-'),
        buildOverviewStatusCell('领取', false, '-', '-'),
        buildOverviewStatusCell('保活', false, '-', '-'),
        buildOverviewStatusCell('双倍', false, '-', '-'),
        buildOverviewStatusCell('临期', false, '-', '-'),
        buildOverviewStatusCell('鱼吧签到', false, '-', '-'),
      ]
    }

    return [
      buildOverviewStatusCell('登录', overview.value.cookieSaved, '已就绪', '未配置'),
      buildOverviewStatusCell('领取', overview.value.collectGiftConfigured),
      buildOverviewStatusCell('保活', overview.value.keepaliveConfigured),
      buildOverviewStatusCell('双倍', overview.value.doubleCardConfigured),
      buildOverviewStatusCell('临期', overview.value.expiringGiftConfigured),
      buildOverviewStatusCell('鱼吧签到', overview.value.yubaCheckInConfigured),
    ]
  })

  const overviewBackpackEmptyText = computed(() => {
    if (!overview.value) {
      return '请稍候…'
    }

    if (!hasCookieSource.value) {
      return '保存 Cookie 或启用 CookieCloud 后再点击顶部“刷新”，这里会展示背包礼物明细。'
    }

    if ((managedLoading.value || fansStatusLoading.value) && !fansStatusLoaded.value) {
      return '请稍候，背包明细正在更新。'
    }

    if (fansStatusError.value && !fansStatusLoaded.value) {
      return `加载背包明细失败：${fansStatusError.value}。请点击顶部“刷新”重试。`
    }

    if (!fansStatusLoaded.value) {
      return '尚未加载背包明细。点击顶部“刷新”后会展示可见礼物行。'
    }

    const detailsUpdating = fansStatusDetailsLoading.value && !fansStatusDetailsLoaded.value
    if (detailsUpdating && !giftStatus.value) {
      return '正在加载背包明细…'
    }

    if (hasGiftStatusError(giftStatus.value)) {
      return `背包明细暂不可用：${giftStatus.value.error}`
    }

    if (!(giftStatus.value?.rows || []).length) {
      return '当前背包没有可展示的礼物行。'
    }
    return ''
  })

  const overviewFansEmptyText = computed(() => {
    if (!overview.value) {
      return '请稍候…'
    }
    if (!hasCookieSource.value) {
      return '保存 Cookie 或启用 CookieCloud 后再点击顶部“刷新”，这里会直接展示粉丝牌与双倍状态。'
    }
    if ((managedLoading.value || fansStatusLoading.value) && !fansStatusLoaded.value) {
      return '请稍候，列表正在更新。'
    }
    if (fansStatusError.value && !fansStatusLoaded.value) {
      return `加载粉丝牌状态失败：${fansStatusError.value}。请点击顶部“刷新”重试。`
    }
    if (!fansStatusLoaded.value) {
      return '尚未加载粉丝牌状态。'
    }
    return '当前没有可展示的粉丝牌数据。'
  })

  const overviewFansFeedbackText = computed(() => {
    if (fansStatusError.value && fansStatusLoaded.value) {
      return `本次刷新失败：${fansStatusError.value}`
    }
    return ''
  })

  const overviewBackpackRows = computed(() => {
    const thresholdHours = normalizeExpiringThresholdHours(getRawConfig().expiringGift?.thresholdHours)
    return buildBackpackDisplayRows(giftStatus.value?.rows || [], thresholdHours)
  })

  const showOverviewBackpackTable = computed(() => Boolean(giftStatus.value && !giftStatus.value.error && overviewBackpackRows.value.length))
  const showOverviewFansTable = computed(() => Boolean(
    overview.value
    && hasCookieSource.value
    && fansStatusLoaded.value
    && fansStatus.value.length,
  ))
  const overviewFansRows = computed<OverviewFansRow[]>(() => buildFanDisplayRows(fansStatus.value, item => ({
    doubleLabel: typeof item.doubleActive === 'boolean'
      ? (item.doubleActive ? '双倍中' : '未开启')
      : '检测中',
    doubleKind: typeof item.doubleActive === 'boolean'
      ? (item.doubleActive ? 'ok' : 'off')
      : 'warn',
  })))
  const refreshOverviewTitle = computed(() => refreshLoading.value ? '正在刷新' : '刷新')

  function refreshOverview(): void {
    void refreshOverviewSurface(activeTab.value, true, true)
  }

  function getOverview(): WebUiOverview | null {
    return overview.value
  }

  function getFansStatus(): FanStatus[] {
    return fansStatus.value
  }

  function getGiftStatus(): GiftStatus | null {
    return giftStatus.value
  }

  function getManagedLoading(): boolean {
    return managedLoading.value
  }

  function getFansStatusLoading(): boolean {
    return fansStatusLoading.value
  }

  function getFansStatusLoaded(): boolean {
    return fansStatusLoaded.value
  }

  function getFansStatusDetailsLoading(): boolean {
    return fansStatusDetailsLoading.value
  }

  function getFansStatusDetailsLoaded(): boolean {
    return fansStatusDetailsLoaded.value
  }

  return {
    getFansStatus,
    getFansStatusDetailsLoaded,
    getFansStatusDetailsLoading,
    getFansStatusLoaded,
    getFansStatusLoading,
    getGiftStatus,
    getManagedLoading,
    getOverview,
    overviewBackpackEmptyText,
    overviewBackpackRows,
    overviewFansEmptyText,
    overviewFansFeedbackText,
    overviewFansRows,
    overviewStatusCells,
    refreshLoading,
    refreshOverview,
    refreshOverviewTitle,
    showOverviewBackpackTable,
    showOverviewFansTable,
  }
}
