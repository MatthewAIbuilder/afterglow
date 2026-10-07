/**
 * The garden's sky by the hour, pure: deep night with the last light behind
 * the hills, a sunrise in pinks and gold, a soft blue day, a dusk of orange
 * going violet. `glow` sits low on the horizon, `wash` across the top;
 * `stars` is how bright the stars still are (0 to 1).
 */
export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk';
export type Sky = { phase: SkyPhase; glow: string; glowOpacity: number; wash?: string; washOpacity: number; stars: number };

export function phaseAt(hour: number): SkyPhase {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

export function skyAt(hour: number, nightGlow: string): Sky {
  switch (phaseAt(hour)) {
    case 'dawn':
      return { phase: 'dawn', glow: '#FF9AB8', glowOpacity: 0.42, wash: '#FFB86B', washOpacity: 0.14, stars: 0.35 };
    case 'day':
      return { phase: 'day', glow: '#8AD8FF', glowOpacity: 0.2, wash: '#6AA8E8', washOpacity: 0.12, stars: 0.12 };
    case 'dusk':
      return { phase: 'dusk', glow: '#FF8A5B', glowOpacity: 0.36, wash: '#B95BFF', washOpacity: 0.14, stars: 0.6 };
    default:
      return { phase: 'night', glow: nightGlow, glowOpacity: 0.22, washOpacity: 0, stars: 1 };
  }
}
