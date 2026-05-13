import type { Fans } from '../../core/types'
import type { WebUiPageTab } from './navigation'
import { getTaskTriggerEndpoint, isWebUiTaskType } from './task-shared'

interface LegacyActionState {
  activeTab: WebUiPageTab
}

interface LegacyActionDeps {
  applyFansStatusBase: (data: never) => void
  applyFansStatusDetails: (data: never) => void
  byId: (id: string) => HTMLElement | null
  clearCookieBackedData: () => void
  clearProtectedState: () => void
  defaultRawConfig: unknown
  getCookieCloudConfig: (config?: unknown) => unknown
  getManagedConfig: () => Record<string, unknown>
  getManagedFans: () => Fans[]
  getRawConfig: () => Record<string, unknown>
  getResourceRequest: (key: never) => unknown
  hasCookieSourceConfigured: (config?: unknown) => boolean
  invalidateResourceRequest: (key: never) => void
  invalidateResourceRequests: (keys: never[]) => void
  isUnauthorizedError: (error: unknown) => boolean
  markResourceLoaded: (key: never) => void
  renderAll: () => void
  renderCookieCheck: () => void
  renderDoublePage: () => void
  renderExpiringGiftPage: () => void
  renderKeepalivePage: () => void
  renderLoginPage: () => void
  renderLogsPage: () => void
  renderOverview: () => void
  renderYubaPage: () => void
  requestJson: <T = unknown>(url: string, options?: RequestInit) => Promise<T>
  setActiveTab: (tab: WebUiPageTab, options?: { replacePath?: boolean, syncPath?: boolean }) => void
  setManagedFans: (fans: Fans[]) => void
  state: LegacyActionState
  toast: (message: string, ok: boolean) => void
  trackResourceRequest: <T>(resource: never, requestSeq: number, pending: Promise<T>) => Promise<T>
}

