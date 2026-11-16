import { ConfigError, loadConfig } from './config.ts'
import { createLogger } from './logger.ts'
import { createApp } from './server.ts'

let config
try {
  config = loadConfig(process.env)
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
}

const log = createLogger(config.logLevel)
const server = createApp(config, log)

server.listen(config.port, () => {
  log.info('curry-api listening', {
    port: config.port,
    env: config.env,
    version: config.version,
    providersEnabled: Object.keys(config.providers),
  })
})

function shutdown(signal: string): void {
  log.info('shutting down', { signal })
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
