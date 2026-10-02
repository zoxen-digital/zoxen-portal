import { cn } from "@/lib/utils";

/** Vector version of the Zoxen "OX + orbit" mark. Dark strokes follow the theme (navy in light, white in dark). */
export function LogoMark({ className, id = "zx" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 140 92" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2639E8" />
          <stop offset="100%" stopColor="#6C3BF5" />
        </linearGradient>
        <clipPath id={`${id}-front`}>
          <rect x="-40" y="50" width="240" height="80" transform="rotate(-16 70 50)" />
        </clipPath>
      </defs>

      {/* orbit (back half) */}
      <ellipse cx="70" cy="50" rx="64" ry="15" transform="rotate(-16 70 50)" fill="none" stroke={`url(#${id}-g)`} strokeWidth="5" />

      {/* O */}
      <circle cx="44" cy="48" r="25" fill="none" stroke="var(--mark)" strokeWidth="13" />

      {/* X */}
      <polygon points="72,20 90,20 124,76 106,76" fill="var(--mark)" />
      <polygon points="112,20 132,20 110,46 98,38" fill={`url(#${id}-g)`} />

      {/* orbit (front half, drawn over the letters) */}
      <ellipse
        cx="70"
        cy="50"
        rx="64"
        ry="15"
        transform="rotate(-16 70 50)"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="5"
        clipPath={`url(#${id}-front)`}
      />

      {/* planet */}
      <line x1="72" y1="13" x2="84" y2="9" stroke="var(--mark)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="93" cy="7" r="6" fill={`url(#${id}-g)`} />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-10 w-auto shrink-0" />
      {!compact && (
        <div className="leading-none">
          <div className="text-[19px] font-extrabold tracking-[0.12em] text-heading">
            ZO<span className="text-gradient">X</span>EN
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-px w-3 bg-brand-gradient" />
            <span className="text-[9px] font-bold tracking-[0.42em] text-brand dark:text-[#8f9bff]">DIGITAL</span>
            <span className="h-px w-3 bg-brand-gradient" />
          </div>
        </div>
      )}
    </div>
  );
}
