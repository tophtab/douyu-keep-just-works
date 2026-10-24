import * as fs from 'node:fs'
import * as path from 'node:path'

export interface LogEntry {
  timestamp: string
  category: string
  message: string
}

/** 内存里保留的条数（WebUI 实时视图） */
export const MAX_LOGS = 500
/** 磁盘日志保留天数 */
export const MAX_LOG_DAYS = 30
/** 单日文件读取上限，防止异常大的文件把前端撑爆 */
const MAX_READ_ENTRIES = 5000
const LOG_TIMEZONE = 'Asia/Shanghai'

const logs: LogEntry[] = []
let logDir: string | null = null
/** 已经 chmod 过的日期，避免每写一行都 chmod 一次 */
const chmoddedDays = new Set<string>()

/**
 * 这个 NAS 的 btrfs 卷挂载带 trimacl，新建文件/目录的默认权限是 0000，
 * 必须显式 chmod，否则非 root 读不到、备份工具也会跳过。
 */
function ensureFileMode(file: string, mode: number): void {
  try {
    fs.chmodSync(file, mode)
  } catch {
    // 某些挂载点不支持 chmod，忽略
  }
}

/**
 * 脱敏：日志会落盘，cookie/token 一类值不能留原文。
 * 只替换「键=值」里的值部分，保留键名便于排障。
 */
const SCRUB_RULES: Array<[RegExp, string]> = [
  // 顺序有讲究：先处理「值里带空格」的形态（Bearer xxx），
  // 否则通用键规则会先把 "Bearer" 这个词当成值替换掉，真正的 token 反而留在明文里。
  [/(Bearer\s+)[\w.-]{12,}/gi, '$1***'],
  [/(github_pat_)\w{10,}/g, '$1***'],
  // 斗鱼各类 cookie：LTP0=xxx; acf_auth=xxx ...
  [/((?:LTP0|dy_did|dy_auth|acf_auth|acf_stk|acf_ltkid|acf_uid|acf_biz|acf_ct|acf_yb_auth|acf_yb_uid|acf_yb_t|acf_dmjwt_token|acf_username)\s*=\s*)([^;,\s"']+)/gi, '$1***'],
  // 通用敏感键
  [/((?:token|password|passwd|secret|api[_-]?key|access[_-]?token|authorization)\s*[=:]\s*)([^\s"',;]{4,})/gi, '$1***'],
]

export function scrubSensitive(text: string): string {
  let next = text
  for (const [pattern, replacement] of SCRUB_RULES) {
    next = next.replace(pattern, replacement)
  }
  return next
}

function formatShanghai(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: LOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T')
}

function createTimestamp(): string {
  return formatShanghai(new Date())
}

/** timestamp 本身是上海时区的 YYYY-MM-DDTHH:mm:ss，前 10 位即日期键 */
function dayKeyOf(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function todayKey(): string {
  return dayKeyOf(createTimestamp())
}

function fileForDay(day: string): string {
  return path.join(logDir as string, `${day}.jsonl`)
}

function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function appendToFile(entry: LogEntry): void {
  if (!logDir) {
    return
  }
  const day = dayKeyOf(entry.timestamp)
  const file = fileForDay(day)
  try {
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf-8')
    if (!chmoddedDays.has(day)) {
      ensureFileMode(file, 0o600)
      chmoddedDays.add(day)
    }
  } catch {
    // 磁盘只读/写满时不影响主流程，日志仍可在内存与 docker logs 里看到
  }
}

function readDayFile(day: string): LogEntry[] {
  if (!logDir) {
    return []
  }
  let raw: string
  try {
    raw = fs.readFileSync(fileForDay(day), 'utf-8')
  } catch {
    return []
  }
  const entries: LogEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue
    }
    try {
      const parsed = JSON.parse(line) as Partial<LogEntry>
      if (typeof parsed.timestamp === 'string' && typeof parsed.message === 'string') {
        entries.push({
          timestamp: parsed.timestamp,
          category: typeof parsed.category === 'string' ? parsed.category : '系统',
          message: parsed.message,
        })
      }
    } catch {
      // 进程被杀时可能留下半行，跳过
    }
  }
  return entries.length > MAX_READ_ENTRIES ? entries.slice(-MAX_READ_ENTRIES) : entries
}

function pruneOldFiles(): void {
  if (!logDir) {
    return
  }
  const cutoffKey = dayKeyOf(formatShanghai(new Date(Date.now() - (MAX_LOG_DAYS - 1) * 24 * 60 * 60 * 1000)))

  let files: string[]
  try {
    files = fs.readdirSync(logDir)
  } catch {
    return
  }
  for (const name of files) {
    const match = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name)
    if (!match) {
      continue
    }
    if (match[1] < cutoffKey) {
      try {
        fs.unlinkSync(path.join(logDir, name))
      } catch {
        // 删除失败不阻断启动
      }
    }
  }
}

/**
 * 初始化日志存储：建目录、清理过期文件、把今天的日志回填进内存。
 * 必须在第一条 addLog 之前调用（runtime 启动时）。
 */
export function initLogStore(dir: string): void {
  logDir = dir
  try {
    fs.mkdirSync(dir, { recursive: true })
    ensureFileMode(dir, 0o700)
  } catch {
    logDir = null
    return
  }
  pruneOldFiles()

  const restored = readDayFile(todayKey())
  if (restored.length) {
    logs.length = 0
    logs.push(...restored.slice(-MAX_LOGS))
  }
}

export function isLogStoreEnabled(): boolean {
  return logDir !== null
}

export function addLog(category: string, message: string): void {
  const entry: LogEntry = {
    timestamp: createTimestamp(),
    category,
    message: scrubSensitive(message),
  }
  logs.push(entry)
  if (logs.length > MAX_LOGS) {
    logs.shift()
  }
  console.log(`[${entry.timestamp}] [${entry.category}] ${entry.message}`)
  appendToFile(entry)
}

/** 内存中的实时日志（今天、最近 MAX_LOGS 条） */
export function getLogs(): LogEntry[] {
  return [...logs]
}

/** 指定日期的日志；传今天时返回内存视图，保证与页面实时一致 */
export function getLogsForDay(day: string): LogEntry[] {
  if (!isDayKey(day)) {
    return []
  }
  if (day === todayKey()) {
    return [...logs]
  }
  return readDayFile(day)
}

/** 可查看的历史日期（倒序，含今天） */
export function listLogDays(): string[] {
  const days = new Set<string>([todayKey()])
  if (!logDir) {
    return [...days]
  }
  let files: string[]
  try {
    files = fs.readdirSync(logDir)
  } catch {
    return [...days]
  }
  for (const name of files) {
    const match = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name)
    if (match) {
      days.add(match[1])
    }
  }
  return [...days].sort().reverse()
}

/** 清空内存与今天的文件；历史日期不受影响 */
export function clearLogs(): void {
  logs.length = 0
  if (!logDir) {
    return
  }
  try {
    const file = fileForDay(todayKey())
    fs.writeFileSync(file, '', 'utf-8')
    ensureFileMode(file, 0o600)
    chmoddedDays.delete(todayKey())
  } catch {
    // 忽略
  }
}

export function createLogger(category: string): (msg: string) => void {
  return (msg: string) => addLog(category, msg)
}
