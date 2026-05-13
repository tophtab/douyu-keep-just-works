import type { FanStatus, Fans, GiftStatus, YubaGroupStatus } from '../../core/types'
import type { WebUiPageTab } from './navigation'

interface LegacyTaskPageState {
  activeTab: WebUiPageTab
  fansListError: string
  fansStatus: FanStatus[]
  fansStatusDetailsLoading: boolean
  fansStatusLoaded: boolean
  fansStatusLoading: boolean
  giftStatus: GiftStatus | null
  managedLoading: boolean
  overview: unknown
  yubaStatus: YubaGroupStatus[]
  yubaStatusError: string
  yubaStatusLoaded: boolean
  yubaStatusLoading: boolean
}

interface LegacyTaskPageDeps {
  ensureFansListForActiveTab: () => void
  ensureYubaStatusForActiveTab: () => void
  getManagedConfig: () => Record<string, unknown>
  getManagedFans: () => Fans[]
  getRawConfig: () => unknown
  hasLoadedFansList: () => boolean
  renderRefreshButton: () => void
  state: LegacyTaskPageState
}

interface LegacyTaskPageRenderers {
  renderCollectPage: () => void
  renderDoublePage: () => void
  renderExpiringGiftPage: () => void
  renderKeepalivePage: () => void
  renderYubaPage: () => void
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_TASK_PAGES?: {
      create: (deps: LegacyTaskPageDeps) => LegacyTaskPageRenderers
    }
  }
}

function dispatchPageState<T>(eventName: string, detail: T): void {
  document.dispatchEvent(new CustomEvent<T>(eventName, { detail }))
}

function createTaskPageRenderers(deps: LegacyTaskPageDeps): LegacyTaskPageRenderers {
  function renderCollectPage(): void {
    dispatchPageState('douyu-keep-webui:collect-page', {
      rawConfig: deps.getRawConfig(),
      overview: deps.state.overview,
    })
  }

  function renderYubaPage(): void {
    deps.renderRefreshButton()
    dispatchPageState('douyu-keep-webui:yuba-page', {
      rawConfig: deps.getRawConfig(),
      overview: deps.state.overview,
      yubaStatus: deps.state.yubaStatus,
      yubaStatusError: deps.state.yubaStatusError,
      yubaStatusLoaded: deps.state.yubaStatusLoaded,
      yubaStatusLoading: deps.state.yubaStatusLoading,
    })
    deps.ensureYubaStatusForActiveTab()
  }

  function renderKeepalivePage(): void {
    deps.renderRefreshButton()
    const rawConfig = deps.getRawConfig()
    dispatchPageState('douyu-keep-webui:keepalive-page', {
      rawConfig,
      managedConfig: deps.getManagedConfig(),
      overview: deps.state.overview,
      fans: deps.getManagedFans(),
      managedLoading: deps.state.managedLoading,
      fansListError: deps.state.fansListError,
      fansListLoaded: deps.hasLoadedFansList(),
    })
    deps.ensureFansListForActiveTab()
  }

  function renderDoublePage(): void {
    deps.renderRefreshButton()
    const rawConfig = deps.getRawConfig()
    dispatchPageState('douyu-keep-webui:double-page', {
      rawConfig,
      managedConfig: deps.getManagedConfig(),
      overview: deps.state.overview,
      fans: deps.getManagedFans(),
      managedLoading: deps.state.managedLoading,
      fansListError: deps.state.fansListError,
      fansListLoaded: deps.hasLoadedFansList(),
    })
    deps.ensureFansListForActiveTab()
  }

  function renderExpiringGiftPage(): void {
    deps.renderRefreshButton()
    const rawConfig = deps.getRawConfig()
    dispatchPageState('douyu-keep-webui:expiring-page', {
      rawConfig,
      managedConfig: deps.getManagedConfig(),
      overview: deps.state.overview,
      fans: deps.getManagedFans(),
      fansListError: deps.state.fansListError,
      fansListLoaded: deps.hasLoadedFansList(),
      fansStatusLoaded: deps.state.fansStatusLoaded,
      fansStatusLoading: deps.state.fansStatusLoading,
      fansStatusDetailsLoading: deps.state.fansStatusDetailsLoading,
      giftStatus: deps.state.giftStatus,
      managedLoading: deps.state.managedLoading,
    })
  }

  return {
    renderCollectPage,
    renderYubaPage,
    renderKeepalivePage,
    renderDoublePage,
    renderExpiringGiftPage,
  }
}

export function installLegacyTaskPageBridge(): void {
  window.DOUYU_KEEP_WEBUI_TASK_PAGES = {
    create: createTaskPageRenderers,
  }
}
