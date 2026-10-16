import { isAvatarStyle, type AvatarStyle } from './avatar-styles'
import { db } from './db'

/**
 * The small, additive profile layer: an avatar style and an email change
 * in progress. Both live on `users` as nullable/defaulted columns added by
 * migration, so every existing row reads back unchanged.
 */

export { AVATAR_STYLES, initialsFor, isAvatarStyle, type AvatarStyle } from './avatar-styles'

export type AccountProfile = {
  avatarStyle: AvatarStyle
  pendingEmail: string | null
}

export function getAccountProfile(userId: number): AccountProfile {
  const row = db()
    .prepare('SELECT avatar_style, pending_email FROM users WHERE id = ?')
    .get(userId) as { avatar_style: string | null; pending_email: string | null } | undefined
  return {
    avatarStyle: isAvatarStyle(row?.avatar_style) ? row.avatar_style : 'violet',
    pendingEmail: row?.pending_email ?? null,
  }
}

export function setAvatarStyle(userId: number, style: unknown): AvatarStyle {
  if (!isAvatarStyle(style)) throw new Error('Choose one of the listed avatar styles.')
  db().prepare('UPDATE users SET avatar_style = ? WHERE id = ?').run(style, userId)
  return style
}
