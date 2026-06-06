<script setup lang="ts">
import type { ActionBarAction } from '../ui-types'

defineProps<{
  actions: ActionBarAction[]
}>()

const emit = defineEmits<{
  action: [id: string]
}>()
</script>

<template>
  <div class="actions">
    <button
      v-for="action in actions"
      :key="action.id"
      class="btn"
      :class="`btn-${action.kind || 'secondary'}`"
      type="button"
      :disabled="action.disabled || action.loading"
      :aria-busy="(action.ariaBusy || action.loading) ? 'true' : 'false'"
      :aria-label="action.ariaLabel"
      @click="emit('action', action.id)"
    >
      {{ action.loading && action.loadingLabel ? action.loadingLabel : action.label }}
    </button>
    <slot name="controls" />
  </div>
</template>
