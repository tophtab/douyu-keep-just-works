import express from 'express'
import { createAuthHandlers } from './server-auth'
import { registerConfigRoutes } from './server-config-routes'
import { registerCookieSourceRoutes } from './server-cookie-source-routes'
import { registerFansRoutes } from './server-fans-routes'
import { registerTaskRoutes } from './server-task-routes'
import type { AppContext, JobStatus } from './server-types'
import { isDockerWebUiPagePath, registerWebUiRoutes } from './server-webui-routes'

export type { AppContext, JobStatus }

export function createServer(ctx: AppContext): express.Express {
  const app = express()
  const auth = createAuthHandlers(ctx)

  app.use(express.json())

  registerWebUiRoutes(app, ctx)
  auth.registerAuthRoutes(app)
  auth.registerProtectedBoundary(app, isDockerWebUiPagePath)
  registerConfigRoutes(app, ctx)
  registerFansRoutes(app, ctx)
  registerCookieSourceRoutes(app, ctx)
  registerTaskRoutes(app, ctx)

  return app
}
