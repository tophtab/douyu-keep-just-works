import express from 'express'
import { DOCKER_WEBUI_PAGE_ROUTES, getHtml, WEBUI_ASSET_ROOT } from './webui'
import type { AppContext } from './server-types'

const DOCKER_WEBUI_PAGE_PATHS = new Set<string>(Object.values(DOCKER_WEBUI_PAGE_ROUTES))

function normalizePagePath(path: string): string {
  if (!path || path === '/') {
    return '/'
  }
  return path.replace(/\/+$/, '') || '/'
}

export function isDockerWebUiPagePath(path: string): boolean {
  return DOCKER_WEBUI_PAGE_PATHS.has(normalizePagePath(path))
}

export function registerWebUiRoutes(app: express.Express, ctx: AppContext): void {
  app.use(express.static(WEBUI_ASSET_ROOT, {
    fallthrough: true,
    index: false,
  }))

  app.use((req, res, next) => {
    if (req.method !== 'GET' || !isDockerWebUiPagePath(req.path)) {
      next()
      return
    }
    res.type('html').send(getHtml(ctx.getConfig()?.ui?.themeMode))
  })
}
