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
const WEBUI_SCRIPT_PATHS = [
  path.join(__dirname, 'webui', 'app-data.js'),
  path.join(__dirname, 'webui', 'app-routing.js'),
  path.join(__dirname, 'webui', 'app.js'),
]

let cachedTemplate: string | null = null
let cachedStyles: string | null = null
let cachedScripts: string | null = null

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

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function readTemplate(): string {
  if (!cachedTemplate) {
    cachedTemplate = readTextFile(WEBUI_TEMPLATE_PATH)
  }
  return cachedTemplate
}

function readStyles(): string {
  if (!cachedStyles) {
    cachedStyles = readTextFile(WEBUI_STYLES_PATH)
  }
  return cachedStyles
}

function readScript(): string {
  if (!cachedScripts) {
    cachedScripts = WEBUI_SCRIPT_PATHS.map(readTextFile).join('\n;\n')
  }
  return cachedScripts
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
