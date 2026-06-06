<script setup lang="ts">
import EnableSwitch from './EnableSwitch.vue'
import PageSection from './PageSection.vue'

withDefaults(defineProps<{
  controlColumns?: 1 | 2 | 3
  inputId: string
  label: string
  modelValue: boolean
  name: string
  note?: string
  title: string
}>(), {
  controlColumns: 1,
})

const emit = defineEmits<{
  change: []
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <PageSection class="task-settings-section">
    <div class="task-settings-stack">
      <EnableSwitch
        :model-value="modelValue"
        :input-id="inputId"
        :name="name"
        :label="label"
        :title="title"
        :note="note"
        @update:model-value="value => emit('update:modelValue', value)"
        @change="emit('change')"
      />
      <div v-if="$slots.controls" class="grid section-form-grid" :class="`cols-${controlColumns}`">
        <slot name="controls" />
      </div>
      <slot name="actions" />
      <slot />
    </div>
  </PageSection>
</template>
