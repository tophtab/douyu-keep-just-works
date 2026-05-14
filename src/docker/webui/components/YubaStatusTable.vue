<script setup lang="ts">
interface YubaStatusRow {
  error?: string
  expText: string
  groupId: number | string
  groupLevel: number | string
  groupName: string
  index: number
  rank: number | string
  signed: boolean
}

defineProps<{
  rows: YubaStatusRow[]
}>()
</script>

<template>
  <table class="table table-fixed yuba-status-table">
    <colgroup>
      <col style="width:50px">
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
          鱼吧名称
        </th>
        <th class="num-head" scope="col">
          鱼吧ID
        </th>
        <th class="num-head" scope="col">
          等级
        </th>
        <th class="num-head" scope="col">
          排名
        </th>
        <th class="num-head" scope="col">
          经验值
        </th>
        <th class="control-head" scope="col">
          签到状态
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="`${row.groupId}-${row.index}`">
        <td class="index-cell" data-label="序号">
          {{ row.index }}
        </td>
        <td class="text-cell" data-label="鱼吧名称">
          {{ row.groupName }}
        </td>
        <td class="num-cell" data-label="鱼吧ID">
          {{ row.groupId }}
        </td>
        <td class="num-cell" data-label="等级">
          {{ row.groupLevel }}
        </td>
        <td class="num-cell" data-label="排名">
          {{ row.rank }}
        </td>
        <td class="num-cell" data-label="经验值">
          {{ row.expText }}
        </td>
        <td class="status-cell" data-label="签到状态">
          <template v-if="row.error">
            <span class="pill warn">获取失败</span>
            <div class="helper error-cell" style="margin-top:6px">
              {{ row.error }}
            </div>
          </template>
          <span v-else class="pill" :class="row.signed ? 'ok' : 'off'">{{ row.signed ? '已签到' : '未签到' }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
