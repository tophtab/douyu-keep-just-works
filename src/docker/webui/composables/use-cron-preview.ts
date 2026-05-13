import { computed, ref } from 'vue'
import { formatDate } from '../datetime'
import { requestJson } from '../request'
import { getErrorMessage } from '../task-shared'

export interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

export function useCronPreview(getRawValue: () => string) {
  const cronPreview = ref<CronPreview>({
    value: '',
    runs: [],
    error: '',
    loading: false,
  })
  let requestSeq = 0

  async function loadCronPreview(): Promise<void> {
    const value = getRawValue().trim()
    requestSeq += 1
    const currentRequestSeq = requestSeq

    if (!value) {
      cronPreview.value = { value: '', runs: [], error: '', loading: false }
      return
    }

    cronPreview.value = { value, runs: [], error: '', loading: true }
    try {
      const data = await requestJson<{ runs?: string[] }>(`/api/cron-preview?value=${encodeURIComponent(value)}`)
      if (requestSeq !== currentRequestSeq) {
        return
      }
      cronPreview.value = { value, runs: data.runs || [], error: '', loading: false }
    } catch (error) {
      if (requestSeq !== currentRequestSeq) {
        return
      }
      cronPreview.value = { value, runs: [], error: getErrorMessage(error), loading: false }
    }
  }

  function ensureCronPreview(): Promise<void> {
    const value = getRawValue().trim()
    const preview = cronPreview.value
    if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
      return loadCronPreview()
    }
    return Promise.resolve()
  }

  const cronPreviewText = computed(() => {
    const preview = cronPreview.value
    if (!preview.value) {
      return '填写 cron 后显示未来三次执行时间。'
    }
    if (preview.loading) {
      return '正在计算未来执行时间…'
    }
    if (preview.error) {
      return `cron 校验失败：${preview.error}`
    }
    if (!preview.runs.length) {
      return '暂未生成未来执行时间。'
    }
    return `未来三次：${preview.runs.map(item => formatDate(item)).join(' / ')}`
  })

  return {
    cronPreview,
    cronPreviewText,
    ensureCronPreview,
    loadCronPreview,
  }
}
