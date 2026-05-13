import { WEBUI_APP_EVENTS } from './app-events'
import { showToast } from './toast'

export const UNAUTHORIZED_EVENT_NAME = WEBUI_APP_EVENTS.unauthorized

export interface WebUiRequestError extends Error {
  status?: number
  data?: unknown
}

type ErrorToastFormatter = string | ((message: string, error: WebUiRequestError) => string)

export interface WebUiRequestInit extends RequestInit {
  errorToast?: ErrorToastFormatter | false
  onUnauthorized?: (() => void) | false
}

function parseJson(text: string): unknown {
  if (!text) {
    return {}
  }
  return JSON.parse(text)
}

function getErrorMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error
  }
  return '请求失败'
}

function dispatchUnauthorized(): void {
  document.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT_NAME))
}

function maybeHandleUnauthorized(error: WebUiRequestError, onUnauthorized: WebUiRequestInit['onUnauthorized']): void {
  if (error.status !== 401 || onUnauthorized === false) {
    return
  }

  if (onUnauthorized) {
    onUnauthorized()
    return
  }

  dispatchUnauthorized()
}

function maybeShowErrorToast(error: WebUiRequestError, errorToast: WebUiRequestInit['errorToast']): void {
  if (!errorToast || error.status === 401) {
    return
  }

  const message = typeof errorToast === 'function'
    ? errorToast(error.message, error)
    : `${errorToast}${error.message}`

  showToast(message, false)
}

function toRequestError(error: unknown): WebUiRequestError {
  if (error instanceof Error) {
    return error as WebUiRequestError
  }
  return new Error(String(error)) as WebUiRequestError
}

export async function requestJson<T = unknown>(url: string, options: WebUiRequestInit = {}): Promise<T> {
  const {
    errorToast = false,
    onUnauthorized,
    ...fetchOptions
  } = options

  try {
    const response = await fetch(url, fetchOptions)
    const text = await response.text()
    const data = parseJson(text)

    if (!response.ok) {
      const error = new Error(getErrorMessage(data)) as WebUiRequestError
      error.status = response.status
      error.data = data
      maybeHandleUnauthorized(error, onUnauthorized)
      throw error
    }

    return data as T
  } catch (error) {
    const requestError = toRequestError(error)
    maybeShowErrorToast(requestError, errorToast)
    throw error
  }
}
