import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { parseCookieRecord } from '../core/api'
import { createDouyuPassportDeviceCookie, fetchDouyuMainCookiesFromLoginUrl, fetchDouyuYubaCookiesWithPassport, generateDouyuPassportQrChallenge, pollDouyuPassportQrAuth } from '../core/douyu-passport'
import { errorMessage } from '../core/errors'
import type { DockerConfig, PassportQrLoginPublicStatus, PassportQrLoginStatus } from '../core/types'

const PASSPORT_QR_IMAGE_SIZE = 240

interface PassportQrLoginSession {
  id: string
  code: string
  expiresAt: number
  qrImageDataUrl?: string
  status: PassportQrLoginStatus
  message: string
  passportCookie?: string
  loginUrl?: string
  mainCookie?: string
  yubaCookie?: string
  error?: string
}

interface PassportQrLoginDeps {
  getCurrentMainCookie: () => string
  getCurrentYubaCookie: () => string
  getManualPassportCookie: () => string
  persistCookieSnapshot: (args: {
    passportCookie: string
    mainCookie: string
    yubaCookie?: string
  }) => DockerConfig
}

function isTerminalPassportQrStatus(status: PassportQrLoginStatus): boolean {
  return ['yuba_saved', 'yuba_failed', 'expired', 'cancelled', 'failed'].includes(status)
}

export class DockerPassportQrLoginService {
  private session: PassportQrLoginSession | null = null

  constructor(private readonly deps: PassportQrLoginDeps) {}

