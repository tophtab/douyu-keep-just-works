export function formatDate(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).format(date)
  } catch {
    return formatShanghaiMinuteFallback(date)
  }
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function formatShanghaiMinuteFallback(date: Date): string {
  const shanghaiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return `${shanghaiTime.getUTCFullYear()}-${padDatePart(shanghaiTime.getUTCMonth() + 1)}-${padDatePart(shanghaiTime.getUTCDate())} ${padDatePart(shanghaiTime.getUTCHours())}:${padDatePart(shanghaiTime.getUTCMinutes())}`
}
