export type AuthProvider = 'nimiq' | 'google' | 'email'

export interface AuthUser {
  provider: AuthProvider
  /** Stable identifier: Nimiq address, or Google `sub` claim. */
  id: string
  /** Display name: friendly address or email. */
  label: string
  /** Nimiq address when provider === 'nimiq'. */
  nimiqAddress?: string
  /** Email when provider === 'google' or 'email'. */
  email?: string
}
