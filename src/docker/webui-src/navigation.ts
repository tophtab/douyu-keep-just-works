import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

export type WebUiPageTab
  = | 'overview'
    | 'login'
    | 'collect'
    | 'keepalive'
    | 'double-card'
    | 'expiring-gift'
    | 'yuba'
    | 'logs'

export interface WebUiPageMeta {
  key: WebUiPageTab
  label: string
  title: string
  subtitle: string
}

interface NavigationOptions {
  focus?: boolean
  replacePath?: boolean
  skipLazyLoad?: boolean
  syncPath?: boolean
}

interface LegacyNavigationDetail {
  tab: WebUiPageTab
  skipLazyLoad: boolean
}

type WebUiPageRoutes = Partial<Record<WebUiPageTab, string>>

const DEFAULT_PAGE_ROUTES: Record<WebUiPageTab, string> = {
  'overview': '/',
  'login': '/Configurations/LoginConfig',
  'collect': '/Configurations/CollectGiftConfig',
  'keepalive': '/Configurations/DailyJobConfig',
  'double-card': '/Configurations/DoubleCardConfig',
  'expiring-gift': '/Configurations/ExpiringGiftConfig',
  'yuba': '/Configurations/YubaCheckInConfig',
  'logs': '/Logs',
}

export const WEBUI_PAGE_TABS: WebUiPageMeta[] = [
  {
    key: 'overview',
    label: '概况',
    title: '概况',
    subtitle: '先看基础状态，再确认当前粉丝牌列表。',
  },
  {
    key: 'login',
    label: '登录',
    title: '登录',
    subtitle: '管理登录状态、手填 Cookie 和 CookieCloud 同步。',
  },
  {
    key: 'collect',
    label: '领取任务',
    title: '领取任务',
    subtitle: '查看领取任务状态，并维护领取任务的启停和调度。',
  },
  {
    key: 'keepalive',
    label: '保活任务',
    title: '保活任务',
    subtitle: '查看保活状态，并维护随粉丝牌同步的房间配置。',
  },
  {
    key: 'double-card',
    label: '双倍任务',
    title: '双倍任务',
    subtitle: '查看双倍状态，并维护参与勾选与分配值。',
  },
  {
    key: 'expiring-gift',
    label: '临期任务',
    title: '临期任务',
    subtitle: '在礼物接近过期时，只按临期候选数量释放背包礼物。',
  },
  {
    key: 'yuba',
    label: '鱼吧签到',
    title: '鱼吧签到',
    subtitle: '通过纯 HTTP 请求签到全部已关注鱼吧，并查看任务状态。',
  },
  {
    key: 'logs',
    label: '运行日志',
    title: '运行日志',
    subtitle: '查看系统、领取、鱼吧签到、保活、双倍和临期任务的执行记录。',
  },
]

const PAGE_META_BY_TAB = new Map<WebUiPageTab, WebUiPageMeta>(
  WEBUI_PAGE_TABS.map(tab => [tab.key, tab]),
)

function normalizePagePath(path: string): string {
  if (!path || path === '/') {
    return '/'
  }
  return path.replace(/\/+$/, '') || '/'
}

function isWebUiPageTab(value: string): value is WebUiPageTab {
  return PAGE_META_BY_TAB.has(value as WebUiPageTab)
}

function normalizeRoutes(routes: WebUiPageRoutes): Record<WebUiPageTab, string> {
  return WEBUI_PAGE_TABS.reduce<Record<WebUiPageTab, string>>((normalizedRoutes, tab) => {
    const route = routes[tab.key]
    normalizedRoutes[tab.key] = typeof route === 'string' && route
      ? normalizePagePath(route)
      : DEFAULT_PAGE_ROUTES[tab.key]
    return normalizedRoutes
  }, { ...DEFAULT_PAGE_ROUTES })
}

