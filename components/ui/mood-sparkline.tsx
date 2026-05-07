"use client";

export function MoodSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }

  const width = 80;
  const height = 24;
  const padding = 2;

  const min = Math.min(...values, -3);
  const max = Math.max(...values, 3);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Determine color based on trend
  const trend = values[values.length - 1] - values[0];
  const strokeColor =
    trend > 0
      ? "#6ee7b7" // green for improving
      : trend < 0
        ? "#f87171" // red for declining
        : "#94a3b8"; // gray for neutral

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mood-sparkline"
    >
      <defs>
        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
        fill="url(#moodGradient)"
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r="2.5"
        fill={strokeColor}
      />
      <style jsx>{`
        .mood-sparkline {
          display: inline-block;
          vertical-align: middle;
        }
      `}</style>
    </svg>
  );
}
