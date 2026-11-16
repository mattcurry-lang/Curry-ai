import { AppError } from './errors.ts'

declare const brand: unique symbol
export type Brand<T, B extends string> = T & { readonly [brand]: B }

export type UserId = Brand<string, 'UserId'>
export type ConversationId = Brand<string, 'ConversationId'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function parseUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw new AppError('VALIDATION', `${label} must be a valid UUID.`)
  return value.toLowerCase()
}

export const parseUserId = (v: unknown): UserId => parseUuid(v, 'userId') as UserId
export const parseConversationId = (v: unknown): ConversationId =>
  parseUuid(v, 'conversationId') as ConversationId
