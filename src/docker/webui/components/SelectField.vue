<script setup lang="ts">
import type { FieldOption, FieldValue } from '../ui-types'

const props = defineProps<{
  helperId?: string
  helperText?: string
  inputId: string
  label: string
  modelValue: FieldValue
  name: string
  options: FieldOption[]
}>()

const emit = defineEmits<{
  change: []
  'update:modelValue': [value: FieldValue]
}>()

function handleChange(event: Event): void {
  const nextValue = (event.target as HTMLSelectElement).value
  const option = props.options.find(item => String(item.value) === nextValue)
  emit('update:modelValue', option ? option.value : nextValue)
  emit('change')
}
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <select
      :id="inputId"
      :value="String(modelValue)"
      :name="name"
      :aria-describedby="helperId"
      @change="handleChange"
    >
      <option v-for="option in options" :key="String(option.value)" :value="String(option.value)">
        {{ option.label }}
      </option>
    </select>
    <div v-if="helperText" :id="helperId" class="helper">
      {{ helperText }}
    </div>
  </div>
</template>
