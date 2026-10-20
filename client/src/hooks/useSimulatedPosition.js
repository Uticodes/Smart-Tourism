import { useEffect, useRef, useState } from 'react';
import { metres } from '../lib/geo.js';

const TICK_MS = 250;
const OFF_ROUTE_TICKS = 12; // 3 seconds away from the line: enough for the app to notice and re-route

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
/** The point `d` metres from `p` in direction `deg`. */
function move(p, d, deg) {
  const k = d / 6371000;
  const b = toRad(deg);
  const lat1 = toRad(p.lat), lng1 = toRad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(k) + Math.cos(lat1) * Math.sin(k) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(k) * Math.cos(lat1), Math.cos(k) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/**
 * DEMO ONLY: pretends to travel along `path` at `mps` metres per second, so the in-app
 * navigation can be shown without being in Abuja. Produces the same shape as useWatchPosition.
 * A new path (after re-routing) starts again from its own beginning, which is where the traveller is.
 * `offRoute()` steps 200 m to the side of the road for a few seconds to trigger re-routing.
 */
export default function useSimulatedPosition(active, path, mps, destination) {
  const [position, setPosition] = useState(null);
  const travelled = useRef(0);
  const away = useRef(0);
  const pathRef = useRef(path);

  // Cumulative distance at each vertex, recomputed when the route changes.
  const cumulative = useRef([]);
  useEffect(() => {
    pathRef.current = path;
    travelled.current = 0;
    away.current = 0; // a new route starts where the traveller is, so they are back on it
    const c = [0];
    for (let i = 1; i < (path?.length || 0); i++) c.push(c[i - 1] + metres(path[i - 1], path[i]));
    cumulative.current = c;
  }, [path]);

  useEffect(() => {
    if (!active) { setPosition(null); return undefined; }
    const timer = setInterval(() => {
      const p = pathRef.current;
      const c = cumulative.current;
      if (!p?.length) return;
      const total = c[c.length - 1];
      if (away.current === 0) travelled.current = Math.min(total, travelled.current + (mps * TICK_MS) / 1000);
      const d = travelled.current;
      let i = 1;
      while (i < c.length - 1 && c[i] < d) i++;
      const a = p[Math.max(0, i - 1)], b = p[i] || a;
      const seg = c[i] - c[i - 1] || 1;
      const t = Math.min(1, Math.max(0, (d - c[i - 1]) / seg));
      let point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
      const heading = bearing(a, b);
      if (away.current > 0) {
        point = move(point, 200, heading + 90);
        away.current -= 1;
      } else if (d >= total && destination) {
        point = destination; // walk the last few metres from the road to the attraction itself
      }
      setPosition({ ...point, accuracy: 5, heading: away.current > 0 ? null : heading, at: Date.now(), simulated: true });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, mps, destination?.lat, destination?.lng]);

  return { position, error: '', offRoute: () => { away.current = OFF_ROUTE_TICKS; } };
}
