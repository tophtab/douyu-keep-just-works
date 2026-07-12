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
  versionLabel: string
}>()

const PROJECT_URL = 'https://github.com/tophtab/douyu-keep-just-works'
</script>

<template>
  <aside class="sidebar">
    <div class="brand-row">
      <img class="brand-logo" src="/icon.png" alt="" aria-hidden="true">
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
        <span class="version-label">{{ versionLabel }}</span>
      </h1>
    </div>
    <p class="brand-copy">
      <span>斗鱼荧光棒|续粉丝牌|检测双倍|鱼吧签到</span>
      <span class="brand-source">基于Curtion/douyu-keep vibe coding</span>
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
      <div class="theme-options" role="group" aria-label="主题模式">
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
    </div>
  </aside>
</template>
