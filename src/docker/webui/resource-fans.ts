import type { DockerConfig, Fans, FansStatusResponse, FanStatus, GiftStatus } from '../../core/types'
import { ref } from 'vue'
import { getRawConfig, hasCookieSourceConfigured, setRawConfig } from './resource-config'
import { createResourceRequest, markResourceRequestLoaded, resetResourceRequest, runResourceRequest, withForceRefresh } from './resource-request'
import type { ResourceRequest } from './resource-request'
import { requestJson } from './request'
import { getErrorMessage, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'

type FansResourceKey = 'fansSync' | 'fansList' | 'fansStatus'

export interface ManagedFansResponse {
  config?: DockerConfig
  fans?: Fans[]
}

interface ApplyManagedFansResponseOptions {
  updateFans?: boolean
}

export const managed = ref<ManagedFansResponse | null>(null)
export const managedLoading = ref(false)
export const fansListError = ref('')
export const fansListLoaded = ref(false)
export const fansStatus = ref<FanStatus[]>([])
export const fansStatusError = ref('')
export const fansStatusLoading = ref(false)
export const fansStatusLoaded = ref(false)
export const fansStatusDetailsLoading = ref(false)
export const fansStatusDetailsLoaded = ref(false)
export const giftStatus = ref<GiftStatus | null>(null)

const resourceRequests: Record<FansResourceKey, ResourceRequest> = {
  fansSync: createResourceRequest(),
  fansList: createResourceRequest(),
  fansStatus: createResourceRequest(),
}

function getResourceRequest(key: FansResourceKey): ResourceRequest {
  return resourceRequests[key]
}

function clearResourceError(key: FansResourceKey): void {
  if (key === 'fansList') {
    fansListError.value = ''
  }
  if (key === 'fansStatus') {
    fansStatusError.value = ''
  }
}

function markResourceLoaded(key: FansResourceKey): void {
  clearResourceError(key)
  markResourceRequestLoaded(getResourceRequest(key))
}

function invalidateResourceRequest(key: FansResourceKey): void {
  resetResourceRequest(getResourceRequest(key))
  clearResourceError(key)
}

function invalidateResourceRequests(keys: FansResourceKey[]): void {
  keys.forEach(invalidateResourceRequest)
}

export function getManagedConfig(): DockerConfig {
  return managed.value?.config || getRawConfig()
}

export function getManagedFans(): Fans[] {
  if (managed.value?.fans?.length) {
    return managed.value.fans
  }
  if (fansStatus.value.length) {
    return fansStatus.value
  }
  return managed.value?.fans || []
}

export function setManagedFans(nextFans: Fans[]): void {
  managed.value = {
    config: getRawConfig(),
    fans: Array.isArray(nextFans) ? nextFans : [],
  }
}

export function applyManagedFansResponse(data: ManagedFansResponse | null | undefined, options: ApplyManagedFansResponseOptions = {}): void {
  if (!data) {
    return
  }

  const nextConfig = data.config || getRawConfig()
  if (data.config) {
    setRawConfig(data.config)
  }

  if (options.updateFans && Array.isArray(data.fans)) {
    managed.value = {
      config: nextConfig,
      fans: data.fans,
    }
    fansListLoaded.value = true
    fansListError.value = ''
    markResourceLoaded('fansList')
    return
  }

  if (data.config && managed.value) {
    managed.value = {
      ...managed.value,
      config: data.config,
    }
  }
}

function mergeFansWithExistingStatus(nextFans: Fans[]): FanStatus[] {
  const previousByRoom: Record<string, FanStatus> = {}
  fansStatus.value.forEach((fan) => {
    previousByRoom[String(fan.roomId)] = fan
  })

  return (Array.isArray(nextFans) ? nextFans : []).map((fan) => {
    const previous = previousByRoom[String(fan.roomId)]
    if (!previous || typeof (fan as FanStatus).doubleActive === 'boolean') {
      return fan as FanStatus
    }
    const merged: FanStatus = { ...fan }
    if (typeof previous.doubleActive === 'boolean') {
      merged.doubleActive = previous.doubleActive
    }
    if (previous.doubleExpireTime) {
      merged.doubleExpireTime = previous.doubleExpireTime
    }
    return merged
  })
}

function applyFansStatusBase(data: FansStatusResponse): void {
  const nextFans = data?.fans || []
  fansStatus.value = mergeFansWithExistingStatus(nextFans)
  if (data?.gift && data.complete) {
    giftStatus.value = data.gift
  }
  setManagedFans(fansStatus.value)
  fansStatusLoaded.value = true
  fansStatusDetailsLoaded.value = Boolean(data?.complete)
}

function applyFansStatusDetails(data: FansStatusResponse): void {
  fansStatus.value = data?.fans || []
  giftStatus.value = data?.gift || null
  setManagedFans(fansStatus.value)
  fansStatusLoaded.value = true
  fansStatusDetailsLoaded.value = true
}

export function clearFansCookieBackedData(): void {
  invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus'])
  managed.value = null
  fansStatus.value = []
  giftStatus.value = null
  fansStatusLoading.value = false
  fansStatusLoaded.value = false
  fansStatusDetailsLoading.value = false
  fansStatusDetailsLoaded.value = false
  fansListError.value = ''
  fansStatusError.value = ''
  managedLoading.value = false
  fansListLoaded.value = false
}

export function invalidateFansResources(): void {
  invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus'])
}

export async function syncFans(showSuccessToast = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansSync')
  if (!hasCookieSourceConfigured(config)) {
    invalidateFansResources()
    managedLoading.value = false
    fansStatusLoading.value = false
    fansStatusDetailsLoading.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return false
  }

  return runResourceRequest(resource, async ({ isStale }) => {
    managedLoading.value = true
    fansListError.value = ''

    try {
      const data = await requestJson<ManagedFansResponse>('/api/fans/reconcile', {
        method: 'POST',
      })
      if (isStale()) {
        return undefined
      }
      applyManagedFansResponse(data, { updateFans: true })
      managedLoading.value = false
      fansListLoaded.value = true
      markResourceLoaded('fansList')
      invalidateResourceRequest('fansStatus')
      if (showSuccessToast) {
        showToast('粉丝牌与任务配置已同步', true)
      }
      return true
    } catch (error: unknown) {
      if (isStale()) {
        return undefined
      }
      if (isHttpUnauthorized(error)) {
        return undefined
      }
      managedLoading.value = false
      fansListError.value = getErrorMessage(error)
      if (showSuccessToast) {
        showToast('同步粉丝牌失败，请查看页面提示', false)
      }
      return false
    }
  })
}

export async function loadFansList(showSuccessToast = false, forceRefresh = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansList')
  if (!hasCookieSourceConfigured(config)) {
    invalidateResourceRequest('fansList')
    managed.value = null
    managedLoading.value = false
    fansListLoaded.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return false
  }

  return runResourceRequest(resource, async ({ isStale }) => {
    managedLoading.value = true
    fansListError.value = ''

    try {
      const data = await requestJson<Fans[]>(withForceRefresh('/api/fans', forceRefresh))
      if (isStale()) {
        return undefined
      }
      setManagedFans(data)
      managedLoading.value = false
      fansListLoaded.value = true
      markResourceLoaded('fansList')
      if (showSuccessToast) {
        showToast('粉丝牌列表已加载', true)
      }
      return true
    } catch (error: unknown) {
      if (isStale()) {
        return undefined
      }
      if (isHttpUnauthorized(error)) {
        return undefined
      }
      managedLoading.value = false
      fansListError.value = getErrorMessage(error)
      if (showSuccessToast) {
        showToast('加载粉丝牌列表失败，请查看页面提示', false)
      }
      return false
    }
  })
}

export async function loadFansStatus(showSuccessToast = false, forceRefresh = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansStatus')
  if (!hasCookieSourceConfigured(config)) {
    invalidateResourceRequest('fansStatus')
    fansStatus.value = []
    giftStatus.value = null
    fansStatusLoading.value = false
    fansStatusLoaded.value = false
    fansStatusDetailsLoaded.value = false
    fansStatusDetailsLoading.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return false
  }

  return runResourceRequest(resource, async ({ isStale }) => {
    fansStatusLoading.value = true
    fansStatusDetailsLoading.value = true
    fansStatusError.value = ''

    try {
      const data = await requestJson<FansStatusResponse>(withForceRefresh('/api/fans/status/base', forceRefresh))
      if (isStale()) {
        return undefined
      }
      applyFansStatusBase(data)
      if (data?.complete) {
        fansStatusLoading.value = false
        fansStatusDetailsLoading.value = false
        markResourceLoaded('fansStatus')
        if (fansStatus.value.length) {
          markResourceLoaded('fansList')
        }
        if (showSuccessToast) {
          showToast('粉丝牌状态已刷新', true)
        }
        return true
      }

      const details = await requestJson<FansStatusResponse>(withForceRefresh('/api/fans/status/details', forceRefresh))
      if (isStale()) {
        return undefined
      }
      applyFansStatusDetails(details)
      fansStatusLoading.value = false
      fansStatusDetailsLoading.value = false
      markResourceLoaded('fansStatus')
      if (fansStatus.value.length) {
        markResourceLoaded('fansList')
      }
      if (showSuccessToast) {
        showToast('粉丝牌状态已刷新', true)
      }
      return true
    } catch (error: unknown) {
      if (isStale()) {
        return undefined
      }
      fansStatusLoading.value = false
      fansStatusDetailsLoading.value = false
      if (!fansStatusLoaded.value) {
        fansStatus.value = []
        giftStatus.value = null
        fansStatusDetailsLoaded.value = false
      }
      if (isHttpUnauthorized(error)) {
        return undefined
      }
      fansStatusError.value = getErrorMessage(error)
      if (showSuccessToast) {
        showToast('加载粉丝牌状态失败，请查看页面提示', false)
      }
      return false
    }
  })
}
