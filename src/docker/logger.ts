export interface LogEntry {
  timestamp: string
  category: string
  message: string
}

const MAX_LOGS = 500
const logs: LogEntry[] = []

export function addLog(category: string, message: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
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
