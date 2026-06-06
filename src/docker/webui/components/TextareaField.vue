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
  rows?: number | string
  spellcheck?: boolean | 'false' | 'true'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="field-block">
    <label class="field-label" :for="inputId">{{ label }}</label>
    <textarea
      :id="inputId"
      :value="modelValue"
      :name="name"
      :autocomplete="autocomplete"
      :autocapitalize="autocapitalize"
      :spellcheck="spellcheck"
      :placeholder="placeholder"
      :rows="rows"
      :aria-describedby="helperId"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div v-if="helperText" :id="helperId" class="helper">
      {{ helperText }}
    </div>
  </div>
</template>
