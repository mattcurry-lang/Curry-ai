// Fails if anything that looks like a real credential is committed.
// Zero dependencies. Run by `npm run check:secrets` and in CI.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'OpenAI/Anthropic-style key', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Groq key', re: /\bgsk_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe key', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'JWT (e.g. Supabase service_role)', re: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage'])
const SKIP_FILES = new Set(['check-secrets.ts', 'check-secrets.test.ts'])

export function scanText(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name)
}

export function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

export function scanRepo(root: string): Array<{ file: string; finding: string }> {
  const hits: Array<{ file: string; finding: string }> = []
  for (const file of walk(root)) {
    const name = file.split('/').pop() ?? ''
    if (SKIP_FILES.has(name)) continue
    if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) continue // gitignored by design
    if (statSync(file).size > 1_000_000) continue
    let text: string
    try { text = readFileSync(file, 'utf8') } catch { continue }
    if (text.includes('\u0000')) continue
    for (const finding of scanText(text)) hits.push({ file: relative(root, file), finding })
  }
  return hits
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = scanRepo(process.cwd())
  if (hits.length > 0) {
    console.error('Possible secrets found (values not printed):')
    for (const h of hits) console.error(`  ${h.file}: ${h.finding}`)
    process.exit(1)
  }
  console.log('No secrets detected.')
}
