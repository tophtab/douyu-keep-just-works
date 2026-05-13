import type { WebUiPageTab } from './navigation'
import { isWebUiPageTab } from './navigation'

interface LegacyBridge {
  clearProtectedState: () => void
  loadProtectedData: () => Promise<void>
}

interface LegacyNavigationDetail {
  skipLazyLoad?: boolean
  tab?: string
}

function requireBridge<T>(bridge: T | undefined, name: string): T {
  if (!bridge) {
    throw new Error(`${name} bridge is not installed`)
  }
  return bridge
}

function normalizeTab(tab: string | undefined): WebUiPageTab {
  return tab && isWebUiPageTab(tab) ? tab : 'overview'
}

function dispatchLegacyReady(bridge: LegacyBridge): void {
  window.DOUYU_KEEP_WEBUI_LEGACY = bridge
  document.dispatchEvent(new CustomEvent('douyu-keep-webui:legacy-ready'))
}

export function startLegacyApp(): void {
  const appData = requireBridge(window.DOUYU_KEEP_WEBUI_DATA, 'core data')
  const appRouting = requireBridge(window.DOUYU_KEEP_WEBUI_ROUTING, 'routing')
  const appDom = requireBridge(window.DOUYU_KEEP_WEBUI_DOM, 'DOM helpers')

  const stateHelpers = requireBridge(window.DOUYU_KEEP_WEBUI_STATE, 'state').create({
    defaultRawConfig: appData.DEFAULT_RAW_CONFIG,
    initialTab: appRouting.getTabByPath(window.location.pathname),
  })
  const {
    state,
    getRawConfig,
    getCookieCloudConfig,
    hasCookieSourceConfigured,
    isUnauthorizedError,
    getResourceRequest,
    hasLoadedFansList,
    markResourceLoaded,
    invalidateResourceRequest,
    invalidateResourceRequests,
    trackResourceRequest,
    isActiveRefreshLoading,
  } = stateHelpers

  function renderRefreshButton(): void {
    document.dispatchEvent(new CustomEvent('douyu-keep-webui:refresh-state', {
      detail: {
        loading: isActiveRefreshLoading(),
      },
    }))
  }

  const protectedState = requireBridge(window.DOUYU_KEEP_WEBUI_PROTECTED_STATE, 'protected state').create({
    state,
    invalidateResourceRequests,
    renderRefreshButton,
  })
  const { clearProtectedState, clearCookieBackedData } = protectedState

  const managedData = requireBridge(window.DOUYU_KEEP_WEBUI_MANAGED_DATA, 'managed data').create({
    state,
    getRawConfig,
  })
  const {
    getManagedConfig,
    getManagedFans,
    setManagedFans,
    applyFansStatusBase,
    applyFansStatusDetails,
  } = managedData

  const requestJson = requireBridge(window.DOUYU_KEEP_WEBUI_REQUEST, 'request').create({
    handleUnauthorized: () => {
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:unauthorized'))
    },
  }).requestJson

  let loadFansList: (showToast?: boolean) => Promise<unknown> = () => Promise.resolve()
  let loadFansStatus: (showToast?: boolean) => Promise<unknown> = () => Promise.resolve()
  let loadYubaStatus: (showToast?: boolean) => Promise<unknown> = () => Promise.resolve()
  let renderActiveTabPage: () => void = () => {}

  function shouldLoadFansListForActiveTab(): boolean {
    const activeNeedsFansList = state.activeTab === 'keepalive' || state.activeTab === 'double-card'
    const resource = getResourceRequest('fansList')
    return Boolean(
      activeNeedsFansList
      && hasCookieSourceConfigured(getRawConfig())
      && !getManagedFans().length
      && !hasLoadedFansList()
      && !state.fansListError
      && !state.managedLoading
      && !resource.pending,
    )
  }

  function ensureFansListForActiveTab(): void {
    if (shouldLoadFansListForActiveTab()) {
      void loadFansList(false)
    }
  }

  function shouldLoadYubaStatusForActiveTab(): boolean {
    const rawConfig = getRawConfig()
    const managedConfig = getManagedConfig() as Record<string, unknown>
    const rawRecord = rawConfig as Record<string, unknown>
    const config = (managedConfig.yubaCheckIn || rawRecord.yubaCheckIn || { mode: 'followed' }) as { mode?: unknown }
    const resource = getResourceRequest('yubaStatus')
    return Boolean(
      state.activeTab === 'yuba'
      && hasCookieSourceConfigured(rawConfig)
      && String(config.mode || 'followed') === 'followed'
      && !state.yubaStatusLoaded
      && !state.yubaStatusLoading
      && !state.yubaStatusError
      && !resource.pending,
    )
  }

  function ensureYubaStatusForActiveTab(): void {
    if (shouldLoadYubaStatusForActiveTab()) {
      void loadYubaStatus(false)
    }
  }

  function setActiveTab(tab: WebUiPageTab, options: { replacePath?: boolean, skipLazyLoad?: boolean, syncPath?: boolean } = {}): void {
    const nextTab = normalizeTab(tab)
    const shouldSyncPath = options.syncPath !== false
    const replacePath = Boolean(options.replacePath)
    const skipLazyLoad = Boolean(options.skipLazyLoad)

    state.activeTab = nextTab
    renderRefreshButton()

    if (shouldSyncPath) {
      appRouting.syncPathWithTab(nextTab, replacePath)
    }

    renderActiveTabPage()

    if (skipLazyLoad) {
      return
    }

    if (nextTab === 'overview' && hasCookieSourceConfigured(getRawConfig()) && !state.fansStatusLoaded) {
      void loadFansStatus(false)
    }
    if (nextTab === 'expiring-gift' && hasCookieSourceConfigured(getRawConfig()) && !state.fansStatusLoaded) {
      void loadFansStatus(false)
    }
    ensureFansListForActiveTab()
    ensureYubaStatusForActiveTab()
  }

  function handleVueAuthState(event: Event): void {
    const detail = event instanceof CustomEvent ? event.detail as { authenticated?: unknown } : {}
    state.auth.checked = true
    state.auth.authenticated = Boolean(detail.authenticated)
    state.auth.submitting = false
    if (state.auth.authenticated) {
      state.auth.error = ''
    }
  }

  function handleVueNavigation(event: Event): void {
    const detail = event instanceof CustomEvent ? event.detail as LegacyNavigationDetail : {}
    const nextTab = normalizeTab(detail.tab)
    if (!state.auth.authenticated) {
      state.activeTab = nextTab
      return
    }
    setActiveTab(nextTab, {
      syncPath: false,
      skipLazyLoad: Boolean(detail.skipLazyLoad),
    })
  }

  document.addEventListener('douyu-keep-webui:auth-state', handleVueAuthState)
  state.auth.checked = true
  state.auth.authenticated = document.body.getAttribute('data-auth') === 'app'

  const pageRenderers = requireBridge(window.DOUYU_KEEP_WEBUI_PAGES, 'pages').create({
    state,
    getRawConfig,
    hasCookieSourceConfigured,
    getManagedConfig: getManagedConfig as () => Record<string, unknown>,
    getManagedFans,
    renderRefreshButton,
    hasLoadedFansList,
    ensureFansListForActiveTab,
    ensureYubaStatusForActiveTab,
  })
  const {
    renderCookieCheck,
    renderOverview,
    renderLoginPage,
    renderKeepalivePage,
    renderDoublePage,
    renderExpiringGiftPage,
    renderYubaPage,
    renderLogsPage,
    renderAll,
  } = pageRenderers
  renderActiveTabPage = pageRenderers.renderActiveTabPage

  const actions = requireBridge(window.DOUYU_KEEP_WEBUI_ACTIONS, 'actions').create({
    byId: appDom.byId,
    state,
    toast: appDom.toast,
    requestJson,
    defaultRawConfig: appData.DEFAULT_RAW_CONFIG,
    isUnauthorizedError,
    getRawConfig: getRawConfig as () => Record<string, unknown>,
    getCookieCloudConfig,
    hasCookieSourceConfigured,
    getManagedConfig: getManagedConfig as () => Record<string, unknown>,
    getManagedFans,
    setManagedFans,
    markResourceLoaded,
    invalidateResourceRequest,
    invalidateResourceRequests,
    getResourceRequest,
    trackResourceRequest,
    clearCookieBackedData,
    clearProtectedState,
    applyFansStatusBase,
    applyFansStatusDetails,
    renderAll,
    renderLoginPage,
    renderCookieCheck,
    renderOverview,
    renderLogsPage,
    renderKeepalivePage,
    renderDoublePage,
    renderExpiringGiftPage,
    renderYubaPage,
    setActiveTab,
  })

  loadFansList = actions.loadFansList
  loadFansStatus = actions.loadFansStatus
  loadYubaStatus = actions.loadYubaStatus

  requireBridge(window.DOUYU_KEEP_WEBUI_TASK_ACTIONS, 'task actions').create({
    byId: appDom.byId,
    toast: appDom.toast,
    requestJson,
    isUnauthorizedError,
    getRawConfig: getRawConfig as () => Record<string, unknown>,
    getManagedConfig: getManagedConfig as () => Record<string, unknown>,
    getManagedFans,
    refreshOverviewSurface: actions.refreshOverviewSurface,
    loadOverview: actions.loadOverview,
    loadLogs: actions.loadLogs,
    loadFansStatus: actions.loadFansStatus,
  })

  requireBridge(window.DOUYU_KEEP_WEBUI_EVENTS, 'events').create({
    state,
    setActiveTab: (tab, options) => {
      setActiveTab(normalizeTab(tab), options)
    },
    handleVueNavigation,
    refreshOverviewSurface: actions.refreshOverviewSurface,
    loadOverview: actions.loadOverview,
    triggerTask: actions.triggerTask,
  }).start()

  dispatchLegacyReady({
    clearProtectedState,
    loadProtectedData: actions.loadProtectedData,
  })
}
