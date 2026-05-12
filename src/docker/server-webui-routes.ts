import type express from 'express'
import { DOCKER_WEBUI_PAGE_ROUTES, getHtml } from './webui'

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

export function registerWebUiRoutes(app: express.Express): void {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !isDockerWebUiPagePath(req.path)) {
      next()
      return
    }
    res.type('html').send(getHtml())
  })
}
