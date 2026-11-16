import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspect } from 'node:util'
import { AppError, toPublicError, parseUserId, isUuid, Secret } from './index.ts'

test('AppError maps to the right status and is exposed to the user', () => {
  const { status, body } = toPublicError(new AppError('QUOTA_EXCEEDED', 'Monthly limit reached.'), 'req-1')
  assert.equal(status, 429)
  assert.deepEqual(body, { error: { code: 'QUOTA_EXCEEDED', message: 'Monthly limit reached.', requestId: 'req-1' } })
})

test('unknown errors never leak their message or cause', () => {
  const { status, body } = toPublicError(new Error('connect ECONNREFUSED db.internal:5432 password=hunter2'))
  assert.equal(status, 500)
  assert.equal(body.error.code, 'INTERNAL')
  assert.ok(!JSON.stringify(body).includes('hunter2'))
  assert.ok(!JSON.stringify(body).includes('ECONNREFUSED'))
})

test('AppError keeps its cause for logs but not in the public body', () => {
  const err = new AppError('PROVIDER_UNAVAILABLE', 'Try again shortly.', { cause: new Error('upstream 502') })
  assert.equal((err.cause as Error).message, 'upstream 502')
  assert.ok(!JSON.stringify(toPublicError(err).body).includes('upstream'))
})

test('uuid parsing accepts valid ids and rejects junk', () => {
  const id = '3f2b8c1e-9a4d-4e7b-8c11-2d5f6a7b8c90'
  assert.equal(parseUserId(id.toUpperCase()), id)
  assert.equal(isUuid("1' OR '1'='1"), false)
  assert.throws(() => parseUserId(42), (e) => e instanceof AppError && e.code === 'VALIDATION')
})

test('Secret never reveals itself implicitly', () => {
  const s = new Secret('sk-super-secret-value')
  assert.equal(String(s), '[redacted]')
  assert.equal(`${s}`, '[redacted]')
  assert.equal(JSON.stringify({ key: s }), '{"key":"[redacted]"}')
  assert.ok(!inspect({ key: s }).includes('super-secret'))
  assert.equal(s.reveal(), 'sk-super-secret-value')
})
