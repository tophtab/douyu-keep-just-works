<script setup lang="ts">
interface AllocationRow {
  enabled?: boolean
  index: number
  intimacy: number | string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
  value: number
}

defineProps<{
  enabledClass?: string
  enabledNamePrefix?: string
  inputClass: string
  inputNamePrefix: string
  rows: AllocationRow[]
  showEnabled?: boolean
  tableClass: string
  taskLabel: string
  valueLabel: string
}>()

const emit = defineEmits<{
  enabledChange: [row: AllocationRow, value: boolean]
  valueChange: [row: AllocationRow, value: number]
}>()
</script>

<template>
  <table class="table table-fixed" :class="tableClass">
    <colgroup>
      <col v-if="showEnabled" style="width:68px">
      <col style="width:56px">
      <col style="width:156px">
      <col style="width:104px">
      <col style="width:94px">
      <col style="width:94px">
      <col style="width:94px">
      <col style="width:94px">
      <col style="width:112px">
    </colgroup>
    <thead>
      <tr>
        <th v-if="showEnabled" class="control-head" scope="col">
          参与
        </th>
        <th class="index-head" scope="col">
          序号
        </th>
        <th scope="col">
          主播名称
        </th>
        <th class="num-head" scope="col">
          房间号
        </th>
        <th class="num-head" scope="col">
          等级
        </th>
        <th class="num-head" scope="col">
          排名
        </th>
        <th class="num-head" scope="col">
          今日亲密度
        </th>
        <th class="num-head" scope="col">
          亲密度
        </th>
        <th class="control-head" scope="col">
          {{ valueLabel }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.roomId">
        <td v-if="showEnabled" class="control-cell" data-label="参与">
          <input
            :checked="row.enabled"
            :class="enabledClass"
            type="checkbox"
            :name="`${enabledNamePrefix}-${row.roomId}`"
            :data-room-id="row.roomId"
            :aria-label="`参与${taskLabel}任务：${row.name}，房间 ${row.roomId}`"
            @change="emit('enabledChange', row, ($event.target as HTMLInputElement).checked)"
          >
        </td>
        <td class="index-cell" data-label="序号">
          {{ row.index }}
        </td>
        <td class="text-cell" data-label="主播名称" :title="row.name">
          {{ row.name }}
        </td>
        <td class="num-cell" data-label="房间号">
          {{ row.roomId }}
        </td>
        <td class="num-cell" data-label="等级">
          {{ row.level }}
        </td>
        <td class="num-cell" data-label="排名">
          {{ row.rank }}
        </td>
        <td class="num-cell" data-label="今日亲密度">
          {{ row.today }}
        </td>
        <td class="num-cell" data-label="亲密度">
          {{ row.intimacy }}
        </td>
        <td class="control-cell" :data-label="valueLabel">
          <input
            :value="row.value"
            :class="inputClass"
            type="number"
            :name="`${inputNamePrefix}-${row.roomId}`"
            :data-room-id="row.roomId"
            :data-level="row.level"
            min="0"
            step="1"
            inputmode="numeric"
            :aria-label="`${taskLabel}${valueLabel}：${row.name}，房间 ${row.roomId}`"
            @input="emit('valueChange', row, Number(($event.target as HTMLInputElement).value))"
          >
        </td>
      </tr>
    </tbody>
  </table>
</template>
