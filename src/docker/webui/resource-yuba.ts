import type { YubaGroupStatus, YubaStatusResponse } from '../../core/types'
import { ref } from 'vue'
import { getRawConfig, hasCookieSourceConfigured } from './resource-config'
import { createResourceRequest, markResourceRequestLoaded, resetResourceRequest, trackResourceRequest, withForceRefresh } from './resource-request'
import { requestJson } from './request'
import { getErrorMessage, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'

const yubaStatusRequest = createResourceRequest()

export const yubaStatus = ref<YubaGroupStatus[]>([])
export const yubaStatusError = ref('')
export const yubaStatusLoaded = ref(false)
export const yubaStatusLoading = ref(false)

function invalidateYubaStatusRequest(): void {
  resetResourceRequest(yubaStatusRequest)
  yubaStatusError.value = ''
}

export function clearYubaCookieBackedData(): void {
  invalidateYubaStatusRequest()
  yubaStatus.value = []
  yubaStatusError.value = ''
  yubaStatusLoaded.value = false
  yubaStatusLoading.value = false
}

export async function loadYubaStatus(showSuccessToast = false, forceRefresh = false): Promise<unknown> {
  const config = getRawConfig()
  if (!hasCookieSourceConfigured(config)) {
    clearYubaCookieBackedData()
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return undefined
  }

  if (yubaStatusRequest.pending) {
    return yubaStatusRequest.pending
  }

  const requestSeq = yubaStatusRequest.requestSeq + 1
  yubaStatusRequest.requestSeq = requestSeq
  yubaStatusError.value = ''
  yubaStatusLoading.value = true

  const pending = requestJson<YubaStatusResponse>(withForceRefresh('/api/yuba/status', forceRefresh)).then((data) => {
    if (yubaStatusRequest.requestSeq !== requestSeq) {
      return undefined
    }
    yubaStatus.value = data?.groups || []
    yubaStatusError.value = ''
    yubaStatusLoaded.value = true
    yubaStatusLoading.value = false
    markResourceRequestLoaded(yubaStatusRequest)
    if (showSuccessToast) {
      showToast('鱼吧状态已刷新', true)
    }
    return data
  }).catch((error: unknown) => {
    if (yubaStatusRequest.requestSeq !== requestSeq) {
      return undefined
    }
    if (isHttpUnauthorized(error)) {
      return undefined
    }
    yubaStatus.value = yubaStatusLoaded.value ? yubaStatus.value : []
    yubaStatusError.value = getErrorMessage(error)
    yubaStatusLoading.value = false
    showToast(`加载鱼吧状态失败：${getErrorMessage(error)}`, false)
    return undefined
  })

  return trackResourceRequest(yubaStatusRequest, requestSeq, pending)
}
