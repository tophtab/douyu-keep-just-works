<script setup lang="ts">
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
  themeNote: string
  versionLabel: string
}>()

const emit = defineEmits<{
  logout: []
  refreshOverview: []
}>()
</script>

<template>
  <div id="app-shell" class="shell">
    <SidebarNav
      :active-tab="activeTab"
      :app-name="appName"
      :handle-tab-keydown="handleTabKeydown"
      :saving-theme-mode="savingThemeMode"
      :select-tab="selectTab"
      :select-theme-mode="selectThemeMode"
      :tabs="tabs"
      :theme-mode="themeMode"
      :theme-modes="themeModes"
      :theme-note="themeNote"
      :version-label="versionLabel"
    />

    <main class="main">
      <div class="header">
        <div>
          <h2 id="page-title" class="page-title">
            {{ activePageMeta.title }}
          </h2>
          <p id="page-subtitle" class="page-subtitle">
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
        <OverviewPage :state="overviewPage" :select-tab="selectTab" />
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

      <section id="page-logs" class="page" :class="{ active: activeTab === 'logs' }" role="tabpanel" aria-labelledby="tab-logs" tabindex="0" :aria-hidden="activeTab === 'logs' ? 'false' : 'true'" :hidden="activeTab !== 'logs'">
        <LogsPage :active-tab="activeTab" :authenticated="authenticated" />
      </section>
    </main>
  </div>
</template>
