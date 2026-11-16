import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanText } from './check-secrets.ts'

// Fake values are assembled at runtime so this file never contains a literal key.
const fake = {
  google: 'AIza' + 'x'.repeat(35),
  openai: 'sk-' + 'a'.repeat(30),
  stripe: 'sk_' + 'live_' + 'b'.repeat(20),
}

test('detects common credential shapes', () => {
  assert.deepEqual(scanText(`key=${fake.google}`), ['Google API key'])
  assert.ok(scanText(fake.openai).includes('OpenAI/Anthropic-style key'))
  assert.ok(scanText(fake.stripe).includes('Stripe key'))
})

test('ignores ordinary text and placeholders', () => {
  assert.deepEqual(scanText('GROQ_API_KEY=\nSUPABASE_URL=https://x.supabase.co\nsk-short'), [])
})
