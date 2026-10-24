import * as path from 'node:path'
import process from 'node:process'
import { startDockerRuntime } from './runtime'

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve('config/config.json')
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '51417', 10)

startDockerRuntime({
  configPath: CONFIG_PATH,
  webPort: WEB_PORT,
})
