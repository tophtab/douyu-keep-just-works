<script setup lang="ts">
defineProps<{
  inputId: string
  modelValue: string
  name: string
  previewId: string
  previewText: string
}>()

const emit = defineEmits<{
  input: []
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">Cron 表达式</label>
    <input
      :id="inputId"
      :value="modelValue"
      :name="name"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      @input="(event) => {
        emit('update:modelValue', (event.target as HTMLInputElement).value)
        emit('input')
      }"
    >
    <div :id="previewId" class="helper cron-preview" role="status" aria-live="polite">
      {{ previewText }}
    </div>
  </div>
</template>
