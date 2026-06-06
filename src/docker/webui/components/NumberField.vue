<script setup lang="ts">
import type { FieldValue } from '../ui-types'

defineProps<{
  helperId?: string
  helperText?: string
  inputId: string
  inputmode?: 'decimal' | 'numeric'
  label: string
  min?: number | string
  modelValue: FieldValue
  name: string
  step?: number | string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FieldValue]
}>()

function handleInput(event: Event): void {
  const nextValue = (event.target as HTMLInputElement).value
  emit('update:modelValue', nextValue === '' ? '' : Number(nextValue))
}
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      :value="modelValue"
      :name="name"
      type="number"
      :min="min"
      :step="step"
      :inputmode="inputmode"
      :aria-describedby="helperId"
      @input="handleInput"
    >
    <div v-if="helperText" :id="helperId" class="helper">
      {{ helperText }}
    </div>
  </div>
</template>
