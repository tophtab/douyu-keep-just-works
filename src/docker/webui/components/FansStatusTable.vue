<script setup lang="ts">
interface FansStatusRow {
  doubleKind?: string
  doubleLabel?: string
  index: number
  intimacy: number | string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
}

defineProps<{
  rows: FansStatusRow[]
  showDoubleStatus?: boolean
}>()
</script>

<template>
  <table class="table table-fixed fans-status-table">
    <colgroup>
      <col style="width:50px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col style="width:100px">
      <col v-if="showDoubleStatus" style="width:100px">
    </colgroup>
    <thead>
      <tr>
        <th scope="col" class="index-head">
          序号
        </th>
        <th scope="col">
          主播名称
        </th>
        <th scope="col" class="num-head">
          房间号
        </th>
        <th scope="col" class="num-head">
          等级
        </th>
        <th scope="col" class="num-head">
          排名
        </th>
        <th scope="col" class="num-head">
          今日亲密度
        </th>
        <th scope="col" class="num-head">
          亲密度
        </th>
        <th v-if="showDoubleStatus" scope="col" class="control-head">
          双倍状态
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.roomId">
        <td data-label="序号" class="index-cell">
          {{ row.index }}
        </td>
        <td data-label="主播名称" class="text-cell" :title="row.name">
          {{ row.name }}
        </td>
        <td data-label="房间号" class="num-cell">
          {{ row.roomId }}
        </td>
        <td data-label="等级" class="num-cell">
          {{ row.level }}
        </td>
        <td data-label="排名" class="num-cell">
          {{ row.rank }}
        </td>
        <td data-label="今日亲密度" class="num-cell">
          {{ row.today }}
        </td>
        <td data-label="亲密度" class="num-cell">
          {{ row.intimacy }}
        </td>
        <td v-if="showDoubleStatus" data-label="双倍状态" class="status-cell">
          <span class="pill" :class="row.doubleKind">{{ row.doubleLabel }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
