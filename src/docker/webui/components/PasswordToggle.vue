<script setup lang="ts">
defineProps<{
  disabled?: boolean
  pressed: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <button
    class="auth-password-toggle"
    type="button"
    tabindex="-1"
    :aria-pressed="pressed ? 'true' : 'false'"
    :aria-label="pressed ? '隐藏密码' : '显示密码'"
    :title="pressed ? '隐藏密码' : '显示密码'"
    :disabled="disabled"
    @click="emit('toggle')"
  >
    <svg v-if="pressed" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.7 6.1A10 10 0 0 1 12 6c5.8 0 9.4 6 9.4 6a17.6 17.6 0 0 1-3.1 3.8" />
      <path d="M6.4 7.8A17.4 17.4 0 0 0 2.6 12S6.2 18 12 18a10 10 0 0 0 4-.85" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  </button>
</template>
