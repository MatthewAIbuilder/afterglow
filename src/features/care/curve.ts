/**
 * A smooth line through points for tonight's feelings graph: a monotone
 * cubic curve, so it bends gently between check-ins but never swings above
 * or below them (a feeling you never had). Pure: an SVG path string.
 */
export type XY = { x: number; y: number };

const r = (n: number) => Math.round(n * 10) / 10;

export function smoothPath(points: XY[]): string {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return `M${r(points[0].x)} ${r(points[0].y)}`;
  // Slopes between points, then tangents at each point (Fritsch–Carlson).
  const d = points.slice(1).map((p, i) => {
    const dx = p.x - points[i].x;
    return dx ? (p.y - points[i].y) / dx : 0;
  });
  const m = points.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (!d[i]) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let path = `M${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const h = (q.x - p.x) / 3;
    path += ` C${r(p.x + h)} ${r(p.y + m[i] * h)} ${r(q.x - h)} ${r(q.y - m[i + 1] * h)} ${r(q.x)} ${r(q.y)}`;
  }
  return path;
}
