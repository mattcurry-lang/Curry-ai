import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { loadConfig } from './config.ts'
import { createLogger } from './logger.ts'
import { createApp } from './server.ts'

let server: Server
let base = ''
const ORIGIN = 'https://app.example.com'

before(async () => {
  const config = loadConfig({
    NODE_ENV: 'test', PORT: '0', APP_VERSION: 't1', ALLOWED_ORIGINS: ORIGIN,
    SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'b',
  })
  server = createApp(config, createLogger('error', () => {}))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => new Promise<void>((r) => server.close(() => r())))

test('GET /healthz returns ok with security headers and a request id', async () => {
  const res = await fetch(`${base}/healthz`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'ok', version: 't1' })
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.ok(res.headers.get('x-request-id'))
})

test('a safe inbound request id is kept, an unsafe one is replaced', async () => {
  const kept = await fetch(`${base}/healthz`, { headers: { 'x-request-id': 'trace-12345678' } })
  assert.equal(kept.headers.get('x-request-id'), 'trace-12345678')
  const replaced = await fetch(`${base}/healthz`, { headers: { 'x-request-id': 'bad id\twith spaces' } })
  assert.notEqual(replaced.headers.get('x-request-id'), 'bad id\twith spaces')
})

test('unknown routes return a structured 404 without internals', async () => {
  const res = await fetch(`${base}/nope`)
  assert.equal(res.status, 404)
  const body = await res.json() as { error: { code: string; requestId: string } }
  assert.equal(body.error.code, 'NOT_FOUND')
  assert.ok(body.error.requestId)
})

test('wrong method on a known route is 405 with Allow', async () => {
  const res = await fetch(`${base}/healthz`, { method: 'POST' })
  assert.equal(res.status, 405)
  assert.ok(res.headers.get('allow'))
})

test('CORS reflects only allowlisted origins', async () => {
  const ok = await fetch(`${base}/healthz`, { headers: { origin: ORIGIN } })
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN)
  const bad = await fetch(`${base}/healthz`, { headers: { origin: 'https://evil.example' } })
  assert.equal(bad.headers.get('access-control-allow-origin'), null)
})

test('preflight: allowed origin gets 204, unknown origin gets 403', async () => {
  const ok = await fetch(`${base}/anything`, { method: 'OPTIONS', headers: { origin: ORIGIN } })
  assert.equal(ok.status, 204)
  assert.match(ok.headers.get('access-control-allow-headers') ?? '', /authorization/)
  const bad = await fetch(`${base}/anything`, { method: 'OPTIONS', headers: { origin: 'https://evil.example' } })
  assert.equal(bad.status, 403)
})
