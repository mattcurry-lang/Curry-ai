import { Secret } from '@curry/shared'

export const PROVIDER_NAMES = [
  'openai', 'gemini', 'anthropic', 'deepseek', 'groq', 'openrouter', 'cerebras',
] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

const PROVIDER_ENV: Record<ProviderName, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error']
const ENVIRONMENTS = ['development', 'test', 'production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export interface AppConfig {
  readonly env: Environment
  readonly port: number
  readonly logLevel: LogLevel
  readonly version: string
  readonly allowedOrigins: readonly string[]
  readonly supabase: { readonly url: string; readonly anonKey: Secret; readonly serviceRoleKey: Secret }
  readonly providers: Readonly<Partial<Record<ProviderName, Secret>>>
  readonly stripe: { readonly secretKey?: Secret; readonly webhookSecret?: Secret }
}

/** Lists every problem at once. Messages name variables, never values. */
export class ConfigError extends Error {
  readonly problems: readonly string[]
  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'ConfigError'
    this.problems = problems
  }
}

type Env = Record<string, string | undefined>

export function loadConfig(env: Env): AppConfig {
  const problems: string[] = []
  const get = (name: string): string | undefined => {
    const v = env[name]?.trim()
    return v ? v : undefined
  }
  const required = (name: string): string => {
    const v = get(name)
    if (v === undefined) problems.push(`${name} is required.`)
    return v ?? ''
  }

  const envName = get('NODE_ENV') ?? 'development'
  if (!(ENVIRONMENTS as readonly string[]).includes(envName)) {
    problems.push(`NODE_ENV must be one of: ${ENVIRONMENTS.join(', ')}.`)
  }
  const isProd = envName === 'production'

  const portRaw = get('PORT') ?? '8787'
  const port = Number(portRaw)
  if (!Number.isInteger(port) || port < 0 || port > 65535) problems.push('PORT must be an integer from 0 to 65535.')

  const logLevel = get('LOG_LEVEL') ?? 'info'
  if (!LOG_LEVELS.includes(logLevel)) problems.push(`LOG_LEVEL must be one of: ${LOG_LEVELS.join(', ')}.`)

  // CORS allowlist: exact origins only.
  const allowedOrigins: string[] = []
  for (const raw of (get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (raw === '*') { problems.push('ALLOWED_ORIGINS must not contain a wildcard.'); continue }
    try {
      const u = new URL(raw)
      if (!['http:', 'https:'].includes(u.protocol) || u.origin !== raw) throw new Error('not an origin')
      if (isProd && u.protocol !== 'https:') problems.push('ALLOWED_ORIGINS must use https in production.')
      allowedOrigins.push(u.origin)
    } catch {
      problems.push('ALLOWED_ORIGINS contains an entry that is not a plain origin (e.g. https://app.example.com).')
    }
  }
  if (isProd && allowedOrigins.length === 0) problems.push('ALLOWED_ORIGINS is required in production.')

  const supabaseUrl = required('SUPABASE_URL')
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl)
      if (isProd && u.protocol !== 'https:') problems.push('SUPABASE_URL must use https in production.')
    } catch { problems.push('SUPABASE_URL is not a valid URL.') }
  }
  const anonKey = required('SUPABASE_ANON_KEY')
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
  if (anonKey && anonKey === serviceRoleKey) {
    problems.push('SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different keys.')
  }

  const providers: Partial<Record<ProviderName, Secret>> = {}
  for (const name of PROVIDER_NAMES) {
    const key = get(PROVIDER_ENV[name])
    if (key !== undefined) providers[name] = new Secret(key)
  }
  if (isProd && Object.keys(providers).length === 0) {
    problems.push('At least one provider API key is required in production.')
  }

  // Stripe: refuse live keys outside production so a dev box can never charge real cards.
  const stripeSecret = get('STRIPE_SECRET_KEY')
  if (stripeSecret !== undefined) {
    const live = stripeSecret.startsWith('sk_live_') || stripeSecret.startsWith('rk_live_')
    if (live && !isProd) problems.push('STRIPE_SECRET_KEY is a live key but NODE_ENV is not production.')
    if (!live && isProd) problems.push('STRIPE_SECRET_KEY must be a live key in production.')
  }
  const webhookSecret = get('STRIPE_WEBHOOK_SECRET')

  if (problems.length > 0) throw new ConfigError(problems)

  const stripe: { secretKey?: Secret; webhookSecret?: Secret } = {}
  if (stripeSecret !== undefined) stripe.secretKey = new Secret(stripeSecret)
  if (webhookSecret !== undefined) stripe.webhookSecret = new Secret(webhookSecret)

  return Object.freeze({
    env: envName as Environment,
    port,
    logLevel: logLevel as LogLevel,
    version: get('APP_VERSION') ?? 'dev',
    allowedOrigins: Object.freeze(allowedOrigins),
    supabase: Object.freeze({ url: supabaseUrl, anonKey: new Secret(anonKey), serviceRoleKey: new Secret(serviceRoleKey) }),
    providers: Object.freeze(providers),
    stripe: Object.freeze(stripe),
  })
}
