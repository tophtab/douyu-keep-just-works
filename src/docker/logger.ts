export interface LogEntry {
  timestamp: string
  category: string
  message: string
}

export const MAX_LOGS = 500
const logs: LogEntry[] = []
const LOG_TIMEZONE = 'Asia/Shanghai'

function createTimestamp(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: LOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T')
}

export function addLog(category: string, message: string): void {
  const entry: LogEntry = {
    timestamp: createTimestamp(),
    category,
    message,
  }
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.shift()
  console.log(`[${entry.timestamp}] [${category}] ${message}`)
}

export function getLogs(): LogEntry[] {
  return [...logs]
}

export function clearLogs(): void {
  logs.length = 0
}

export function createLogger(category: string): (msg: string) => void {
  return (msg: string) => addLog(category, msg)
}
