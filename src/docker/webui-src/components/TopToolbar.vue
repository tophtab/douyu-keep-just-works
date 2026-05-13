<script setup lang="ts">
defineProps<{
  refreshLoading: boolean
  refreshOverviewTitle: string
}>()

const emit = defineEmits<{
  logout: []
  refresh: []
}>()
</script>

<template>
  <div class="toolbar">
    <button
      class="btn btn-secondary toolbar-icon-btn"
      type="button"
      aria-label="刷新"
      :title="refreshOverviewTitle"
      :disabled="refreshLoading"
      :aria-busy="refreshLoading ? 'true' : 'false'"
      @click="emit('refresh')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z" />
      </svg>
    </button>
    <button class="btn btn-secondary toolbar-icon-btn toolbar-icon-btn-wide" type="button" aria-label="退出登录" title="退出登录" @click="emit('logout')">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4h2v4h14V5H5v4H3V5a2 2 0 0 1 2-2z" />
        <path d="M10.08 15.59 12.67 13H3v-2h9.67l-2.59-2.59L11.5 7l5 5-5 5z" />
      </svg>
    </button>
  </div>
</template>
