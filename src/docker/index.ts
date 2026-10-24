import * as path from 'node:path'
import process from 'node:process'
import { startDockerRuntime } from './runtime'

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve('config/config.json')
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '51417', 10)
const WEB_PASSWORD = process.env.WEB_PASSWORD || 'password'

startDockerRuntime({
  configPath: CONFIG_PATH,
  webPassword: WEB_PASSWORD,
  webPort: WEB_PORT,
})
