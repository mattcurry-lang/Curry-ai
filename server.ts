import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { AppError, toPublicError } from '@curry/shared'
import type { AppConfig } from './config.ts'
import type { Logger } from './logger.ts'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-site',
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

export function createApp(config: AppConfig, log: Logger): Server {
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const started = Date.now()
    const inbound = req.headers['x-request-id']
    const requestId = typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID()
    const method = req.method ?? 'GET'
    const path = new URL(req.url ?? '/', 'http://localhost').pathname

    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
    res.setHeader('X-Request-Id', requestId)

    // CORS: exact-match allowlist only. Never reflect an unknown origin.
    const origin = req.headers.origin
    const originAllowed = typeof origin === 'string' && config.allowedOrigins.includes(origin)
    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }

    res.on('finish', () => {
      log.info('request', { requestId, method, path, status: res.statusCode, ms: Date.now() - started })
    })

    try {
      if (method === 'OPTIONS') {
        if (typeof origin === 'string' && !originAllowed) throw new AppError('FORBIDDEN', 'Origin not allowed.')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-request-id')
        res.setHeader('Access-Control-Max-Age', '600')
        res.writeHead(204)
        res.end()
        return
      }

      if (path === '/healthz') {
        if (method !== 'GET' && method !== 'HEAD') {
          res.setHeader('Allow', 'GET, HEAD, OPTIONS')
          throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed.')
        }
        send(res, 200, { status: 'ok', version: config.version })
        return
      }

      throw new AppError('NOT_FOUND', 'Not found.')
    } catch (err) {
      if (!(err instanceof AppError)) log.error('unhandled error', { requestId, err })
      const { status, body } = toPublicError(err, requestId)
      if (!res.headersSent) send(res, status, body)
    }
  }

  const server = createServer(handle)
  server.headersTimeout = 15_000
  server.requestTimeout = 30_000
  server.keepAliveTimeout = 5_000
  return server
}
