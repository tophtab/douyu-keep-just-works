<script setup lang="ts">
import EmptyState from './EmptyState.vue'

defineProps<{
  contentId?: string
  emptyText?: string
  show: boolean
}>()
</script>

<template>
  <div :id="contentId" class="section-block">
    <EmptyState v-if="!show" :text="emptyText">
      <slot name="empty" />
      <template v-if="$slots.emptyAction" #action>
        <slot name="emptyAction" />
      </template>
    </EmptyState>
    <div v-else class="table-shell">
      <slot />
    </div>
  </div>
</template>
