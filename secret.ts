/**
 * Wraps a credential so it cannot leak by accident through logging,
 * JSON.stringify, string interpolation, or console.log. The only way to read
 * the value is the explicit, greppable `.reveal()` call.
 */
export class Secret {
  readonly #value: string

  constructor(value: string) {
    this.#value = value
  }

  reveal(): string {
    return this.#value
  }

  toString(): string {
    return '[redacted]'
  }

  toJSON(): string {
    return '[redacted]'
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return 'Secret([redacted])'
  }
}
