// ── WorldMap — SVG dotted world map with animated arcs ──
// Renders a simplified world outline as dots, with animated arcs
// from ORIGIN to each customer city.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Warehouse / ship-from coordinates (Brussels, Belgium)
const ORIGIN = { lat: 50.8503, lng: 4.3517 };

// Simple equirectangular projection
function project(lat, lng, width, height) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

// Generate a dotted grid for the world background
function generateDots(width, height, spacing = 24) {
  const dots = [];
  for (let x = spacing / 2; x < width; x += spacing) {
    for (let y = spacing / 2; y < height; y += spacing) {
      dots.push({ x, y, key: `${x}-${y}` });
    }
  }
  return dots;
}

// Animated arc path between two points
function arcPath(from, to) {
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - Math.abs(to.x - from.x) * 0.3;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
}

export default function WorldMap({ locations, width = 800, height = 450 }) {
  // Filter to only locations with valid coords
  const validLocations = useMemo(
    () => (locations || []).filter(l => l.lat != null && l.lng != null),
    [locations]
  );

  const origin = useMemo(() => project(ORIGIN.lat, ORIGIN.lng, width, height), [width, height]);
  const dots = useMemo(() => generateDots(width, height), [width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Background dots (world outline approximation) */}
      {dots.map(d => (
        <circle key={d.key} cx={d.x} cy={d.y} r={1} fill="var(--line-2)" opacity={0.5} />
      ))}

      {/* Origin marker (warehouse) */}
      <circle cx={origin.x} cy={origin.y} r={6} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
      <circle cx={origin.x} cy={origin.y} r={3} fill="#fff" />

      {/* Animated arcs to customer cities */}
      {validLocations.map((loc, i) => {
        const dest = project(loc.lat, loc.lng, width, height);
        const path = arcPath(origin, dest);
        const dist = Math.hypot(dest.x - origin.x, dest.y - origin.y);
        return (
          <g key={`${loc.city}-${loc.country}`}>
            {/* Static dashed line */}
            <path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={Math.min(1 + loc.count * 0.3, 3)}
              strokeDasharray="4 3"
              opacity={0.25}
            />
            {/* Animated dot traveling the arc */}
            <motion.circle
              r={Math.min(3 + loc.count, 8)}
              fill="var(--accent)"
              initial={{ cx: origin.x, cy: origin.y }}
              animate={{ cx: dest.x, cy: dest.y }}
              transition={{
                duration: 1.5 + dist * 0.002,
                delay: i * 0.15,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatDelay: 3,
              }}
              opacity={0.7}
            />
            {/* Destination marker */}
            <circle cx={dest.x} cy={dest.y} r={Math.min(3 + loc.count, 8)} fill="var(--accent)" opacity={0.6} />
            {/* Count label */}
            {loc.count > 1 && (
              <text x={dest.x + 8} y={dest.y + 4} fontSize={10} fontWeight={700} fill="var(--muted)">
                {loc.count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
