// Icon — renders a design-system SVG (Lucide-derived, currentColor, 24px grid).
// Icons are ALWAYS paired with a visible Marathi text label in the UI
// (design/README.md hard rule 5); this component is presentational and
// aria-hidden by default so the adjacent label is the accessible name.

import { ICON_PATHS, type IconName } from './icons/paths'

type IconProps = {
  name: IconName
  size?: number
  className?: string
  /** Set only when the icon is the sole content of an interactive control. */
  title?: string
}

export function Icon({ name, size = 24, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      // Inner markup is our own build-time asset from design/icons, never user input.
      // eslint-disable-next-line react/no-danger -- trusted static SVG (doc 12 §8.3 exemption)
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
}

export type { IconName }
