<script setup lang="ts">
import AppShell from './components/AppShell.vue'
import AuthShell from './components/AuthShell.vue'
import { watch } from 'vue'
import { useAuthSession } from './auth'
import { usePageNavigation } from './navigation'
import { useOverviewPage } from './overview'
import { clearProtectedState, loadActiveTabData, loadProtectedData } from './resource-state'
import { useThemeMode } from './theme'
import { useToastRegion } from './toast'

interface WebUiBootstrap {
  appName: string
  appVersionLabel: string
  pageRoutes: Record<string, string>
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_BOOTSTRAP?: WebUiBootstrap
  }
}

const bootstrap: WebUiBootstrap = window.DOUYU_KEEP_WEBUI_BOOTSTRAP ?? {
  appName: 'douyu-keep',
  appVersionLabel: 'V0.0.0',
  pageRoutes: { overview: '/' },
}

const {
  activePageMeta,
  activeTab,
  handleTabKeydown,
  selectTab,
  tabs,
} = usePageNavigation(bootstrap.pageRoutes)

const {
  authenticated,
  loginError,
  logout,
  password,
  submitLogin,
  submittingLogin,
} = useAuthSession({
  clearProtectedState,
  loadProtectedData: () => loadProtectedData(activeTab.value),
})

const {
  savingThemeMode,
  selectThemeMode,
  themeMode,
  themeModes,
  themeNote,
} = useThemeMode()

const {
  toastLiveMessage,
  toastMessage,
  toastOk,
  toastVisible,
} = useToastRegion()

const overviewPage = useOverviewPage(activeTab)

watch([authenticated, activeTab], ([nextAuthenticated, nextTab]) => {
  if (nextAuthenticated) {
    void loadActiveTabData(nextTab)
  }
})
</script>

<template>
  <AuthShell
    v-show="!authenticated"
    v-model:password="password"
    :login-error="loginError"
    :submitting-login="submittingLogin"
    @submit="submitLogin"
  />

  <AppShell
    v-show="authenticated"
    :active-page-meta="activePageMeta"
    :active-tab="activeTab"
    :app-name="bootstrap.appName"
    :authenticated="authenticated"
    :handle-tab-keydown="handleTabKeydown"
    :overview-page="overviewPage"
    :saving-theme-mode="savingThemeMode"
    :select-tab="selectTab"
    :select-theme-mode="selectThemeMode"
    :tabs="tabs"
    :theme-mode="themeMode"
    :theme-modes="themeModes"
    :theme-note="themeNote"
    :version-label="bootstrap.appVersionLabel"
    @refresh-overview="overviewPage.refreshOverview"
    @logout="logout"
  />

  <div id="toast-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ toastLiveMessage }}
  </div>
  <div
    id="toast"
    class="toast"
    :aria-hidden="toastVisible ? 'false' : 'true'"
    :style="{
      background: toastOk ? '#15803d' : '#dc2626',
      display: toastVisible ? 'block' : 'none',
    }"
  >
    {{ toastMessage }}
  </div>
</template>
