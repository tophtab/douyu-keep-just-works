<script setup lang="ts">
import SchedulePicker from './SchedulePicker.vue'

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

/** 选择器改动同样算一次输入，让各页面的 Cron 预览跟着刷新。 */
function applyPickedCron(value: string): void {
  emit('update:modelValue', value)
  emit('input')
}
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">Cron 表达式</label>
    <div class="field-with-prefix has-prefix">
      <slot name="prefix">
        <SchedulePicker :model-value="modelValue" @update:model-value="applyPickedCron" />
      </slot>
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
    </div>
    <div v-if="previewText" :id="previewId" class="helper cron-preview" role="status" aria-live="polite">
      {{ previewText }}
    </div>
  </div>
</template>