  async start(): Promise<PassportQrLoginPublicStatus> {
    const passportCookie = createDouyuPassportDeviceCookie()
    const challenge = await generateDouyuPassportQrChallenge(Date.now(), passportCookie)
    const qrImageDataUrl = await QRCode.toDataURL(challenge.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: PASSPORT_QR_IMAGE_SIZE,
    })
    this.session = {
      id: randomUUID(),
      code: challenge.code,
      expiresAt: challenge.expiresAt,
      qrImageDataUrl,
      status: 'waiting',
      message: '等待扫码',
      passportCookie,
    }
    return this.toPublicStatus(this.session)
  }

  getStatus(): PassportQrLoginPublicStatus | null {
    const session = this.session
    if (!session) {
      return null
    }
    this.markExpiredIfNeeded(session)
    return this.toPublicStatus(session)
  }

  async poll(): Promise<PassportQrLoginPublicStatus> {
    const session = this.session
    if (!session) {
      throw new Error('扫码登录会话不存在')
    }
    this.markExpiredIfNeeded(session)
    if (isTerminalPassportQrStatus(session.status)) {
      return this.toPublicStatus(session)
    }

    try {
      if (session.status === 'waiting' || session.status === 'scanned') {
        const pollResult = await pollDouyuPassportQrAuth(session.code, session.passportCookie || '')
        if (pollResult.status === 'waiting' || pollResult.status === 'scanned') {
          session.status = pollResult.status
          session.message = pollResult.status === 'scanned' ? '已扫码，等待确认' : '等待扫码'
          return this.toPublicStatus(session)
        }
        if (pollResult.status === 'expired' || pollResult.status === 'cancelled' || pollResult.status === 'failed') {
          session.status = pollResult.status
          session.message = pollResult.message
          return this.toPublicStatus(session)
        }

        session.status = 'passport_confirmed'
        session.message = 'passport 已确认，正在获取主站登录态'
        session.passportCookie = pollResult.passportCookie
        session.loginUrl = pollResult.loginUrl
        return this.toPublicStatus(session)
      }

      if (session.status === 'passport_confirmed') {
        await this.completeMainSnapshot(session)
        return this.toPublicStatus(session)
      }

      if (session.status === 'main_saved') {
        await this.completeYubaSnapshot(session)
        return this.toPublicStatus(session)
      }
    } catch (error: unknown) {
      session.status = 'failed'
      session.message = '扫码登录失败'
      session.error = errorMessage(error)
    }

    return this.toPublicStatus(session)
  }

  cancel(): PassportQrLoginPublicStatus | null {
    const session = this.session
    if (!session) {
      return null
    }
    if (!isTerminalPassportQrStatus(session.status)) {
      session.status = 'cancelled'
      session.message = '扫码登录已取消'
    }
    return this.toPublicStatus(session)
  }

  async retryYuba(): Promise<PassportQrLoginPublicStatus> {
    const currentSession = this.session
    const passportCookie = currentSession?.passportCookie || this.deps.getManualPassportCookie()
    const mainCookie = currentSession?.mainCookie || this.deps.getCurrentMainCookie()
    if (!passportCookie || !mainCookie) {
      throw new Error('鱼吧重试缺少已保存的 passport 或主站登录态')
    }

    const session: PassportQrLoginSession = currentSession || {
      id: randomUUID(),
      code: '',
      expiresAt: Date.now(),
      status: 'main_saved',
      message: '主站已保存，正在获取鱼吧登录态',
      passportCookie,
      mainCookie,
    }
    this.session = session
    session.status = 'main_saved'
    session.message = '主站已保存，正在获取鱼吧登录态'
    session.error = undefined

    try {
      await this.completeYubaSnapshot(session)
    } catch (error: unknown) {
      session.status = 'yuba_failed'
      session.message = '鱼吧登录态获取失败，可重试'
      session.error = errorMessage(error)
    }

    return this.toPublicStatus(session)
  }

  private markExpiredIfNeeded(session: PassportQrLoginSession): void {
    if ((session.status === 'waiting' || session.status === 'scanned') && Date.now() >= session.expiresAt) {
      session.status = 'expired'
      session.message = '扫码登录已过期'
    }
  }

  private toPublicStatus(session: PassportQrLoginSession): PassportQrLoginPublicStatus {
    const passportSaved = Boolean(parseCookieRecord(session.passportCookie || '').LTP0)
    const mainSaved = Boolean(session.mainCookie)
    const yubaSaved = Boolean(session.yubaCookie) || session.status === 'yuba_saved'
    const canRetryYuba = session.status === 'yuba_failed' && passportSaved && mainSaved
    const showQrImage = (session.status === 'waiting' || session.status === 'scanned') && Boolean(session.qrImageDataUrl)

    return {
      sessionId: session.id,
      status: session.status,
      message: session.message,
      expiresAt: session.expiresAt,
      ...(showQrImage ? { qrImageDataUrl: session.qrImageDataUrl } : {}),
      passportSaved,
      mainSaved,
      yubaSaved,
      canRetryYuba,
      finished: isTerminalPassportQrStatus(session.status),
      ...(session.error ? { error: session.error } : {}),
    }
  }

  private async completeMainSnapshot(session: PassportQrLoginSession): Promise<void> {
    if (!session.passportCookie || !session.loginUrl) {
      throw new Error('扫码登录缺少 passport 或主站登录地址')
    }

    const mainResult = await fetchDouyuMainCookiesFromLoginUrl({
      loginUrl: session.loginUrl,
      mainCookie: this.deps.getCurrentMainCookie(),
      passportCookie: session.passportCookie,
    })
    session.mainCookie = mainResult.refreshedCookie
    this.deps.persistCookieSnapshot({
      passportCookie: session.passportCookie,
      mainCookie: session.mainCookie,
    })
    session.status = 'main_saved'
    session.message = '主站已保存，正在获取鱼吧登录态'
  }

  private async completeYubaSnapshot(session: PassportQrLoginSession): Promise<void> {
    if (!session.passportCookie || !session.mainCookie) {
      throw new Error('鱼吧 SSO 缺少 passport 或主站登录态')
    }

    try {
      const yubaResult = await fetchDouyuYubaCookiesWithPassport({
        passportCookie: session.passportCookie,
        mainCookie: session.mainCookie,
        yubaCookie: this.deps.getCurrentYubaCookie(),
      })
      session.yubaCookie = yubaResult.yubaCookie
      this.deps.persistCookieSnapshot({
        passportCookie: session.passportCookie,
        mainCookie: session.mainCookie,
        yubaCookie: session.yubaCookie,
      })
      session.status = 'yuba_saved'
      session.message = '登录快照已保存'
    } catch (error: unknown) {
      session.status = 'yuba_failed'
      session.message = '鱼吧登录态获取失败，可重试'
      session.error = errorMessage(error)
    }
  }
}
