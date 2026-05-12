export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isMissingCookieMessage(message: string): boolean {
  return message === '请先配置 cookie'
}

export function isCookieSourceConfigMessage(message: string): boolean {
  return isMissingCookieMessage(message) || message.includes('配置不完整')
}
