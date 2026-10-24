import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * WebUI 登录密码存储。
 *
 * 优先级：`config/auth.json`（界面里改过） > 环境变量 WEB_PASSWORD > 内置默认值。
 * 落盘只存 scrypt 派生值 + 随机盐，不保存明文；文件权限 0600。
 */
export type PasswordSource = 'file' | 'env' | 'default'

export interface PasswordInfo {
  source: PasswordSource
  updatedAt?: string
  hint?: string
}

const MAX_HINT_LENGTH = 100

interface PasswordFile {
  version: number
  algo: 'scrypt'
  salt: string
  hash: string
  updatedAt: string
  /** 登录页展示的密码提示（明文，用户自愿填写，不含密码本身） */
  hint?: string
}

const MIN_PASSWORD_LENGTH = 6
const MAX_PASSWORD_LENGTH = 128
const SCRYPT_KEY_LENGTH = 64
const DEFAULT_PASSWORD = 'password'

function derive(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // 长度不同也要走一次比较，避免明显的时间差
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export class WebPasswordStore {
  private file: PasswordFile | null = null
  // 提示单独存文件：与「是否改过密码」解耦，用环境变量密码时也能设置提示
  private hintValue = ''
  private hintPath = ''

  constructor(private readonly options: { filePath: string, initialPassword: string }) {
    this.hintPath = path.join(path.dirname(options.filePath), 'auth-hint.json')
    this.loadFromDisk()
    this.loadHint()
  }

  private loadHint(): void {
    try {
      if (!fs.existsSync(this.hintPath)) {
        // 兼容：早期把 hint 存在 auth.json 里，读到就迁移出来
        if (this.file?.hint) {
          this.hintValue = this.file.hint
          this.writeHint(this.hintValue)
        }
        return
      }
      const parsed = JSON.parse(fs.readFileSync(this.hintPath, 'utf-8')) as { hint?: unknown }
      this.hintValue = typeof parsed.hint === 'string' ? parsed.hint.slice(0, MAX_HINT_LENGTH) : ''
    } catch {
      this.hintValue = ''
    }
  }

  private writeHint(hint: string): void {
    const dir = path.dirname(this.hintPath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${this.hintPath}.tmp`
    const payload = JSON.stringify({ hint, updatedAt: new Date().toISOString() }, null, 2)
    fs.writeFileSync(tmp, payload, { encoding: 'utf-8', mode: 0o600 })
    fs.renameSync(tmp, this.hintPath)
    try {
      fs.chmodSync(this.hintPath, 0o600)
    } catch {
      // 某些挂载点不支持 chmod，忽略
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.options.filePath)) {
        this.file = null
        return
      }
      const raw = fs.readFileSync(this.options.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PasswordFile>
      if (parsed.algo !== 'scrypt' || typeof parsed.salt !== 'string' || typeof parsed.hash !== 'string') {
        this.file = null
        return
      }
      this.file = {
        version: parsed.version ?? 1,
        algo: 'scrypt',
        salt: parsed.salt,
        hash: parsed.hash,
        updatedAt: parsed.updatedAt || '',
        hint: typeof parsed.hint === 'string' ? parsed.hint.slice(0, MAX_HINT_LENGTH) : undefined,
      }
    } catch {
      // 文件损坏时回退到环境变量密码，不让整个服务起不来
      this.file = null
    }
  }

  info(): PasswordInfo {
    if (this.file) {
      return {
        source: 'file',
        updatedAt: this.file.updatedAt || undefined,
        hint: this.hintValue || undefined,
      }
    }
    const initial = this.options.initialPassword || ''
    if (initial && initial !== DEFAULT_PASSWORD) {
      return { source: 'env', hint: this.hintValue || undefined }
    }
    return { source: 'default', hint: this.hintValue || undefined }
  }

  verify(password: string): boolean {
    if (!password) {
      return false
    }
    if (this.file) {
      return safeEqual(derive(password, this.file.salt), this.file.hash)
    }
    return safeEqual(password, this.options.initialPassword || '')
  }

  /** 登录页用：只返回提示文本，不暴露任何账号状态 */
  hint(): string {
    return this.hintValue.trim()
  }

  /** 设置/清除密码提示；传空串即清除。不依赖是否改过密码 */
  setHint(hint: string): { ok: boolean, error?: string, hint?: string } {
    const trimmed = hint.trim().slice(0, MAX_HINT_LENGTH)
    try {
      this.writeHint(trimmed)
      this.hintValue = trimmed
      return { ok: true, hint: trimmed }
    } catch (error: unknown) {
      return { ok: false, error: `保存提示失败：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  change(currentPassword: string, nextPassword: string): { ok: boolean, error?: string } {
    if (!this.verify(currentPassword)) {
      return { ok: false, error: '当前密码不正确' }
    }
    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      return { ok: false, error: `新密码至少 ${MIN_PASSWORD_LENGTH} 位` }
    }
    if (nextPassword.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, error: `新密码不能超过 ${MAX_PASSWORD_LENGTH} 位` }
    }
    if (nextPassword === currentPassword) {
      return { ok: false, error: '新密码不能与当前密码相同' }
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const next: PasswordFile = {
      version: 1,
      algo: 'scrypt',
      salt,
      hash: derive(nextPassword, salt),
      updatedAt: new Date().toISOString(),
    }

    try {
      this.writeFile(next)
      this.file = next
      return { ok: true }
    } catch (error: unknown) {
      return { ok: false, error: `保存密码失败：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  private writeFile(payload: PasswordFile): void {
    const dir = path.dirname(this.options.filePath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${this.options.filePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 })
    fs.renameSync(tmp, this.options.filePath)
    try {
      fs.chmodSync(this.options.filePath, 0o600)
    } catch {
      // 某些挂载点不支持 chmod，忽略
    }
  }
}
