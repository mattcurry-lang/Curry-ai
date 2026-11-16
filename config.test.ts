import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ConfigError, loadConfig } from './config.ts'

const base = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key-value',
}

const problemsOf = (env: Record<string, string>): readonly string[] => {
  try { loadConfig(env) } catch (e) { if (e instanceof ConfigError) return e.problems; throw e }
  return []
}

test('loads a minimal development config with defaults', () => {
  const c = loadConfig(base)
  assert.equal(c.env, 'development')
  assert.equal(c.port, 8787)
  assert.deepEqual(c.allowedOrigins, [])
  assert.deepEqual(Object.keys(c.providers), [])
})

test('reports every problem at once, never echoing secret values', () => {
  const problems = problemsOf({ NODE_ENV: 'production', SUPABASE_URL: 'http://x.co', SUPABASE_ANON_KEY: 'same', SUPABASE_SERVICE_ROLE_KEY: 'same' })
  assert.ok(problems.length >= 4)
  assert.ok(problems.every((p) => !p.includes('same')))
})

test('treats blank provider keys as disabled and wraps real ones as Secret', () => {
  const c = loadConfig({ ...base, GROQ_API_KEY: 'gsk_abc', OPENAI_API_KEY: '  ' })
  assert.deepEqual(Object.keys(c.providers), ['groq'])
  assert.equal(JSON.stringify(c), JSON.stringify(c).replace('gsk_abc', ''))
  assert.equal(c.providers.groq?.reveal(), 'gsk_abc')
})

test('CORS allowlist rejects wildcards and non-origins', () => {
  assert.ok(problemsOf({ ...base, ALLOWED_ORIGINS: '*' }).some((p) => p.includes('wildcard')))
  assert.ok(problemsOf({ ...base, ALLOWED_ORIGINS: 'https://a.com/path' }).some((p) => p.includes('plain origin')))
  assert.deepEqual(loadConfig({ ...base, ALLOWED_ORIGINS: 'http://localhost:5173, https://app.example.com' }).allowedOrigins,
    ['http://localhost:5173', 'https://app.example.com'])
})

test('production requires https origins, an origin list, and a provider', () => {
  const p = problemsOf({ ...base, NODE_ENV: 'production', ALLOWED_ORIGINS: 'http://app.example.com' })
  assert.ok(p.some((x) => x.includes('https in production')))
  assert.ok(p.some((x) => x.includes('provider API key')))
})

test('live Stripe keys are refused outside production', () => {
  assert.ok(problemsOf({ ...base, STRIPE_SECRET_KEY: 'sk_live_123' }).some((p) => p.includes('live key')))
  assert.doesNotThrow(() => loadConfig({ ...base, STRIPE_SECRET_KEY: 'sk_test_123' }))
})

test('config object is frozen', () => {
  assert.throws(() => { (loadConfig(base) as { port: number }).port = 1 }, TypeError)
})
