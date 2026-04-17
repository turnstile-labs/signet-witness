// Subtle ascending-timeline backdrop for the hero.
// Renders a row of vertical ticks with dots rising roughly left-to-right,
// visually echoing the "history grows forward" thesis without being noisy.
// Positioned absolutely; parent must be `relative`.

export default function HeroBackdrop() {
  const width = 1200;
  const height = 320;
  const ticks = 48;

  // Deterministic pseudo-random ascending sequence with small noise.
  // Normalised 0..1 then mapped to heights. Generated once at build time.
  const seq: number[] = [];
  let y = 0.15;
  for (let i = 0; i < ticks; i++) {
    const progress = i / (ticks - 1);
    const target = 0.15 + progress * 0.7;
    const noise = Math.sin(i * 1.7) * 0.06 + Math.cos(i * 0.9) * 0.04;
    y = target + noise;
    y = Math.max(0.1, Math.min(0.9, y));
    seq.push(y);
  }

  const margin = 40;
  const usable = width - margin * 2;
  const step = usable / (ticks - 1);
  const baseY = height - 40;
  const topY = 60;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      style={{
        maskImage:
          "radial-gradient(ellipse 60% 80% at 50% 40%, rgba(0,0,0,1), rgba(0,0,0,0) 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 60% 80% at 50% 40%, rgba(0,0,0,1), rgba(0,0,0,0) 75%)",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="tick" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* Horizontal baseline */}
        <line
          x1={margin}
          x2={width - margin}
          y1={baseY}
          y2={baseY}
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray="2 6"
          opacity="0.5"
        />

        {seq.map((v, i) => {
          const x = margin + step * i;
          const dotY = baseY - (baseY - topY) * v;
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={baseY}
                y2={dotY + 4}
                stroke="url(#tick)"
                strokeWidth="1"
              />
              <circle
                cx={x}
                cy={dotY}
                r={i === ticks - 1 ? 3 : 1.5}
                fill="var(--color-accent)"
                opacity={i === ticks - 1 ? 0.9 : 0.45}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
