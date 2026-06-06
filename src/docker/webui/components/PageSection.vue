<script setup lang="ts">
defineProps<{
  kicker?: string
  title?: string
  titleId?: string
}>()
</script>

<template>
  <div class="panel section-panel">
    <div v-if="kicker || title || $slots.actions" class="panel-head section-panel-head">
      <div v-if="kicker || title" class="section-heading">
        <div v-if="kicker" class="section-kicker">
          {{ kicker }}
        </div>
        <h3 v-if="title" :id="titleId" class="section-title">
          {{ title }}
        </h3>
      </div>
      <slot name="actions" />
    </div>
    <div class="section-body" :class="{ 'section-body-attached': kicker || title || $slots.actions }">
      <slot />
    </div>
  </div>
</template>
