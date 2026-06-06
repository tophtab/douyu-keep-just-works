<script setup lang="ts">
import TableSection from './TableSection.vue'

defineProps<{
  emptyText: string
  showTable: boolean
}>()
</script>

<template>
  <TableSection :show-table="showTable" :empty-text="emptyText">
    <slot />
  </TableSection>
</template>
