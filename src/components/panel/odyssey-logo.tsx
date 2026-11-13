/**
 * Odyssey brand marks — drawn as SVG from the logo sheets:
 * an open circle (the horizon), a sail, and a swelling wave with a curl.
 * Light mode: deep-navy linework on ivory (first sheet).
 * Dark mode: cyan sail + silver arc on midnight (second sheet).
 * Colors live in globals.css (.olo-* classes) so both themes stay in sync.
 */
export function OdysseyEmblem({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox="0 0 72 72"
      fill="none"
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* horizon circle, open at the bottom where the wave flows out */}
      <path className="olo-arc" d="M 24 58 A 26 26 0 1 1 48 58" />
      {/* sail */}
      <path
        className={`olo-sail${animated ? ' animate-boat' : ''}`}
        d="M 40 12 C 37.5 21 34 31 30 39 L 51 39 C 46 31 42 21 40 12 Z"
      />
      {/* swelling wave */}
      <path
        className="olo-wave"
        d="M 8 47 C 14 41 21 41 27 45.5 C 33 50 41 50.5 47 46.5 C 51.5 43.6 55.5 43.2 59 45"
      />
      {/* the curl */}
      <path
        className="olo-wave2"
        d="M 36 45.5 C 37 49 41 50 43.5 47.5 C 45.5 45.5 44 42.5 41.5 43 C 39.8 43.4 39 45 40 46.5"
      />
    </svg>
  )
}

/**
 * The real Odyssey logo images (the sheets the admin supplied) — one for light
 * mode, one for dark mode. Always shown as-is, never redrawn.
 */
export function OdysseyLogoImage({ className = '', alt = 'Odyssey' }: { className?: string; alt?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-2xl ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-light.jpg" alt={alt} className="h-full w-full object-cover dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-dark.jpg" alt="" aria-hidden="true" className="absolute inset-0 hidden h-full w-full object-cover dark:block" />
    </span>
  )
}

/** The ODYSSEY wordmark + SECURE | PRIVATE | UNLIMITED tagline. */
export function OdysseyWordmark({
  size = 'md',
  tagline = true,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  tagline?: boolean
  className?: string
}) {
  const sizes = {
    sm: { word: 'text-[11px] tracking-[0.34em]', tag: 'text-[6.5px] tracking-[0.28em]' },
    md: { word: 'text-[13px] tracking-[0.38em]', tag: 'text-[8px] tracking-[0.3em]' },
    lg: { word: 'text-[26px] tracking-[0.42em]', tag: 'text-[10px] tracking-[0.34em]' },
  }[size]
  return (
    <div className={`flex flex-col items-center ${className}`} dir="ltr">
      <span
        className={`font-display font-semibold uppercase leading-none text-odyssey-navy dark:text-odyssey-cyan ${sizes.word}`}
      >
        Odyssey
      </span>
      {tagline && (
        <span className={`mt-1.5 font-display uppercase leading-none text-muted-foreground/80 ${sizes.tag}`}>
          Secure <span className="text-odyssey-silver">|</span> Private <span className="text-odyssey-silver">|</span> Unlimited
        </span>
      )}
    </div>
  )
}
