// Compact bar sparkline of daily activity over a window of N days.
// Server-rendered SVG — no client JS. Missing days render as zero bars
// so the chart always fills the full timeline.

import { useTranslations } from "next-intl";

export default function Sparkline({
  data,
  days = 30,
  height = 48,
  className = "",
}: {
  data: { date: string; count: number }[];
  days?: number;
  height?: number;
  className?: string;
}) {
  const t = useTranslations("seal");
  const buckets: { date: string; count: number }[] = [];
  const byDate = new Map(data.map((d) => [d.date, d.count] as const));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    buckets.push({ date: iso, count: byDate.get(iso) ?? 0 });
  }

  const max = Math.max(1, ...buckets.map((b) => b.count));
  const width = 240;
  const gap = 2;
  const barWidth = (width - gap * (buckets.length - 1)) / buckets.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      aria-label={t("sparklineAria", {
        count: buckets.reduce((s, b) => s + b.count, 0),
        days,
      })}
    >
      {buckets.map((b, i) => {
        const h = b.count === 0 ? 2 : Math.max(3, (b.count / max) * height);
        const x = i * (barWidth + gap);
        const y = height - h;
        const isToday = i === buckets.length - 1;
        return (
          <rect
            key={b.date}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1}
            fill={b.count === 0 ? "var(--color-border)" : "var(--color-accent)"}
            opacity={b.count === 0 ? 1 : isToday ? 1 : 0.7}
          />
        );
      })}
    </svg>
  );
}
