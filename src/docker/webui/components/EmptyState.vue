<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<template>
  <div class="empty" :class="{ 'empty-with-action': $slots.action }">
    <slot>
      {{ text }}
    </slot>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>
