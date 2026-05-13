import type { WebUiPageTab } from './navigation'
import {
  DEFAULT_COLLECT_GIFT_CRON,
  DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_DOUBLE_CARD_MODEL,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_MODEL,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_KEEPALIVE_CRON,
  DEFAULT_KEEPALIVE_MODEL,
  DEFAULT_THEME_MODE,
  DEFAULT_YUBA_CHECK_IN_CRON,
  DEFAULT_YUBA_CHECK_IN_MODE,
} from '../../core/task-defaults'
import { formatDate } from './datetime'
import { showToast } from './toast'
import { isWebUiPageTab, normalizePagePath, normalizePageRoutes, WEBUI_PAGE_TABS } from './navigation'

type RawConfigDefaults = Record<string, unknown>

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_DATA?: {
      DEFAULT_RAW_CONFIG: RawConfigDefaults
      PAGE_META: Record<WebUiPageTab, { subtitle: string, title: string }>
    }
    DOUYU_KEEP_WEBUI_DOM?: {
      byId: (id: string) => HTMLElement | null
      escapeHtml: (value: unknown) => string
      formatDate: (value: string | null) => string
      toast: (message: unknown, ok: unknown) => void
    }
    DOUYU_KEEP_WEBUI_ROUTING?: {
      consumeWebPasswordFromUrl: () => { password: string, present: boolean }
      getPathByTab: (tab: WebUiPageTab) => string
      getTabByPath: (path: string) => WebUiPageTab
      normalizePagePath: (path: string) => string
      syncPathWithTab: (tab: WebUiPageTab, replace: boolean) => void
    }
  }
}

export const LEGACY_DEFAULT_RAW_CONFIG: RawConfigDefaults = {
  cookie: '',
  manualCookies: {
    main: '',
    yuba: '',
  },
  cookieCloud: {
    active: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  },
  ui: { themeMode: DEFAULT_THEME_MODE },
  collectGift: { active: true, cron: DEFAULT_COLLECT_GIFT_CRON },
  yubaCheckIn: { active: false, cron: DEFAULT_YUBA_CHECK_IN_CRON, mode: DEFAULT_YUBA_CHECK_IN_MODE },
  keepalive: { active: true, cron: DEFAULT_KEEPALIVE_CRON, model: DEFAULT_KEEPALIVE_MODEL, send: {} },
  doubleCard: { active: true, cron: DEFAULT_DOUBLE_CARD_CRON, model: DEFAULT_DOUBLE_CARD_MODEL, giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE, send: {}, enabled: {} },
  expiringGift: { active: false, cron: DEFAULT_EXPIRING_GIFT_CRON, thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS, model: DEFAULT_EXPIRING_GIFT_MODEL, send: {} },
}

const LEGACY_PAGE_META = WEBUI_PAGE_TABS.reduce<Record<WebUiPageTab, { subtitle: string, title: string }>>((meta, tab) => {
  meta[tab.key] = {
    title: tab.title,
    subtitle: tab.subtitle,
  }
  return meta
}, {} as Record<WebUiPageTab, { subtitle: string, title: string }>)

function byId(id: string): HTMLElement | null {
  return document.getElementById(id)
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getRoutes(): Record<WebUiPageTab, string> {
  return normalizePageRoutes(window.DOUYU_KEEP_WEBUI_BOOTSTRAP?.pageRoutes ?? { overview: '/' })
}

function getTabByPath(path: string): WebUiPageTab {
  const normalizedPath = normalizePagePath(path)
  const routeEntry = Object.entries(getRoutes()).find(([, route]) => route === normalizedPath)
  if (routeEntry && isWebUiPageTab(routeEntry[0])) {
    return routeEntry[0]
  }
  return 'overview'
}

function getPathByTab(tab: WebUiPageTab): string {
  const routes = getRoutes()
  return routes[tab] || routes.overview
}

function syncPathWithTab(tab: WebUiPageTab, replace: boolean): void {
  if (!window.history?.pushState || !window.history.replaceState) {
    return
  }

  const nextPath = getPathByTab(tab)
  const currentPath = normalizePagePath(window.location.pathname)
  if (currentPath === nextPath && window.location.pathname === nextPath) {
    return
  }

  try {
    if (replace) {
      window.history.replaceState(null, '', nextPath)
      return
    }
    window.history.pushState(null, '', nextPath)
  } catch {
    // Keep the UI usable if the browser rejects History API writes.
  }
}

function consumeWebPasswordFromUrl(): { password: string, present: boolean } {
  const result = { password: '', present: false }
  if (!window.location?.search) {
    return result
  }

  try {
    const currentUrl = new URL(window.location.href)
    if (!currentUrl.searchParams.has('web-password')) {
      return result
    }

    result.present = true
    result.password = currentUrl.searchParams.get('web-password') || ''
    currentUrl.searchParams.delete('web-password')

    if (window.history?.replaceState) {
      window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash)
    }
  } catch {
    // Fall back to the normal login form if URL parsing fails.
  }

  return result
}

export function installLegacyCoreBridge(): void {
  window.DOUYU_KEEP_WEBUI_DATA = {
    PAGE_META: LEGACY_PAGE_META,
    DEFAULT_RAW_CONFIG: LEGACY_DEFAULT_RAW_CONFIG,
  }
  window.DOUYU_KEEP_WEBUI_ROUTING = {
    normalizePagePath,
    getTabByPath,
    getPathByTab,
    syncPathWithTab,
    consumeWebPasswordFromUrl,
  }
  window.DOUYU_KEEP_WEBUI_DOM = {
    byId,
    escapeHtml,
    formatDate,
    toast: (message: unknown, ok: unknown) => showToast(String(message), Boolean(ok)),
  }
}
