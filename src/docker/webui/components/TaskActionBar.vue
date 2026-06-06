<script setup lang="ts">
import ActionBar from './ActionBar.vue'

withDefaults(defineProps<{
  primaryLabel?: string
  secondaryLabel: string
}>(), {
  primaryLabel: '保存并启用',
})

const emit = defineEmits<{
  save: []
  trigger: []
}>()

function handleAction(index: number): void {
  if (index === 0) {
    emit('save')
    return
  }
  emit('trigger')
}
</script>

<template>
  <ActionBar
    class="section-actions"
    :actions="[
      { label: primaryLabel, kind: 'success' },
      { label: secondaryLabel, kind: 'secondary' },
    ]"
    @action="handleAction"
  />
</template>
