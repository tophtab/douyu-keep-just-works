import * as fs from 'fs'
import * as path from 'path'
import { CronJob } from 'cron'
import { executeKeepaliveJob, executeDoubleCardJob } from '../core/job'
import type { DockerConfig } from '../core/types'

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'

function log(message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

function loadConfig(): DockerConfig {
  const configPath = path.resolve(CONFIG_PATH)
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`)
  }
  const raw = fs.readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw) as DockerConfig
  if (!config.cookie) throw new Error('配置缺少 cookie 字段')
  if (!config.keepalive && !config.doubleCard) throw new Error('配置至少需要 keepalive 或 doubleCard 其中之一')
  return config
}

function main(): void {
  log('斗鱼粉丝牌续牌 Docker 版启动')
  let config: DockerConfig
  try {
    config = loadConfig()
    const parts: string[] = []
    if (config.keepalive) parts.push(`保活 cron: ${config.keepalive.cron}, 房间数: ${Object.keys(config.keepalive.send).length}`)
    if (config.doubleCard) parts.push(`双倍 cron: ${config.doubleCard.cron}, 房间数: ${Object.keys(config.doubleCard.send).length}`)
    log(`配置加载成功, ${parts.join(', ')}`)
  } catch (error: any) {
    log(`配置加载失败: ${error.message}`)
    process.exit(1)
  }

  const jobs: CronJob[] = []

  if (config.keepalive) {
    const keepaliveConfig = config.keepalive
    const runKeepalive = async () => {
      log('[保活] 开始执行任务...')
      try {
        await executeKeepaliveJob(keepaliveConfig, config.cookie, msg => log(`[保活] ${msg}`))
      } catch (error: any) {
        log(`[保活] 任务执行出错: ${error.message || error}`)
      }
    }
    runKeepalive()
    const job = new CronJob(keepaliveConfig.cron, () => { runKeepalive() }, null, false, 'Asia/Shanghai')
    job.start()
    jobs.push(job)
    log(`[保活] 定时任务已启动, cron: ${keepaliveConfig.cron}`)
  }

  if (config.doubleCard) {
    const doubleCardConfig = config.doubleCard
    const runDoubleCard = async () => {
      log('[双倍] 开始执行任务...')
      try {
        await executeDoubleCardJob(doubleCardConfig, config.cookie, msg => log(`[双倍] ${msg}`))
      } catch (error: any) {
        log(`[双倍] 任务执行出错: ${error.message || error}`)
      }
    }
    runDoubleCard()
    const job = new CronJob(doubleCardConfig.cron, () => { runDoubleCard() }, null, false, 'Asia/Shanghai')
    job.start()
    jobs.push(job)
    log(`[双倍] 定时任务已启动, cron: ${doubleCardConfig.cron}`)
  }

  const shutdown = () => {
    log('收到停止信号，正在关闭...')
    jobs.forEach(j => j.stop())
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main()
