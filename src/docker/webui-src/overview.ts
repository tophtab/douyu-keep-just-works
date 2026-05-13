import type { FanStatus, GiftStatus } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './datetime'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

interface OverviewResponse {
  collectGiftConfigured?: boolean
  cookieSaved?: boolean
  doubleCardConfigured?: boolean
  expiringGiftConfigured?: boolean
  keepaliveConfigured?: boolean
  ready?: boolean
  status?: Record<string, TaskRunStatus | undefined>
  yubaCheckInConfigured?: boolean
}

interface OverviewPageDetail {
  fansStatus?: FanStatus[]
  fansStatusDetailsLoaded?: boolean
  fansStatusDetailsLoading?: boolean
  fansStatusLoaded?: boolean
  fansStatusLoading?: boolean
  giftStatus?: GiftStatus | null
  hasCookieSourceConfigured?: boolean
  managedLoading?: boolean
  overview?: OverviewResponse | null
}

interface RefreshStateDetail {
  loading?: boolean
}

interface OverviewStatusCell {
  enabled: boolean
  enabledText: string
  disabledText: string
  label: string
}

interface OverviewGiftMetric {
  label: string
  value: string
}

interface OverviewFansRow {
  doubleLabel: string
  doubleKind: string
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
}

const overview = ref<OverviewResponse | null>(null)
const hasCookieSource = ref(false)
const managedLoading = ref(false)
const fansStatus = ref<FanStatus[]>([])
const fansStatusLoading = ref(false)
const fansStatusLoaded = ref(false)
const fansStatusDetailsLoading = ref(false)
const fansStatusDetailsLoaded = ref(false)
const giftStatus = ref<GiftStatus | null>(null)
const refreshLoading = ref(false)

function hasGiftStatusError(status: GiftStatus | null): status is GiftStatus & { error: string } {
  return Boolean(status?.error)
}

function normalizeFansStatus(value: unknown): FanStatus[] {
  return Array.isArray(value) ? value as FanStatus[] : []
}

function formatOverviewDate(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return formatDate(date.toISOString())
}