interface LegacyActions {
  checkCookieSource: () => Promise<unknown>
  disableCookieCloud: () => Promise<unknown>
  loadFansList: (showToast?: boolean) => Promise<unknown>
  loadFansStatus: (showToast?: boolean) => Promise<unknown>
  loadLogs: () => Promise<void>
  loadOverview: () => Promise<void>
  loadProtectedData: () => Promise<void>
  loadRawConfig: () => Promise<void>
  loadYubaStatus: (showToast?: boolean) => Promise<unknown>
  refreshOverviewSurface: (showToast?: boolean) => Promise<unknown>
  saveAndEnableCookieCloud: () => Promise<unknown>
  saveCookie: () => Promise<unknown>
  saveCookieCloud: () => Promise<unknown>
  saveCookieCloudToggle: () => Promise<unknown>
  syncCookieCloudToLoginCookies: (showToast?: boolean, rethrowError?: boolean) => Promise<unknown>
  syncFans: (showToast?: boolean) => Promise<unknown>
  triggerTask: (type: string | null) => void
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_ACTIONS?: {
      create: (deps: LegacyActionDeps) => LegacyActions
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function requireBridge<T>(bridge: T | undefined, name: string): T {
  if (!bridge) {
    throw new Error(`${name} bridge is not installed`)
  }
  return bridge
}

function createActions(deps: LegacyActionDeps): LegacyActions {
  const resourceActions = requireBridge(window.DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS, 'resource actions').create({
    state: deps.state as never,
    toast: deps.toast,
    requestJson: deps.requestJson,
    isUnauthorizedError: deps.isUnauthorizedError,
    defaultRawConfig: deps.defaultRawConfig,
    getRawConfig: deps.getRawConfig,
    hasCookieSourceConfigured: deps.hasCookieSourceConfigured,
    setManagedFans: deps.setManagedFans,
    markResourceLoaded: deps.markResourceLoaded,
    invalidateResourceRequest: deps.invalidateResourceRequest,
    invalidateResourceRequests: deps.invalidateResourceRequests,
    getResourceRequest: deps.getResourceRequest,
    trackResourceRequest: deps.trackResourceRequest,
    applyFansStatusBase: deps.applyFansStatusBase,
    applyFansStatusDetails: deps.applyFansStatusDetails,
    clearCookieBackedData: deps.clearCookieBackedData,
    renderAll: deps.renderAll,
    renderOverview: deps.renderOverview,
    renderLogsPage: deps.renderLogsPage,
    renderExpiringGiftPage: deps.renderExpiringGiftPage,
    renderYubaPage: deps.renderYubaPage,
  } as never)

  const cookieActions = requireBridge(window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS, 'cookie actions').create({
    byId: deps.byId,
    state: deps.state,
    toast: deps.toast,
    requestJson: deps.requestJson,
    isUnauthorizedError: deps.isUnauthorizedError,
    getRawConfig: deps.getRawConfig,
    getCookieCloudConfig: deps.getCookieCloudConfig,
    clearCookieBackedData: deps.clearCookieBackedData,
    renderLoginPage: deps.renderLoginPage,
    renderCookieCheck: deps.renderCookieCheck,
    refreshOverviewSurface: resourceActions.refreshOverviewSurface,
  } as never)

  async function loadProtectedData(): Promise<void> {
    await Promise.all([
      resourceActions.loadRawConfig(),
      resourceActions.loadOverview(),
      resourceActions.loadLogs(),
    ])
    await cookieActions.syncCookieCloudToLoginCookies(false)

    const rawConfig = deps.getRawConfig()
    if (deps.hasCookieSourceConfigured(rawConfig)) {
      const reloads: Array<Promise<unknown>> = []
      if (deps.state.activeTab === 'overview' || deps.state.activeTab === 'expiring-gift') {
        reloads.push(resourceActions.loadFansStatus(false))
      }
      if (deps.state.activeTab === 'keepalive' || deps.state.activeTab === 'double-card') {
        reloads.push(resourceActions.loadFansList(false))
      }
      if (deps.state.activeTab === 'yuba') {
        reloads.push(resourceActions.loadYubaStatus(false))
      }
      if (reloads.length) {
        await Promise.all(reloads)
        deps.setActiveTab(deps.state.activeTab, { replacePath: true })
        return
      }
    }

    deps.renderAll()
    deps.setActiveTab(deps.state.activeTab, { replacePath: true })
  }

  function triggerTask(type: string | null): void {
    if (!isWebUiTaskType(type)) {
      return
    }

    deps.requestJson(getTaskTriggerEndpoint(type), {
      method: 'POST',
    }).then(() => {
      deps.toast('执行完成', true)
      const reloads: Array<Promise<unknown>> = [
        resourceActions.loadOverview(),
        resourceActions.loadLogs(),
      ]
      if (deps.state.activeTab === 'overview' || type === 'collectGift' || type === 'keepalive' || type === 'doubleCard' || type === 'expiringGift') {
        reloads.push(resourceActions.loadFansStatus(false))
      }
      if (deps.state.activeTab === 'yuba' || type === 'yubaCheckIn') {
        reloads.push(resourceActions.loadYubaStatus(false))
      }
      Promise.all(reloads).then(() => {
        if (deps.state.activeTab === 'keepalive') {
          deps.renderKeepalivePage()
        }
        if (deps.state.activeTab === 'double-card') {
          deps.renderDoublePage()
        }
        if (deps.state.activeTab === 'expiring-gift') {
          deps.renderExpiringGiftPage()
        }
      })
    }).catch((error: unknown) => {
      if (deps.isUnauthorizedError(error)) {
        return
      }
      deps.toast(`执行失败：${getErrorMessage(error)}`, false)
    })
  }

  return {
    syncCookieCloudToLoginCookies: cookieActions.syncCookieCloudToLoginCookies,
    loadProtectedData,
    loadRawConfig: resourceActions.loadRawConfig,
    loadOverview: resourceActions.loadOverview,
    loadLogs: resourceActions.loadLogs,
    syncFans: resourceActions.syncFans,
    loadFansList: resourceActions.loadFansList,
    loadFansStatus: resourceActions.loadFansStatus,
    loadYubaStatus: resourceActions.loadYubaStatus,
    refreshOverviewSurface: resourceActions.refreshOverviewSurface,
    saveCookie: cookieActions.saveCookie,
    saveCookieCloud: cookieActions.saveCookieCloud,
    checkCookieSource: cookieActions.checkCookieSource,
    saveCookieCloudToggle: cookieActions.saveCookieCloudToggle,
    saveAndEnableCookieCloud: cookieActions.saveAndEnableCookieCloud,
    disableCookieCloud: cookieActions.disableCookieCloud,
    triggerTask,
  }
}

export function installLegacyActionBridge(): void {
  window.DOUYU_KEEP_WEBUI_ACTIONS = {
    create: createActions,
  }
}
