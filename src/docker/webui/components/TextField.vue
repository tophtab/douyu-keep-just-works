<script setup lang="ts">
defineProps<{
  autocomplete?: string
  autocapitalize?: string
  helperId?: string
  helperText?: string
  inputId: string
  label: string
  modelValue: string
  name: string
  placeholder?: string
  spellcheck?: boolean | 'false' | 'true'
  type?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      :value="modelValue"
      :name="name"
      :type="type || 'text'"
      :autocomplete="autocomplete"
      :autocapitalize="autocapitalize"
      :spellcheck="spellcheck"
      :placeholder="placeholder"
      :aria-describedby="helperId"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <div v-if="helperText" :id="helperId" class="helper">
      {{ helperText }}
    </div>
  </div>
</template>