function applyOverviewDetail(detail: OverviewPageDetail): void {
  overview.value = detail.overview || null
  hasCookieSource.value = Boolean(detail.hasCookieSourceConfigured)
  managedLoading.value = Boolean(detail.managedLoading)
  fansStatus.value = normalizeFansStatus(detail.fansStatus)
  fansStatusLoading.value = Boolean(detail.fansStatusLoading)
  fansStatusLoaded.value = Boolean(detail.fansStatusLoaded)
  fansStatusDetailsLoading.value = Boolean(detail.fansStatusDetailsLoading)
  fansStatusDetailsLoaded.value = Boolean(detail.fansStatusDetailsLoaded)
  giftStatus.value = detail.giftStatus || null
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

export function useOverviewPage() {
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

  const overviewGiftMetrics = computed<OverviewGiftMetric[]>(() => {
    if (!overview.value) {
      return [
        { label: '当前荧光棒', value: '-' },
        { label: '过期时间', value: '-' },
      ]
    }

    if (!hasCookieSource.value) {
      return [
        { label: '当前荧光棒', value: '未配置' },
        { label: '过期时间', value: '未配置' },
      ]
    }

    if ((managedLoading.value || fansStatusLoading.value) && !fansStatusLoaded.value) {
      return [
        { label: '当前荧光棒', value: '同步中' },
        { label: '过期时间', value: '同步中' },
      ]
    }

    if (!fansStatusLoaded.value) {
      return [
        { label: '当前荧光棒', value: '待刷新' },
        { label: '过期时间', value: '待刷新' },
      ]
    }

    const detailsUpdating = fansStatusDetailsLoading.value && !fansStatusDetailsLoaded.value
    if (detailsUpdating && !giftStatus.value) {
      return [
        { label: '当前荧光棒', value: '检测中' },
        { label: '过期时间', value: '检测中' },
      ]
    }

    if (hasGiftStatusError(giftStatus.value)) {
      return [
        { label: '当前荧光棒', value: '未知' },
        { label: '过期时间', value: '未知' },
      ]
    }

    return [
      { label: '当前荧光棒', value: `${typeof giftStatus.value?.count === 'number' ? giftStatus.value.count : 0} 个` },
      { label: '过期时间', value: giftStatus.value?.expireTime ? formatOverviewDate(giftStatus.value.expireTime) : '无' },
    ]
  })

  const overviewFansNote = computed(() => {
    if (!overview.value) {
      return '正在加载粉丝牌状态…'
    }

    if (!hasCookieSource.value) {
      return '请先保存 Cookie 或启用 CookieCloud，概况页才会显示粉丝牌列表。'
    }

    if ((managedLoading.value || fansStatusLoading.value) && !fansStatusLoaded.value) {
      return '正在同步粉丝牌状态…'
    }

    if (!fansStatusLoaded.value) {
      return '点击顶部“刷新”可重新加载粉丝牌状态。'
    }

    if (!fansStatus.value.length) {
      return hasGiftStatusError(giftStatus.value)
        ? `当前没有可展示的粉丝牌数据。背包明细暂不可用：${giftStatus.value.error}`
        : '当前没有可展示的粉丝牌数据。'
    }

    const statusPrefix = managedLoading.value || fansStatusLoading.value ? '正在后台更新，当前显示上次结果。' : ''
    const detailText = fansStatusDetailsLoading.value && !fansStatusDetailsLoaded.value
      ? '背包与双倍状态正在补齐。'
      : '右侧已显示荧光棒库存与过期时间。'

    return statusPrefix + (hasGiftStatusError(giftStatus.value)
      ? `当前共 ${fansStatus.value.length} 个粉丝牌房间。背包明细暂不可用：${giftStatus.value.error}`
      : `当前共 ${fansStatus.value.length} 个粉丝牌房间，${detailText}`)
  })

  const overviewFansEmptyText = computed(() => {
    if (!overview.value) {
      return '请稍候…'
    }
    if ((managedLoading.value || fansStatusLoading.value) && !fansStatusLoaded.value) {
      return '请稍候，列表正在更新。'
    }
    if (!fansStatusLoaded.value) {
      return '尚未加载粉丝牌状态。'
    }
    return '当前没有可展示的粉丝牌数据。'
  })

  const showOverviewLoginAction = computed(() => Boolean(overview.value && !hasCookieSource.value))
  const showOverviewFansTable = computed(() => Boolean(
    overview.value
    && hasCookieSource.value
    && fansStatusLoaded.value
    && fansStatus.value.length,
  ))
  const overviewFansRows = computed<OverviewFansRow[]>(() => fansStatus.value.map((item, index) => ({
    index: index + 1,
    name: item.name || '未知主播',
    roomId: item.roomId,
    level: item.level ?? '-',
    rank: item.rank ?? '-',
    today: item.today ?? '-',
    intimacy: item.intimacy ?? '-',
    doubleLabel: typeof item.doubleActive === 'boolean'
      ? (item.doubleActive ? '双倍中' : '未开启')
      : '检测中',
    doubleKind: typeof item.doubleActive === 'boolean'
      ? (item.doubleActive ? 'ok' : 'off')
      : 'warn',
  })))
  const refreshOverviewTitle = computed(() => refreshLoading.value ? '正在刷新' : '刷新')

  function refreshOverview(): void {
    document.dispatchEvent(new CustomEvent('douyu-keep-webui:refresh-overview-request'))
  }

  function handleOverviewEvent(event: Event): void {
    applyOverviewDetail((event as CustomEvent<OverviewPageDetail>).detail || {})
  }

  function handleRefreshStateEvent(event: Event): void {
    const detail = (event as CustomEvent<RefreshStateDetail>).detail || {}
    refreshLoading.value = Boolean(detail.loading)
  }

  onMounted(() => {
    document.addEventListener('douyu-keep-webui:overview-page', handleOverviewEvent)
    document.addEventListener('douyu-keep-webui:refresh-state', handleRefreshStateEvent)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('douyu-keep-webui:overview-page', handleOverviewEvent)
    document.removeEventListener('douyu-keep-webui:refresh-state', handleRefreshStateEvent)
  })

  return {
    overviewFansEmptyText,
    overviewFansNote,
    overviewFansRows,
    overviewGiftMetrics,
    overviewStatusCells,
    refreshLoading,
    refreshOverview,
    refreshOverviewTitle,
    showOverviewFansTable,
    showOverviewLoginAction,
  }
}
