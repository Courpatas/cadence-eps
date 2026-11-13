// Calcul de la fréquence de course à partir d'un signal échantillonné.
// Le signal utilisé est l'écart horizontal entre les deux chevilles, divisé
// par la longueur de jambe : il passe par un maximum à chaque appui (pieds
// les plus écartés) et par un minimum quand les pieds se croisent, soit une
// période par pas. La valeur absolue rend le signal insensible aux
// inversions gauche/droite du détecteur.

export const MIN_CADENCE = 110; // pas/min
export const MAX_CADENCE = 260;
const FS = 60; // fréquence de rééchantillonnage (Hz)

// Rééchantillonne des points {t (s), v} à intervalle régulier.
export function resample(pts, fs = FS) {
  const t0 = pts[0].t;
  const span = pts[pts.length - 1].t - t0;
  const n = Math.floor(span * fs) + 1;
  const u = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / fs;
    while (j < pts.length - 2 && pts[j + 1].t <= t) j++;
    const a = pts[j], b = pts[Math.min(j + 1, pts.length - 1)];
    const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    u[i] = a.v + (b.v - a.v) * k;
  }
  return u;
}

// Retire la tendance linéaire (le coureur se rapproche ou s'éloigne).
export function detrend(u) {
  const n = u.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += u[i]; sxx += i * i; sxy += i * u[i]; }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  const icpt = (sy - slope * sx) / n;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = u[i] - (icpt + slope * i);
  return out;
}

export function smooth(u, r = 2) {
  const n = u.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(n - 1, i + r); k++) { s += u[k]; c++; }
    out[i] = s / c;
  }
  return out;
}

// Autocorrélation normalisée : renvoie {cadence, conf} ou null.
export function autocorrCadence(u, fs = FS) {
  const n = u.length;
  const minLag = Math.floor((fs * 60) / MAX_CADENCE);
  const maxLag = Math.ceil((fs * 60) / MIN_CADENCE);
  if (n < maxLag * 2) return null;
  const r = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0, a = 0, b = 0;
    for (let i = 0; i + lag < n; i++) { s += u[i] * u[i + lag]; a += u[i] * u[i]; b += u[i + lag] * u[i + lag]; }
    r[lag] = a > 0 && b > 0 ? s / Math.sqrt(a * b) : 0;
  }
  const peaks = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > 0) peaks.push(lag);
  }
  if (!peaks.length) return null;
  const best = Math.max(...peaks.map(l => r[l]));
  // Le premier pic fort correspond à un pas ; un pic plus loin serait une foulée (2 pas).
  let bl = peaks.find(l => r[l] >= 0.8 * best);
  // Course asymétrique : le pic de la foulée peut dominer. S'il existe un pic
  // net à mi-distance, c'est lui qui correspond à un pas.
  const half = peaks.find(l => l < bl && Math.abs(l - bl / 2) <= 2 && r[l] > 0.25);
  if (half) bl = half;
  const y0 = r[bl - 1], y1 = r[bl], y2 = r[bl + 1];
  const den = y0 - 2 * y1 + y2;
  const off = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0;
  return { cadence: (60 * fs) / (bl + off), conf: y1 };
}

// Indices des maxima (appuis) dans un signal centré.
// `period` (s) : durée d'un pas estimée, pour écarter les faux maxima.
export function findPeaks(u, fs = FS, period = 0.22) {
  const n = u.length;
  const w = Math.max(2, Math.round(0.3 * period * fs));
  const out = [];
  for (let i = 0; i < n; i++) {
    if (out.length && i - out[out.length - 1] < 0.6 * period * fs) continue;
    let isMax = true;
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) {
      if (u[k] > u[i]) { isMax = false; break; }
    }
    if (isMax) out.push(i);
  }
  return out;
}

// Analyse un segment continu de points. Renvoie null si trop court.
export function analyzeSegment(pts, fs = FS) {
  if (pts.length < 15) return null;
  const span = pts[pts.length - 1].t - pts[0].t;
  if (span < 1.5) return null;
  const u = smooth(detrend(resample(pts, fs)), 2);
  const ac = autocorrCadence(u, fs);
  if (!ac) return null;
  const pk = findPeaks(u, fs, 60 / ac.cadence);
  return { cadence: ac.cadence, conf: ac.conf, span, steps: pk.length, peaks: pk.map(i => pts[0].t + i / fs) };
}

// Coupe une série en segments continus (un trou > gap s = coureur perdu).
export function splitSegments(pts, gap = 0.4) {
  const segs = [];
  let cur = [];
  for (const p of pts) {
    if (cur.length && p.t - cur[cur.length - 1].t > gap) { segs.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

// Analyse complète d'un passage : moyenne pondérée par la durée des segments fiables.
export function analyzeRecording(pts) {
  const res = splitSegments(pts).map(s => analyzeSegment(s)).filter(Boolean);
  const good = res.filter(r => r.conf >= 0.35);
  if (!good.length) return null;
  const tot = good.reduce((a, r) => a + r.span, 0);
  const cadence = good.reduce((a, r) => a + r.cadence * r.span, 0) / tot;
  const conf = good.reduce((a, r) => a + r.conf * r.span, 0) / tot;
  const steps = good.reduce((a, r) => a + r.steps, 0);
  return { cadence, conf, span: tot, steps };
}

export function reliability(conf) {
  if (conf >= 0.7) return 'bonne';
  if (conf >= 0.45) return 'moyenne';
  return 'faible';
}
