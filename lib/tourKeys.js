// Camera keyframes for a Dadamiya project, derived from its bounds and levels (lib/projects.js).
// Shared by the GSAP scroll tour (components/GsapTour.jsx) and the showroom (components/Showroom.jsx).
export function keyframes(p) {
  const [cx, cy, cz] = p.center; const H = p.H ?? p.levels[p.levels.length - 1][1];
  const R = Math.max(p.bounds.x[1] - p.bounds.x[0], p.bounds.z[1] - p.bounds.z[0]);
  const typY = p.levels.find((l) => l[0] === p.typical)[1];
  const D = Math.max(R * 1.6, H * 1.35);                      // arrival distance: whole building in frame, tall or wide
  const FV = p.finish?.view ?? 1;                             // finished-floor framing: distance multiplier
  const HX = H + p.floorH * 1.6 * (p.levels.length - 1);        // height of the exploded stack
  const K = {
    arrive:  { cam: [cx + D * 0.8, H * 0.7 + 6, cz + D], look: [cx, H * 0.45, cz], fov: 38 },
    stilt:   { cam: [cx + R * 1.05, 2.2, cz + R * 1.35], look: [cx, 1.6, cz], fov: 44, cut: 0 },
    stack:   { cam: [cx + HX * 0.75, HX * 0.9 + 6, cz + HX * 0.9], look: [cx, HX * 0.5, cz], fov: 36, explode: 1 },
    floor:   { cam: [cx + R * 0.35 * FV, typY + R * 1.15 * FV, cz + R * 0.85 * FV], look: [cx, typY, cz - R * 0.05], fov: 34, focus: p.typical, cut: 1, finish: p.finish ? 1 : 0 },
    terrace: { cam: [cx + R * 0.9, H + R * 0.95, cz + R * 1.1], look: [cx, H, cz], fov: 36 },
    night:   { cam: [cx + D * 0.95, H * 0.6 + 6, cz + D * 0.95], look: [cx, H * 0.42, cz], fov: 38, night: 1 },
  };
  for (const u of p.units || []) {
    const ux = (u.bounds.x[0] + u.bounds.x[1]) / 2, uz = (u.bounds.z[0] + u.bounds.z[1]) / 2;
    const uw = Math.max(u.bounds.x[1] - u.bounds.x[0], u.bounds.z[1] - u.bounds.z[0]);
    K['unit' + u.id] = { cam: [ux + uw * 0.9, typY + uw * 0.95, uz + uw * 1.1], look: [ux, typY + 0.8, uz], fov: 40, unit: u.id, focus: p.typical, cut: 1, orbit: { c: [ux, typY + 0.8, uz], r: uw * 1.35, h: uw * 0.95 } };
  }
  return K;
}
