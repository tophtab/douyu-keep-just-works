<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ThemeMode } from '../../../core/types'
import type { WebUiPageMeta, WebUiPageTab } from '../navigation'
import type { useOverviewPage } from '../overview'
import CollectPage from './CollectPage.vue'
import DoublePage from './DoublePage.vue'
import ExpiringPage from './ExpiringPage.vue'
import KeepalivePage from './KeepalivePage.vue'
import LoginConfigPage from './LoginConfigPage.vue'
import LogsPage from './LogsPage.vue'
import OverviewPage from './OverviewPage.vue'
import PushSettingsPage from './PushSettingsPage.vue'
import SecurityPage from './SecurityPage.vue'
import SidebarNav from './SidebarNav.vue'
import TopToolbar from './TopToolbar.vue'
import YubaPage from './YubaPage.vue'

defineProps<{
  activePageMeta: WebUiPageMeta
  activeTab: WebUiPageTab
  appName: string
  authenticated: boolean
  handleTabKeydown: (event: KeyboardEvent) => void
  overviewPage: ReturnType<typeof useOverviewPage>
  savingThemeMode: ThemeMode | null
  selectTab: (tab: WebUiPageTab) => void
  selectThemeMode: (mode: ThemeMode) => void
  tabs: WebUiPageMeta[]
  themeMode: ThemeMode
  themeModes: Array<{ mode: ThemeMode, label: string, title: string }>
  versionLabel: string
}>()

const emit = defineEmits<{
  logout: []
  refreshOverview: []
}>()

// 移动端抽屉导航：桌面端样式里 sidebar 常驻，drawerOpen 只影响窄屏
const drawerOpen = ref(false)

function closeDrawer(): void {
  drawerOpen.value = false
}

function toggleDrawer(): void {
  drawerOpen.value = !drawerOpen.value
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && drawerOpen.value) {
    closeDrawer()
  }
}

// 抽屉打开时锁滚动，关闭时恢复
watch(drawerOpen, (open) => {
  document.body.classList.toggle('drawer-locked', open)
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.classList.remove('drawer-locked')
})
</script>

