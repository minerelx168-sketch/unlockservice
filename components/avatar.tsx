import { initialsFor, type AvatarStyle } from '@/lib/avatar-styles'

/** Initials on a gradient disc. No uploads: nothing to moderate, nothing to leak. */
export function Avatar({
  username,
  style = 'violet',
  size = 40,
}: {
  username: string
  style?: AvatarStyle
  size?: number
}) {
  return (
    <span
      className={`avatar avatar--${style}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initialsFor(username)}
    </span>
  )
}
