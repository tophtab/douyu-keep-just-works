import { onBeforeUnmount, onMounted, ref } from 'vue'
import { WEBUI_APP_EVENTS } from './app-events'

interface ToastEventDetail {
  message?: unknown
  ok?: unknown
}

export const TOAST_EVENT_NAME = WEBUI_APP_EVENTS.toast

function normalizeToastMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message
  }
  if (message == null) {
    return ''
  }
  return String(message)
}

export function showToast(message: string, ok: boolean): void {
  document.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, {
    detail: { message, ok },
  }))
}

export function useToastRegion() {
  const toastLiveMessage = ref('')
  const toastMessage = ref('')
  const toastOk = ref(false)
  const toastVisible = ref(false)

  let liveTimer: ReturnType<typeof setTimeout> | null = null
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function clearToastTimers(): void {
    if (liveTimer) {
      clearTimeout(liveTimer)
      liveTimer = null
    }
    if (toastTimer) {
      clearTimeout(toastTimer)
      toastTimer = null
    }
  }

  function presentToast(message: unknown, ok: unknown): void {
    const normalizedMessage = normalizeToastMessage(message)
    if (!normalizedMessage) {
      return
    }

    clearToastTimers()

    toastLiveMessage.value = ''
    toastMessage.value = normalizedMessage
    toastOk.value = Boolean(ok)
    toastVisible.value = true

    liveTimer = window.setTimeout(() => {
      toastLiveMessage.value = normalizedMessage
      liveTimer = null
    }, 0)

    toastTimer = window.setTimeout(() => {
      toastVisible.value = false
      toastTimer = null
    }, 3200)
  }

  function handleToastEvent(event: Event): void {
    const detail = event instanceof CustomEvent ? event.detail as ToastEventDetail : {}
    presentToast(detail?.message, detail?.ok)
  }

  onMounted(() => {
    document.addEventListener(TOAST_EVENT_NAME, handleToastEvent)
  })

  onBeforeUnmount(() => {
    document.removeEventListener(TOAST_EVENT_NAME, handleToastEvent)
    clearToastTimers()
  })

  return {
    toastLiveMessage,
    toastMessage,
    toastOk,
    toastVisible,
  }
}
