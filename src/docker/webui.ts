import * as fs from 'node:fs'
import * as path from 'node:path'

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
const WEBUI_TEMPLATE_PATH = path.join(__dirname, 'webui', 'index.html')
const WEBUI_STYLES_PATH = path.join(__dirname, 'webui', 'styles.css')
const WEBUI_SCRIPT_PATH = path.join(__dirname, 'webui', 'app.js')

let cachedTemplate: string | null = null
let cachedStyles: string | null = null
let cachedScript: string | null = null

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

function readTemplate(): string {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(WEBUI_TEMPLATE_PATH, 'utf8')
  }
  return cachedTemplate
}

function readStyles(): string {
  if (!cachedStyles) {
    cachedStyles = fs.readFileSync(WEBUI_STYLES_PATH, 'utf8')
  }
  return cachedStyles
}

function readScript(): string {
  if (!cachedScript) {
    cachedScript = fs.readFileSync(WEBUI_SCRIPT_PATH, 'utf8')
  }
  return cachedScript
}

export function getHtml(): string {
  let html = readTemplate()
  html = replaceToken(html, '__WEBUI_STYLES__', readStyles())
  html = replaceToken(html, '__WEBUI_SCRIPT__', readScript())
  html = replaceToken(html, '__APP_NAME__', escapeHtml(APP_NAME))
  html = replaceToken(html, '__APP_VERSION_LABEL__', escapeHtml(APP_VERSION_LABEL))
  html = replaceToken(html, '__DOCKER_WEBUI_PAGE_ROUTES_JSON__', JSON.stringify(DOCKER_WEBUI_PAGE_ROUTES))
  return html
}
