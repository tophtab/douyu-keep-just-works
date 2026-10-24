import { computed, onMounted, ref } from 'vue'
import { requestJson } from './request'
import { showToast } from './toast'

export interface PasswordInfo {
  source: 'file' | 'env' | 'default'
  updatedAt?: string
  hint?: string
}

const SOURCE_LABELS: Record<PasswordInfo['source'], string> = {
  file: '已在界面自定义',
  env: '来自环境变量 WEB_PASSWORD',
  default: '仍在使用默认密码',
}

export function formatPasswordTime(value?: string): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function passwordStrength(password: string): { level: 'weak' | 'medium' | 'strong', text: string } {
  if (!password) {
    return { level: 'weak', text: '' }
  }
  let score = 0
  if (password.length >= 8) {
    score += 1
  }
  if (password.length >= 12) {
    score += 1
  }
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1
  }
  if (/\d/.test(password)) {
    score += 1
  }
  if (/[^A-Z0-9]/i.test(password)) {
    score += 1
  }

  if (score <= 1) {
    return { level: 'weak', text: '强度：弱' }
  }
  if (score <= 3) {
    return { level: 'medium', text: '强度：中' }
  }
  return { level: 'strong', text: '强度：强' }
}

export function useSecurityPage() {
  const info = ref<PasswordInfo | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  const currentPassword = ref('')
  const newPassword = ref('')
  const confirmPassword = ref('')

  const hintInput = ref('')
  const hintSaving = ref(false)
  const hintSaved = ref(false)

  const strength = computed(() => passwordStrength(newPassword.value))
  const sourceLabel = computed(() => (info.value ? SOURCE_LABELS[info.value.source] : '—'))
  const isDefaultPassword = computed(() => info.value?.source === 'default')
  const mismatch = computed(() => Boolean(confirmPassword.value) && newPassword.value !== confirmPassword.value)
  const canSubmit = computed(() => Boolean(
    currentPassword.value
    && newPassword.value.length >= 6
    && newPassword.value === confirmPassword.value
    && !saving.value,
  ))

  async function loadInfo(): Promise<void> {
    loading.value = true
    try {
      info.value = await requestJson<PasswordInfo>('/api/auth/password-info', {
        errorToast: '加载密码状态失败：',
      })
      hintInput.value = info.value?.hint || ''
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      loading.value = false
    }
  }

  async function saveHint(): Promise<void> {
    hintSaving.value = true
    hintSaved.value = false
    try {
      await requestJson('/api/auth/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hint: hintInput.value.trim() }),
        errorToast: '保存密码提示失败：',
      })
      hintSaved.value = true
      showToast(hintInput.value.trim() ? '密码提示已保存' : '密码提示已清除', true)
      await loadInfo()
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      hintSaving.value = false
    }
  }

  async function submit(): Promise<void> {
    if (!canSubmit.value) {
      return
    }
    saving.value = true
    try {
      await requestJson('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.value,
          newPassword: newPassword.value,
        }),
        errorToast: '修改密码失败：',
      })
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      showToast('密码已更新，其他设备需重新登录', true)
      await loadInfo()
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    void loadInfo()
  })

  return {
    canSubmit,
    confirmPassword,
    currentPassword,
    hintInput,
    hintSaved,
    hintSaving,
    info,
    isDefaultPassword,
    loadInfo,
    loading,
    mismatch,
    newPassword,
    saveHint,
    saving,
    sourceLabel,
    strength,
    submit,
  }
}
