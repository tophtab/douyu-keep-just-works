interface LegacyEventState {
  activeTab: string
  auth: {
    authenticated: boolean
  }
}

interface LegacyEventDeps {
  handleVueNavigation: (event: Event) => void
  loadOverview: () => Promise<unknown>
  refreshOverviewSurface: (showToast?: boolean) => Promise<unknown>
  setActiveTab: (tab: string, options?: { skipLazyLoad?: boolean, syncPath?: boolean }) => void
  state: LegacyEventState
  triggerTask: (type: string | null) => void
}

interface LegacyEventBindings {
  start: () => void
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_EVENTS?: {
      create: (deps: LegacyEventDeps) => LegacyEventBindings
    }
  }
}

function findActionTarget(target: EventTarget | null): Element | null {
  let current = target instanceof Element ? target : target instanceof Node ? target.parentElement : null

  while (current && current !== document.body) {
    if (current.getAttribute('data-action')) {
      return current
    }
    current = current.parentElement
  }

  return null
}

function createEventBindings(deps: LegacyEventDeps): LegacyEventBindings {
  function handleActionClick(event: MouseEvent): void {
    const target = findActionTarget(event.target)
    if (!target) {
      return
    }

    const action = target.getAttribute('data-action')
    if (action === 'trigger') {
      deps.triggerTask(target.getAttribute('data-trigger'))
    }
  }

  function handleRefreshOverviewRequest(): void {
    void deps.refreshOverviewSurface(true)
  }

  function bindStaticEvents(): void {
    document.addEventListener('click', handleActionClick)
    document.addEventListener('douyu-keep-webui:navigation', deps.handleVueNavigation)
    document.addEventListener('douyu-keep-webui:refresh-overview-request', handleRefreshOverviewRequest)
  }

  function startAutoRefresh(): void {
    window.setInterval(() => {
      if (!deps.state.auth.authenticated) {
        return
      }
      if (deps.state.activeTab === 'overview') {
        void deps.loadOverview()
      }
    }, 5000)
  }

  function start(): void {
    bindStaticEvents()
    startAutoRefresh()

    deps.setActiveTab(deps.state.activeTab, { syncPath: false, skipLazyLoad: true })
  }

  return {
    start,
  }
}

export function installLegacyEventBridge(): void {
  window.DOUYU_KEEP_WEBUI_EVENTS = {
    create: createEventBindings,
  }
}
