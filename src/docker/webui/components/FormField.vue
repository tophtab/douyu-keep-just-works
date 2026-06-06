<script setup lang="ts">
defineProps<{
  helperId?: string
  helperText?: string
  inputId: string
  label: string
}>()
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <slot />
    <div v-if="helperText" :id="helperId" class="helper">
      {{ helperText }}
    </div>
  </div>
</template>
