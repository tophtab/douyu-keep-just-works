<script setup lang="ts">
interface ExpiringBackpackRow {
  count: number
  expireText: string
  giftId: number | string
  inThreshold: boolean
  index: number
  intimacy: number
  name: string
  remainingText: string
}

defineProps<{
  rows: ExpiringBackpackRow[]
}>()
</script>

<template>
  <table class="table table-fixed backpack-table">
    <colgroup>
      <col style="width:50px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
    </colgroup>
    <thead>
      <tr>
        <th class="index-head" scope="col">
          序号
        </th>
        <th scope="col">
          礼物
        </th>
        <th class="num-head" scope="col">
          ID
        </th>
        <th class="num-head" scope="col">
          数量
        </th>
        <th class="num-head" scope="col">
          亲密度
        </th>
        <th class="date-head" scope="col">
          过期时间
        </th>
        <th class="num-head" scope="col">
          剩余
        </th>
        <th class="control-head" scope="col">
          临期
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="`${row.giftId}-${row.index}`">
        <td class="index-cell" data-label="序号">
          {{ row.index }}
        </td>
        <td class="text-cell" data-label="礼物" :title="row.name">
          {{ row.name }}
        </td>
        <td class="num-cell" data-label="ID">
          {{ row.giftId }}
        </td>
        <td class="num-cell" data-label="数量">
          {{ row.count }}
        </td>
        <td class="num-cell" data-label="亲密度">
          {{ row.intimacy }}
        </td>
        <td class="date-cell" data-label="过期时间">
          {{ row.expireText }}
        </td>
        <td class="num-cell" data-label="剩余">
          {{ row.remainingText }}
        </td>
        <td class="status-cell control-cell" data-label="临期">
          <span class="pill" :class="row.inThreshold ? 'warn' : 'off'">{{ row.inThreshold ? '是' : '否' }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
