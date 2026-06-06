export { errorMessage } from '../core/errors'

export function isMissingCookieMessage(message: string): boolean {
  return message === '请先配置 cookie'
}

export function isCookieCredentialMessage(message: string): boolean {
  return isMissingCookieMessage(message)
    || message.includes('本地登录快照为空')
    || message.includes('Cookie中没有找到')
    || message.includes('Cookie 弹幕鉴权失败')
    || message.includes('主站 Cookie 缺少')
    || message.includes('请检查主站 Cookie')
    || message.includes('请检查鱼吧登录态')
    || message.includes('请检查 Cookie')
    || message.includes('鱼吧 Cookie')
    || message.includes('dy-token')
    || message.includes('未登录')
    || message.includes('登录态')
}

export function isCookieSourceConfigMessage(message: string): boolean {
  return isMissingCookieMessage(message) || message.includes('配置不完整') || message.includes('本地登录快照为空')
}
