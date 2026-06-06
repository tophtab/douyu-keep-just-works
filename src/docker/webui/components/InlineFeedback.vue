<script setup lang="ts">
import type { AriaLiveMode } from '../ui-types'

withDefaults(defineProps<{
  ariaLive?: AriaLiveMode
  role?: 'alert' | 'note' | 'status'
  text?: string
}>(), {
  ariaLive: 'polite',
  role: 'status',
})
</script>

<template>
  <div class="status-box" :role="role" :aria-live="ariaLive">
    <slot>
      {{ text }}
    </slot>
  </div>
</template>