function dispatchLegacyNavigation(detail: LegacyNavigationDetail): void {
  document.dispatchEvent(new CustomEvent<LegacyNavigationDetail>('douyu-keep-webui:navigation', {
    detail,
  }))
}

function findTabActionTarget(target: EventTarget | null): HTMLElement | null {
  let current = target instanceof HTMLElement ? target : null
  while (current && current !== document.body) {
    if (current.getAttribute('data-action') === 'tab') {
      return current
    }
    current = current.parentElement
  }
  return null
}

export function usePageNavigation(pageRoutes: WebUiPageRoutes) {
  const routes = normalizeRoutes(pageRoutes)
  const activeTab = ref<WebUiPageTab>(getTabByPath(window.location.pathname))
  const activePageMeta = computed(() => PAGE_META_BY_TAB.get(activeTab.value) ?? WEBUI_PAGE_TABS[0])

  function getTabByPath(path: string): WebUiPageTab {
    const normalizedPath = normalizePagePath(path)
    const routeEntry = Object.entries(routes).find(([, route]) => route === normalizedPath)
    if (routeEntry && isWebUiPageTab(routeEntry[0])) {
      return routeEntry[0]
    }
    return 'overview'
  }

  function syncPathWithTab(tab: WebUiPageTab, replacePath: boolean): void {
    if (!window.history?.pushState || !window.history.replaceState) {
      return
    }

    const nextPath = routes[tab] || routes.overview
    const currentPath = normalizePagePath(window.location.pathname)
    if (currentPath === nextPath && window.location.pathname === nextPath) {
      return
    }

    try {
      if (replacePath) {
        window.history.replaceState(null, '', nextPath)
        return
      }
      window.history.pushState(null, '', nextPath)
    } catch {
      // Keep the current page usable if the browser rejects History API writes.
    }
  }

  function selectTab(tab: WebUiPageTab, options: NavigationOptions = {}): void {
    activeTab.value = PAGE_META_BY_TAB.has(tab) ? tab : 'overview'

    if (options.syncPath !== false) {
      syncPathWithTab(activeTab.value, Boolean(options.replacePath))
    }

    dispatchLegacyNavigation({
      tab: activeTab.value,
      skipLazyLoad: Boolean(options.skipLazyLoad),
    })

    if (options.focus) {
      void nextTick(() => {
        document.getElementById(`tab-${activeTab.value}`)?.focus()
      })
    }
  }

  function focusTabByOffset(offset: number): void {
    const currentIndex = WEBUI_PAGE_TABS.findIndex(tab => tab.key === activeTab.value)
    const nextIndex = (currentIndex + offset + WEBUI_PAGE_TABS.length) % WEBUI_PAGE_TABS.length
    selectTab(WEBUI_PAGE_TABS[nextIndex].key, { focus: true })
  }

  function focusTabByIndex(index: number): void {
    const nextTab = WEBUI_PAGE_TABS[index]
    if (nextTab) {
      selectTab(nextTab.key, { focus: true })
    }
  }

  function handleTabKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusTabByOffset(1)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusTabByOffset(-1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusTabByIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusTabByIndex(WEBUI_PAGE_TABS.length - 1)
    }
  }

  function syncTabWithCurrentPath(): void {
    selectTab(getTabByPath(window.location.pathname), {
      syncPath: false,
    })
  }

  function handleDocumentTabClick(event: MouseEvent): void {
    const target = findTabActionTarget(event.target)
    const tab = target?.getAttribute('data-tab') ?? ''
    if (!target || !isWebUiPageTab(tab)) {
      return
    }

    event.preventDefault()
    selectTab(tab)
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentTabClick)
    window.addEventListener('popstate', syncTabWithCurrentPath)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentTabClick)
    window.removeEventListener('popstate', syncTabWithCurrentPath)
  })

  return {
    activePageMeta,
    activeTab,
    handleTabKeydown,
    selectTab,
    tabs: WEBUI_PAGE_TABS,
  }
}
