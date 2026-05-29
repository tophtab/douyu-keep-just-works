<script setup lang="ts">
interface StatusPill {
  kind: string
  label: string
}

interface StatusCell {
  label: string
  value: string
}

defineProps<{
  cardId?: string
  cells: StatusCell[]
  kicker?: string
  pills: StatusPill[]
  title: string
}>()
</script>

<template>
  <div :id="cardId" class="task-card">
    <div class="task-card-head">
      <div>
        <div class="section-kicker">
          {{ kicker || '任务状态' }}
        </div>
        <h3 class="task-card-title">
          {{ title }}
        </h3>
      </div>
    </div>
    <div class="task-card-pills">
      <span v-for="pill in pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
    </div>
    <div class="summary-grid" :class="{ quad: cells.length === 4 }">
      <div v-for="cell in cells" :key="cell.label" class="summary-cell">
        <div class="mini-label">
          {{ cell.label }}
        </div>
        <div class="mini-value">
          {{ cell.value }}
        </div>
      </div>
    </div>
  </div>
</template>
