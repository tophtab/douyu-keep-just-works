import type { ThemeMode } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { WEBUI_BRIDGE_EVENTS } from './bridge-contract'
import { requestJson } from './request'

type ResolvedThemeMode = 'light' | 'dark'

interface ThemeConfigDetail {
  themeMode?: unknown
}

const CONFIG_EVENT_NAME = WEBUI_BRIDGE_EVENTS.config
const THEME_COLOR_BY_MODE: Record<ResolvedThemeMode, string> = {
  dark: '#000000',
  light: '#f4ede4',
}

export const WEBUI_THEME_MODES: Array<{ mode: ThemeMode, label: string, title: string }> = [
  { mode: 'light', label: '浅色模式', title: '浅色模式' },
  { mode: 'dark', label: '深色模式', title: '深色模式' },
  { mode: 'system', label: '自动模式', title: '自动模式' },
]

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function getSystemPrefersDark(): boolean {
  if (!window.matchMedia) {
    return true
  }

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

function setThemeMeta(resolvedTheme: ResolvedThemeMode): void {
  const themeColor = document.getElementById('theme-color-meta')
  const colorScheme = document.getElementById('color-scheme-meta')

  themeColor?.setAttribute('content', THEME_COLOR_BY_MODE[resolvedTheme])
  colorScheme?.setAttribute('content', resolvedTheme)
}

export function useThemeMode() {
  const themeMode = ref<ThemeMode>('system')
  const savingThemeMode = ref<ThemeMode | null>(null)
  const systemPrefersDark = ref(getSystemPrefersDark())

  const resolvedTheme = computed<ResolvedThemeMode>(() => {
    if (themeMode.value === 'system') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }
    return themeMode.value
  })

  const themeNote = computed(() => {
    if (themeMode.value === 'system') {
      return `当前跟随系统，系统为 ${systemPrefersDark.value ? '深色' : '浅色'}`
    }
    return `当前固定为 ${themeMode.value === 'dark' ? '深色' : '浅色'} 模式`
  })

  function applyResolvedTheme(): void {
    document.body.setAttribute('data-theme', resolvedTheme.value)
    setThemeMeta(resolvedTheme.value)
  }

  function applyThemeMode(nextThemeMode: unknown): void {
    themeMode.value = isThemeMode(nextThemeMode) ? nextThemeMode : 'system'
  }

  async function selectThemeMode(nextThemeMode: ThemeMode): Promise<void> {
    if (!isThemeMode(nextThemeMode) || savingThemeMode.value) {
      return
    }

    const previousThemeMode = themeMode.value
    themeMode.value = nextThemeMode
    savingThemeMode.value = nextThemeMode

    try {
      await requestJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui: { themeMode: nextThemeMode } }),
        errorToast: message => `保存主题失败：${message}`,
      })
    } catch {
      themeMode.value = previousThemeMode
    } finally {
      savingThemeMode.value = null
    }
  }

  function handleConfigEvent(event: Event): void {
    const detail = event instanceof CustomEvent ? event.detail as ThemeConfigDetail : {}
    applyThemeMode(detail?.themeMode)
  }

  function handleSystemThemeChange(event?: MediaQueryListEvent): void {
    systemPrefersDark.value = typeof event?.matches === 'boolean'
      ? event.matches
      : getSystemPrefersDark()
  }

  let mediaQuery: MediaQueryList | null = null

  watch(resolvedTheme, applyResolvedTheme, { immediate: true })

  onMounted(() => {
    document.addEventListener(CONFIG_EVENT_NAME, handleConfigEvent)

    try {
      mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    } catch {
      mediaQuery = null
    }

    if (mediaQuery) {
      systemPrefersDark.value = mediaQuery.matches
      mediaQuery.addEventListener('change', handleSystemThemeChange)
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener(CONFIG_EVENT_NAME, handleConfigEvent)
    mediaQuery?.removeEventListener('change', handleSystemThemeChange)
  })

  return {
    savingThemeMode,
    selectThemeMode,
    themeMode,
    themeModes: WEBUI_THEME_MODES,
    themeNote,
  }
}
