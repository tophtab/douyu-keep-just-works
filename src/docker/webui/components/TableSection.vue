<script setup lang="ts">
defineProps<{
  emptyText: string
  showTable: boolean
}>()
</script>

<template>
  <div class="section-block">
    <div v-if="!showTable" class="empty">
      {{ emptyText }}
    </div>
    <div v-else class="table-shell">
      <slot />
    </div>
  </div>
</template>
