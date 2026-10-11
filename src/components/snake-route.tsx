/**
 * Static illustration of the backup chain: Start → A (full) → B (current) → C (backup).
 * Pure SVG so the landing page needs no map library.
 */
export function SnakeRoute({ className }: { className?: string }) {
  const grid = [40, 80, 120, 160, 200, 240, 280, 320];
  return (
    <svg
      viewBox="0 0 360 360"
      role="img"
      aria-label="Route from your start through Plan A, which is full, on to Plan B, with Plan C as the next backup"
      className={className}
    >
      {/* Street grid */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        {grid.map((v) => (
          <g key={v}>
            <line x1={v} y1="0" x2={v} y2="360" />
            <line x1="0" y1={v} x2="360" y2={v} />
          </g>
        ))}
      </g>

      {/* Driven: start → A */}
      <path d="M40 320 V200 H120" fill="none" stroke="#3a3a44" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Backup: B → C */}
      <path d="M220 140 V60 H300" fill="none" stroke="var(--primary)" strokeOpacity="0.22" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current: A → B */}
      <path d="M120 200 V140 H220" fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M120 200 V140 H220"
        fill="none"
        stroke="#0a0a0f"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeDasharray="6 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="route-flow"
      />

      {/* Meeting */}
      <g transform="translate(262 104)">
        <line x1="0" y1="0" x2="0" y2="-22" stroke="var(--foreground)" strokeWidth="2" />
        <path d="M0 -22 L14 -17 L0 -12 Z" fill="var(--foreground)" />
        <circle r="3" fill="var(--foreground)" />
      </g>
      <line x1="232" y1="140" x2="262" y2="104" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 4" />

      {/* Start */}
      <circle cx="40" cy="320" r="9" fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth="3" />

      {/* Plan A — full */}
      <g transform="translate(120 200)">
        <circle r="15" fill="#1c1c24" stroke="var(--destructive)" strokeWidth="2" />
        <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--destructive)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <text x="96" y="232" fill="var(--subtle)" fontSize="11" fontWeight="500">Plan A · full</text>

      {/* Plan B — heading here */}
      <circle cx="220" cy="140" r="22" fill="var(--primary)" opacity="0.18" className="route-pulse" />
      <circle cx="220" cy="140" r="15" fill="var(--primary)" />
      <text x="220" y="145" textAnchor="middle" fill="var(--primary-foreground)" fontSize="14" fontWeight="700">B</text>
      <text x="176" y="178" fill="var(--foreground)" fontSize="11" fontWeight="500">Heading here · 4 min walk</text>

      {/* Plan C — next backup */}
      <circle cx="300" cy="60" r="15" fill="var(--background)" stroke="var(--primary)" strokeOpacity="0.4" strokeWidth="2" />
      <text x="300" y="65" textAnchor="middle" fill="var(--primary)" fillOpacity="0.6" fontSize="14" fontWeight="700">C</text>
    </svg>
  );
}
