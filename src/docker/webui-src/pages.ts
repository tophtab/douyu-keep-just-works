import type { CookieDiagnostics, Fans } from '../../core/types'
import type { WebUiPageTab } from './navigation'

interface LegacyPageState {
  activeTab: WebUiPageTab
  cookieCheck: CookieDiagnostics | null
  fansStatus: unknown[]
  fansStatusDetailsLoaded: boolean
  fansStatusDetailsLoading: boolean
  fansStatusLoaded: boolean
  fansStatusLoading: boolean
  giftStatus: unknown
  managedLoading: boolean
  overview: unknown
}

interface LegacyPageDeps {
  ensureFansListForActiveTab: () => void
  ensureYubaStatusForActiveTab: () => void
  getManagedConfig: () => Record<string, unknown>
  getManagedFans: () => Fans[]
  getRawConfig: () => unknown
  hasCookieSourceConfigured: (config?: unknown) => boolean
  hasLoadedFansList: () => boolean
  renderRefreshButton: () => void
  state: LegacyPageState
}

interface LegacyPageRenderers {
  renderActiveTabPage: () => void
  renderAll: () => void
  renderCollectPage: () => void
  renderCookieCheck: () => void
  renderDoublePage: () => void
  renderExpiringGiftPage: () => void
  renderKeepalivePage: () => void
  renderLoginPage: () => void
  renderLogsPage: () => void
  renderOverview: () => void
  renderYubaPage: () => void
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_PAGES?: {
      create: (deps: LegacyPageDeps) => LegacyPageRenderers
    }
  }
}

function dispatchPageState<T>(eventName: string, detail: T): void {
  document.dispatchEvent(new CustomEvent<T>(eventName, { detail }))
}

function createPageRenderers(deps: LegacyPageDeps): LegacyPageRenderers {
  const taskPageBridge = window.DOUYU_KEEP_WEBUI_TASK_PAGES
  if (!taskPageBridge) {
    throw new Error('task page bridge is not installed')
  }

  const taskPages = taskPageBridge.create({
    state: deps.state as never,
    getRawConfig: deps.getRawConfig,
    getManagedConfig: deps.getManagedConfig,
    getManagedFans: deps.getManagedFans,
    renderRefreshButton: deps.renderRefreshButton,
    hasLoadedFansList: deps.hasLoadedFansList,
    ensureFansListForActiveTab: deps.ensureFansListForActiveTab,
    ensureYubaStatusForActiveTab: deps.ensureYubaStatusForActiveTab,
  })

  function renderCookieCheck(): void {
    dispatchPageState('douyu-keep-webui:login-page', {
      cookieCheck: deps.state.cookieCheck,
    })
  }

  function renderOverview(): void {
    deps.renderRefreshButton()
    const rawConfig = deps.getRawConfig()
    dispatchPageState('douyu-keep-webui:overview-page', {
      fansStatus: deps.state.fansStatus,
      fansStatusDetailsLoaded: deps.state.fansStatusDetailsLoaded,
      fansStatusDetailsLoading: deps.state.fansStatusDetailsLoading,
      fansStatusLoaded: deps.state.fansStatusLoaded,
      fansStatusLoading: deps.state.fansStatusLoading,
      giftStatus: deps.state.giftStatus,
      hasCookieSourceConfigured: deps.hasCookieSourceConfigured(rawConfig),
      managedLoading: deps.state.managedLoading,
      overview: deps.state.overview,
    })
  }

  function renderLoginPage(): void {
    const rawConfig = deps.getRawConfig()
    const fansCount = deps.state.fansStatusLoaded ? deps.state.fansStatus.length : deps.getManagedFans().length
    dispatchPageState('douyu-keep-webui:login-page', {
      rawConfig,
      overview: deps.state.overview,
      fansCount,
      cookieCheck: deps.state.cookieCheck,
    })
  }

  function renderLogsPage(): void {
  }

  function renderAll(): void {
    renderOverview()
    renderLoginPage()
    taskPages.renderCollectPage()
    taskPages.renderYubaPage()
    taskPages.renderKeepalivePage()
    taskPages.renderDoublePage()
    taskPages.renderExpiringGiftPage()
    renderLogsPage()
  }

  function renderActiveTabPage(): void {
    if (deps.state.activeTab === 'overview') {
      renderOverview()
    } else if (deps.state.activeTab === 'login') {
      renderLoginPage()
    } else if (deps.state.activeTab === 'collect') {
      taskPages.renderCollectPage()
    } else if (deps.state.activeTab === 'yuba') {
      taskPages.renderYubaPage()
    } else if (deps.state.activeTab === 'keepalive') {
      taskPages.renderKeepalivePage()
    } else if (deps.state.activeTab === 'double-card') {
      taskPages.renderDoublePage()
    } else if (deps.state.activeTab === 'expiring-gift') {
      taskPages.renderExpiringGiftPage()
    } else if (deps.state.activeTab === 'logs') {
      renderLogsPage()
    }
  }

  return {
    renderCookieCheck,
    renderOverview,
    renderLoginPage,
    renderCollectPage: taskPages.renderCollectPage,
    renderYubaPage: taskPages.renderYubaPage,
    renderKeepalivePage: taskPages.renderKeepalivePage,
    renderDoublePage: taskPages.renderDoublePage,
    renderExpiringGiftPage: taskPages.renderExpiringGiftPage,
    renderLogsPage,
    renderAll,
    renderActiveTabPage,
  }
}

export function installLegacyPageBridge(): void {
  window.DOUYU_KEEP_WEBUI_PAGES = {
    create: createPageRenderers,
  }
}