<template>
  <div id="app-shell" class="shell">
    <div
      class="drawer-backdrop"
      :class="{ 'drawer-backdrop-visible': drawerOpen }"
      aria-hidden="true"
      @click="closeDrawer"
    />

    <SidebarNav
      :drawer-open="drawerOpen"
      :active-tab="activeTab"
      :app-name="appName"
      :handle-tab-keydown="handleTabKeydown"
      :saving-theme-mode="savingThemeMode"
      :select-tab="selectTab"
      :select-theme-mode="selectThemeMode"
      :tabs="tabs"
      :theme-mode="themeMode"
      :theme-modes="themeModes"
      :version-label="versionLabel"
      @close="closeDrawer"
    />

    <main class="main">
      <div class="mobile-bar">
        <button
          class="mobile-bar-btn"
          type="button"
          :aria-expanded="drawerOpen ? 'true' : 'false'"
          aria-controls="app-sidebar"
          aria-label="打开导航菜单"
          @click="toggleDrawer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </svg>
        </button>
        <div class="mobile-bar-title">
          <span class="mobile-bar-app">{{ appName }}</span>
          <span class="mobile-bar-page">{{ activePageMeta.title }}</span>
        </div>
        <button
          class="mobile-bar-btn"
          type="button"
          aria-label="刷新状态"
          :title="overviewPage.refreshOverviewTitle.value"
          :aria-busy="overviewPage.refreshLoading.value ? 'true' : 'false'"
          @click="emit('refreshOverview')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" class="mobile-bar-refresh" :class="{ spinning: overviewPage.refreshLoading.value }">
            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z" />
          </svg>
        </button>
        <button
          class="mobile-bar-btn"
          type="button"
          aria-label="退出登录"
          title="退出登录"
          @click="emit('logout')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" class="mobile-bar-logout">
            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4h2v4h14V5H5v4H3V5a2 2 0 0 1 2-2z" />
            <path d="M10.08 15.59 12.67 13H3v-2h9.67l-2.59-2.59L11.5 7l5 5-5 5z" />
          </svg>
        </button>
      </div>

      <div class="header">
        <div>
          <h2 id="page-title" class="page-title">
            {{ activePageMeta.title }}
          </h2>
          <p v-if="activePageMeta.subtitle" id="page-subtitle" class="page-subtitle">
            {{ activePageMeta.subtitle }}
          </p>
        </div>
        <TopToolbar
          :refresh-loading="overviewPage.refreshLoading.value"
          :refresh-overview-title="overviewPage.refreshOverviewTitle.value"
          @refresh="emit('refreshOverview')"
          @logout="emit('logout')"
        />
      </div>

      <section id="page-overview" class="page" :class="{ active: activeTab === 'overview' }" role="tabpanel" aria-labelledby="tab-overview" tabindex="0" :aria-hidden="activeTab === 'overview' ? 'false' : 'true'" :hidden="activeTab !== 'overview'">
        <OverviewPage :state="overviewPage" />
      </section>

      <section id="page-login" class="page" :class="{ active: activeTab === 'login' }" role="tabpanel" aria-labelledby="tab-login" tabindex="0" :aria-hidden="activeTab === 'login' ? 'false' : 'true'" :hidden="activeTab !== 'login'">
        <LoginConfigPage />
      </section>

      <section id="page-collect" class="page" :class="{ active: activeTab === 'collect' }" role="tabpanel" aria-labelledby="tab-collect" tabindex="0" :aria-hidden="activeTab === 'collect' ? 'false' : 'true'" :hidden="activeTab !== 'collect'">
        <CollectPage />
      </section>

      <section id="page-yuba" class="page" :class="{ active: activeTab === 'yuba' }" role="tabpanel" aria-labelledby="tab-yuba" tabindex="0" :aria-hidden="activeTab === 'yuba' ? 'false' : 'true'" :hidden="activeTab !== 'yuba'">
        <YubaPage />
      </section>

      <section id="page-keepalive" class="page" :class="{ active: activeTab === 'keepalive' }" role="tabpanel" aria-labelledby="tab-keepalive" tabindex="0" :aria-hidden="activeTab === 'keepalive' ? 'false' : 'true'" :hidden="activeTab !== 'keepalive'">
        <KeepalivePage />
      </section>

      <section id="page-double-card" class="page" :class="{ active: activeTab === 'double-card' }" role="tabpanel" aria-labelledby="tab-double-card" tabindex="0" :aria-hidden="activeTab === 'double-card' ? 'false' : 'true'" :hidden="activeTab !== 'double-card'">
        <DoublePage />
      </section>

      <section id="page-expiring-gift" class="page" :class="{ active: activeTab === 'expiring-gift' }" role="tabpanel" aria-labelledby="tab-expiring-gift" tabindex="0" :aria-hidden="activeTab === 'expiring-gift' ? 'false' : 'true'" :hidden="activeTab !== 'expiring-gift'">
        <ExpiringPage />
      </section>

      <section id="page-push" class="page" :class="{ active: activeTab === 'push' }" role="tabpanel" aria-labelledby="tab-push" tabindex="0" :aria-hidden="activeTab === 'push' ? 'false' : 'true'" :hidden="activeTab !== 'push'">
        <PushSettingsPage />
      </section>

      <section id="page-security" class="page" :class="{ active: activeTab === 'security' }" role="tabpanel" aria-labelledby="tab-security" tabindex="0" :aria-hidden="activeTab === 'security' ? 'false' : 'true'" :hidden="activeTab !== 'security'">
        <SecurityPage />
      </section>

      <section id="page-logs" class="page" :class="{ active: activeTab === 'logs' }" role="tabpanel" aria-labelledby="tab-logs" tabindex="0" :aria-hidden="activeTab === 'logs' ? 'false' : 'true'" :hidden="activeTab !== 'logs'">
        <LogsPage :active-tab="activeTab" :authenticated="authenticated" />
      </section>
    </main>
  </div>
</template>
