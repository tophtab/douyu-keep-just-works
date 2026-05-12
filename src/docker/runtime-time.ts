import { DOCKER_TIMEZONE } from './runtime-constants'

export function createStatusTimestamp(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DOCKER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T')
}

export function formatScheduleForLog(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${new Intl.DateTimeFormat('sv-SE', {
    timeZone: DOCKER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)}  (UTC+08:00)`
}
