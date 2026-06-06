import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ThemeMode } from '../core/types'

export const DOCKER_WEBUI_PAGE_ROUTES = {
  'overview': '/',
  'login': '/Configurations/LoginConfig',
  'collect': '/Configurations/CollectGiftConfig',
  'keepalive': '/Configurations/DailyJobConfig',
  'double-card': '/Configurations/DoubleCardConfig',
  'expiring-gift': '/Configurations/ExpiringGiftConfig',
  'yuba': '/Configurations/YubaCheckInConfig',
  'logs': '/Logs',
} as const

const APP_NAME = 'douyu-keep'
const APP_VERSION = readPackageVersion()
const APP_VERSION_LABEL = `V${APP_VERSION}`
export const WEBUI_ASSET_ROOT = path.join(__dirname, 'webui')
const WEBUI_TEMPLATE_PATH = path.join(WEBUI_ASSET_ROOT, 'index.html')
const THEME_COLOR_BY_MODE: Record<'light' | 'dark', string> = {
  dark: '#000000',
  light: '#f4ede4',
}

let cachedTemplate: string | null = null

function readPackageVersion(): string {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version?: unknown }
    return typeof packageJson.version === 'string' && packageJson.version.trim()
      ? packageJson.version.trim()
      : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function replaceToken(source: string, token: string, value: string): string {
  return source.split(token).join(value)
}

function resolveThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function resolveInitialTheme(themeMode: ThemeMode): 'light' | 'dark' {
  return themeMode === 'light' ? 'light' : 'dark'
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function readTemplate(): string {
  if (!cachedTemplate) {
    cachedTemplate = readTextFile(WEBUI_TEMPLATE_PATH)
  }
  return cachedTemplate
}

export function getHtml(themeMode: unknown = 'system'): string {
  const initialThemeMode = resolveThemeMode(themeMode)
  const initialTheme = resolveInitialTheme(initialThemeMode)
  let html = readTemplate()
  html = replaceToken(html, '__APP_NAME__', escapeHtml(APP_NAME))
  html = replaceToken(html, '__APP_VERSION_LABEL__', escapeHtml(APP_VERSION_LABEL))
  html = replaceToken(html, '__DOCKER_WEBUI_PAGE_ROUTES_JSON__', JSON.stringify(DOCKER_WEBUI_PAGE_ROUTES))
  html = replaceToken(html, '__INITIAL_THEME_MODE__', escapeHtml(initialThemeMode))
  html = replaceToken(html, '__INITIAL_THEME__', escapeHtml(initialTheme))
  html = replaceToken(html, '__INITIAL_THEME_COLOR__', escapeHtml(THEME_COLOR_BY_MODE[initialTheme]))
  return html
}
