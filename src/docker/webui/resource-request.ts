export interface ResourceRequest {
  pending: Promise<unknown> | null
  fetchedAt: number
  requestSeq: number
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

export interface TrackedResourceRequestContext {
  requestSeq: number
  isCurrent: () => boolean
}

export function runTrackedResourceRequest<T>(
  resource: ResourceRequest,
  run: (context: TrackedResourceRequestContext) => Promise<T>,
): Promise<T> {
  if (resource.pending) {
    return resource.pending as Promise<T>
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  const pending = run({
    requestSeq,
    isCurrent: () => resource.requestSeq === requestSeq,
  })

  return trackResourceRequest(resource, requestSeq, pending)
}
