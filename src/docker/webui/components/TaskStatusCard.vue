<script setup lang="ts">
interface StatusPill {
  kind: string
  label: string
}

interface StatusCellPart {
  text: string
  tone?: 'danger' | 'muted' | 'success'
}

interface StatusCell {
  label: string
  value: string
  parts?: StatusCellPart[]
}

withDefaults(defineProps<{
  cardId?: string
  cells: StatusCell[]
  /** 传空串可隐藏卡片 kicker */
  kicker?: string
  pills: StatusPill[]
  title: string
}>(), {
  kicker: '任务状态',
})
</script>

<template>
  <div :id="cardId" class="task-card">
    <div class="task-card-head">
      <div>
        <div v-if="kicker !== ''" class="section-kicker">
          {{ kicker }}
        </div>
        <h3 class="task-card-title">
          {{ title }}
        </h3>
      </div>
    </div>
    <div class="task-card-pills">
      <span v-for="pill in pills" :key="pill.label" class="pill" :class="pill.kind">{{ pill.label }}</span>
    </div>
    <div class="summary-grid" :class="{ quad: cells.length === 4, dual: cells.length === 2 }">
      <div v-for="cell in cells" :key="cell.label" class="summary-cell">
        <div class="mini-label">
          {{ cell.label }}
        </div>
        <div class="mini-value">
          <template v-if="cell.parts?.length">
            <span
              v-for="(part, index) in cell.parts"
              :key="index"
              :class="part.tone ? `tone-${part.tone}` : undefined"
            >{{ part.text }}</span>
          </template>
          <template v-else>
            {{ cell.value }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
