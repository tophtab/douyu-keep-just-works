<script setup lang="ts">
import type { ThemeMode } from '../../../core/types'
import type { WebUiPageMeta, WebUiPageTab } from '../navigation'

defineProps<{
  activeTab: WebUiPageTab
  appName: string
  handleTabKeydown: (event: KeyboardEvent) => void
  savingThemeMode: ThemeMode | null
  selectTab: (tab: WebUiPageTab) => void
  selectThemeMode: (mode: ThemeMode) => void
  tabs: WebUiPageMeta[]
  themeMode: ThemeMode
  themeModes: Array<{ mode: ThemeMode, label: string, title: string }>
  themeNote: string
  versionLabel: string
}>()

const PROJECT_URL = 'https://github.com/tophtab/douyu-keep-just-works'
</script>

<template>
  <aside class="sidebar">
    <div class="brand-row">
      <h1 class="brand-title">
        <a
          class="brand-link"
          :href="PROJECT_URL"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${appName} 项目地址`"
        >
          {{ appName }}
        </a>
      </h1>
      <span class="version-label">{{ versionLabel }}</span>
    </div>
    <p class="brand-copy">
      更聚焦的 Docker 管理台。先看概况，再分别管理登录、领取、保活、双倍、临期和鱼吧签到任务。
    </p>

    <div class="tab-list" role="tablist" aria-label="管理台页面" aria-orientation="vertical">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.key}`"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        type="button"
        role="tab"
        :data-tab="tab.key"
        :aria-selected="activeTab === tab.key ? 'true' : 'false'"
        :aria-controls="`page-${tab.key}`"
        :tabindex="activeTab === tab.key ? 0 : -1"
        @click="selectTab(tab.key)"
        @keydown="handleTabKeydown"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="theme-box">
      <div id="theme-mode-label" class="field-label">
        主题模式
      </div>
      <div class="theme-options" role="group" aria-labelledby="theme-mode-label">
        <button
          v-for="option in themeModes"
          :key="option.mode"
          class="theme-option"
          :class="{ active: themeMode === option.mode }"
          type="button"
          :data-theme-mode="option.mode"
          :aria-label="option.label"
          :aria-pressed="themeMode === option.mode ? 'true' : 'false'"
          :aria-busy="savingThemeMode === option.mode ? 'true' : 'false'"
          :title="option.title"
          @click="selectThemeMode(option.mode)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <template v-if="option.mode === 'light'">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </template>
            <template v-else-if="option.mode === 'dark'">
              <path d="M12 3a6 6 0 0 0 9 7.4A9 9 0 1 1 12 3Z" />
            </template>
            <template v-else>
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8" />
              <path d="M12 16v4" />
            </template>
          </svg>
        </button>
      </div>
      <div id="theme-note" class="theme-note">
        {{ themeNote }}
      </div>
    </div>
  </aside>
</template>
