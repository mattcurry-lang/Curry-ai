import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Secret } from '@curry/shared'
import { createLogger, redact } from './logger.ts'

test('redacts sensitive keys, nested and in arrays', () => {
  const out = JSON.stringify(redact({ headers: { Authorization: 'Bearer abc' }, list: [{ apiKey: 'k1' }], ok: 'visible' }))
  assert.ok(!out.includes('Bearer abc') && !out.includes('k1'))
  assert.ok(out.includes('visible'))
})

test('Secret instances are redacted wherever they appear', () => {
  const lines: string[] = []
  createLogger('debug', (l) => lines.push(l)).info('x', { note: new Secret('topsecret') })
  assert.ok(!lines[0]!.includes('topsecret'))
})

test('respects the log level', () => {
  const lines: string[] = []
  const log = createLogger('warn', (l) => lines.push(l))
  log.info('hidden'); log.warn('shown')
  assert.equal(lines.length, 1)
})
