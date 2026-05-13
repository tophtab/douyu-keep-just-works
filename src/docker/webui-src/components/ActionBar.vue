<script setup lang="ts">
interface ActionButton {
  kind?: 'danger' | 'primary' | 'secondary' | 'success'
  label: string
}

defineProps<{
  actions: ActionButton[]
}>()

const emit = defineEmits<{
  action: [index: number]
}>()
</script>

<template>
  <div class="actions">
    <button
      v-for="(action, index) in actions"
      :key="action.label"
      class="btn"
      :class="`btn-${action.kind || 'secondary'}`"
      type="button"
      @click="emit('action', index)"
    >
      {{ action.label }}
    </button>
  </div>
</template>
