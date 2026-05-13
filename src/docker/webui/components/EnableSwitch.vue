<script setup lang="ts">
defineProps<{
  inputId: string
  label: string
  modelValue: boolean
  name: string
  note?: string
  title?: string
}>()

const emit = defineEmits<{
  change: []
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="field-block">
    <div v-if="title || note" class="switch-field">
      <div class="switch-copy">
        <div v-if="title" class="switch-title">
          {{ title }}
        </div>
        <div v-if="note" class="switch-note">
          {{ note }}
        </div>
      </div>
      <label class="switch-control">
        <input
          :id="inputId"
          :checked="modelValue"
          class="switch-input"
          type="checkbox"
          :name="name"
          :aria-label="label"
          @change="(event) => {
            emit('update:modelValue', (event.target as HTMLInputElement).checked)
            emit('change')
          }"
        >
        <span class="switch-slider" />
      </label>
    </div>
    <label v-else class="switch-control">
      <input
        :id="inputId"
        :checked="modelValue"
        class="switch-input"
        type="checkbox"
        :name="name"
        :aria-label="label"
        @change="(event) => {
          emit('update:modelValue', (event.target as HTMLInputElement).checked)
          emit('change')
        }"
      >
      <span class="switch-slider" />
    </label>
  </div>
</template>
