export interface ResourceRequest {
  pending: Promise<unknown> | null
  fetchedAt: number
  requestSeq: number
}

export interface ResourceRequestContext {
  requestSeq: number
  isStale: () => boolean
}

export function createResourceRequest(): ResourceRequest {
  return {
    pending: null,
    fetchedAt: 0,
    requestSeq: 0,
  }
}

export function resetResourceRequest(resource: ResourceRequest): void {
  resource.pending = null
  resource.fetchedAt = 0
  resource.requestSeq += 1
}

export function markResourceRequestLoaded(resource: ResourceRequest): void {
  resource.fetchedAt = Date.now()
}

export function withForceRefresh(url: string, forceRefresh = false): string {
  if (!forceRefresh) {
    return url
  }
  return `${url}${url.includes('?') ? '&' : '?'}force=1`
}

export function isResourceRequestStale(resource: ResourceRequest, requestSeq: number): boolean {
  return resource.requestSeq !== requestSeq
}

export function trackResourceRequest<T>(resource: ResourceRequest, requestSeq: number, pending: Promise<T>): Promise<T> {
  const tracked = pending.then(
    (value) => {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null
      }
      return value
    },
    (error: unknown) => {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null
      }
      throw error
    },
  )
  resource.pending = tracked
  return tracked
}

export function runResourceRequest<T>(
  resource: ResourceRequest,
  run: (context: ResourceRequestContext) => Promise<T>,
): Promise<T> {
  if (resource.pending) {
    return resource.pending as Promise<T>
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  const context: ResourceRequestContext = {
    requestSeq,
    isStale: () => isResourceRequestStale(resource, requestSeq),
  }

  let pending: Promise<T>
  try {
    pending = Promise.resolve(run(context))
  } catch (error: unknown) {
    pending = Promise.reject(error)
  }

  return trackResourceRequest(resource, requestSeq, pending)
}
