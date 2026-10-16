/**
 * The avatar vocabulary, kept free of any server import so the picker (a
 * client component) and the server pages can share it.
 */
export const AVATAR_STYLES = ['violet', 'teal', 'amber', 'rose', 'blue'] as const
export type AvatarStyle = (typeof AVATAR_STYLES)[number]

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === 'string' && (AVATAR_STYLES as readonly string[]).includes(value)
}

/** Two letters from a username: "mine.relx" → "MR", "boss" → "BO". */
export function initialsFor(username: string): string {
  const parts = username.split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : username.slice(0, 2)
  return letters.toUpperCase()
}
