<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Repeat = 'daily' | '0' | '1' | '2' | '3' | '4' | '5' | '6'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const REPEAT_OPTIONS: Array<{ label: string, value: Repeat }> = [
  { label: '每日', value: 'daily' },
  { label: '每周一', value: '1' },
  { label: '每周二', value: '2' },
  { label: '每周三', value: '3' },
  { label: '每周四', value: '4' },
  { label: '每周五', value: '5' },
  { label: '每周六', value: '6' },
  { label: '每周日', value: '0' },
]

const HOUR_MAX = 23
const MINUTE_MAX = 59
const SECOND_MAX = 59

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const popoverStyle = ref<CSSProperties>({})
const open = ref(false)
const repeat = ref<Repeat>('daily')
const hourText = ref('09')
const minuteText = ref('00')
const secondText = ref('00')

const POPOVER_WIDTH = 460
const POPOVER_HEIGHT = 160

/** 本组件刚写出的表达式回到 watch 时不必再回填，避免打断正在输入的文本框。 */
let lastEmitted = ''

const hourValues = computed(() => parseNumberList(hourText.value, HOUR_MAX))
const minuteValue = computed(() => parseSingleValue(minuteText.value, MINUTE_MAX))
const secondValue = computed(() => parseSingleValue(secondText.value, SECOND_MAX))

const hourInvalid = computed(() => hourText.value.trim() !== '' && hourValues.value === null)
const minuteInvalid = computed(() => minuteText.value.trim() !== '' && minuteValue.value === null)
const secondInvalid = computed(() => secondText.value.trim() !== '' && secondValue.value === null)

const summary = computed(() => {
  const repeatLabel = REPEAT_OPTIONS.find(option => option.value === repeat.value)?.label || '每日'
  const hour = hourText.value.trim() || '--'
  const minute = minuteText.value.trim() || '--'
  const second = secondText.value.trim() || '--'
  return `${repeatLabel} ${hour}:${minute}:${second}`
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 解析逗号分隔的数字列表；空项、非数字或越界都视为无效。 */
function parseNumberList(text: string, max: number): number[] | null {
  const tokens = text.split(',').map(token => token.trim())
  if (tokens.length === 0 || tokens.some(token => !/^\d{1,2}$/.test(token))) {
    return null
  }
  const values = tokens.map(Number)
  return values.every(value => value <= max) ? values : null
}

function parseSingleValue(text: string, max: number): number | null {
  const values = parseNumberList(text, max)
  return values && values.length === 1 ? values[0] : null
}

/** 只识别本组件能生成的两类表达式：每日与每周 X。其他 Cron 保持原样不受影响。 */
function syncFromCron(cron: string): void {
  if (cron === lastEmitted) {
    return
  }
  const match = /^(\d{1,2})\s+(\d{1,2})\s+([\d,]+)\s+\*\s+\*\s+(?:\*|([0-7]))$/.exec(cron.trim())
  if (!match) {
    return
  }
  const second = parseSingleValue(match[1], SECOND_MAX)
  const minute = parseSingleValue(match[2], MINUTE_MAX)
  const hours = parseNumberList(match[3], HOUR_MAX)
  if (second === null || minute === null || hours === null) {
    return
  }
  secondText.value = pad(second)
  minuteText.value = pad(minute)
  hourText.value = hours.map(pad).join(',')
  repeat.value = match[4] === undefined ? 'daily' : (match[4] === '7' ? '0' : match[4] as Repeat)
}

function apply(): void {
  const hours = hourValues.value
  const minute = minuteValue.value
  const second = secondValue.value
  if (hours === null || minute === null || second === null) {
    return
  }
  const weekday = repeat.value === 'daily' ? '*' : repeat.value
  const next = `${second} ${minute} ${hours.join(',')} * * ${weekday}`
  if (next === props.modelValue) {
    return
  }
  lastEmitted = next
  emit('update:modelValue', next)
}

function readInput(event: Event): string {
  return (event.target as HTMLInputElement).value
}

/** 中文输入法下容易打出全角逗号，这里统一替换成英文逗号，光标位置保持不变。 */
function normalizeHourInput(input: HTMLInputElement): string {
  const value = input.value
  const normalized = value.replace(/，/g, ',')
  if (normalized !== value) {
    const start = input.selectionStart ?? normalized.length
    const end = input.selectionEnd ?? normalized.length
    input.value = normalized
    input.setSelectionRange(start, end)
  }
  return normalized
}

/** 组合输入期间改值会让输入法提交时再插入一次，必须等 compositionend。 */
function isComposingInput(event: Event): boolean {
  return event instanceof InputEvent && event.isComposing
}

function onHourInput(event: Event): void {
  if (isComposingInput(event)) {
    return
  }
  hourText.value = normalizeHourInput(event.target as HTMLInputElement)
  apply()
}

function onHourCompositionEnd(event: CompositionEvent): void {
  hourText.value = normalizeHourInput(event.target as HTMLInputElement)
  apply()
}

function onMinuteInput(event: Event): void {
  minuteText.value = readInput(event)
  apply()
}

function onSecondInput(event: Event): void {
  secondText.value = readInput(event)
  apply()
}

/** 弹层挂到 body 上用 fixed 定位，避免被卡片背景/堆叠上下文裁切。 */
function updatePosition(): void {
  const anchor = trigger.value
  if (!anchor) {
    return
  }
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32)
  const height = popover.value?.offsetHeight || POPOVER_HEIGHT
  const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))
  const below = rect.bottom + 8
  const top = below + height > window.innerHeight && rect.top > height + 16
    ? rect.top - height - 8
    : below
  popoverStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  }
}

function toggle(): void {
  open.value = !open.value
  if (open.value) {
    updatePosition()
    void nextTick(updatePosition)
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!open.value) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }
  if (root.value?.contains(target) || popover.value?.contains(target)) {
    return
  }
  open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    open.value = false
  }
}

watch(() => props.modelValue, syncFromCron, { immediate: true })

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <div ref="root" class="schedule-picker">
    <button
      ref="trigger"
      class="schedule-trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="`选择定时，当前 ${summary}`"
      :title="`选择定时：${summary}`"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 1.8" />
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="popover"
        class="schedule-popover"
        role="dialog"
        aria-label="选择定时"
        :style="popoverStyle"
      >
        <label class="schedule-field">
          <span class="schedule-label">重复</span>
          <select v-model="repeat" aria-label="重复周期" @change="apply">
            <option v-for="option in REPEAT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="schedule-field">
          <span class="schedule-label">时（0~23，多选时用 , 隔开）</span>
          <input
            :value="hourText"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :class="{ 'is-invalid': hourInvalid }"
            :aria-invalid="hourInvalid"
            aria-label="小时，取值 0 到 23，多个值用逗号隔开"
            @input="onHourInput"
            @compositionend="onHourCompositionEnd"
          >
        </label>
        <label class="schedule-field">
          <span class="schedule-label">分（0~59）</span>
          <input
            :value="minuteText"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :class="{ 'is-invalid': minuteInvalid }"
            :aria-invalid="minuteInvalid"
            aria-label="分钟，取值 0 到 59"
            @input="onMinuteInput"
          >
        </label>
        <label class="schedule-field">
          <span class="schedule-label">秒（0~59）</span>
          <input
            :value="secondText"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :class="{ 'is-invalid': secondInvalid }"
            :aria-invalid="secondInvalid"
            aria-label="秒，取值 0 到 59"
            @input="onSecondInput"
          >
        </label>
      </div>
    </Teleport>
  </div>
</template>
