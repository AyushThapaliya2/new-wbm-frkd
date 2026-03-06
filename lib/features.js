// lib/features.js

/** ---------- time helpers & sanitizers ---------- **/

// Hours between two timestamps (Date|string). Returns 0 on bad input.
function hoursDiff(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return (tb - ta) / 3_600_000;
}

// Normalize a historical row; drop if unusable.
// Keeps only fields we actually use and enforces numbers.
function normalizeHistRow(r) {
  if (!r || !r.saved_time) return null;
  const lp = Number(r.level_in_percents);
  if (!Number.isFinite(lp)) return null;
  return {
    saved_time: r.saved_time,
    level_in_percents: lp,
    temp: Number.isFinite(Number(r.temp)) ? Number(r.temp) : null,
    humidity: Number.isFinite(Number(r.humidity)) ? Number(r.humidity) : null,
    h2s: Number.isFinite(Number(r.h2s ?? r.h2s_ppm))
      ? Number(r.h2s ?? r.h2s_ppm)
      : null,
    nh3: Number.isFinite(Number(r.nh3 ?? r.nh3_ppm))
      ? Number(r.nh3 ?? r.nh3_ppm)
      : null,
    smoke: Number.isFinite(Number(r.smoke ?? r.smoke_ppm))
      ? Number(r.smoke ?? r.smoke_ppm)
      : null,
  };
}

export function clamp(x, lo, hi) {
  const v = Number.isFinite(Number(x)) ? Number(x) : 0;
  return Math.max(lo, Math.min(hi, v));
}

/** ---------- engineered features ---------- **/

// Simple monotonic odor/safety proxy tuned to your sensor ranges.
// H2S 0.5–50, NH3 1–300, Smoke 10–1000.
// Temperature & humidity raise risk.
export function smellRisk(d) {
  const t = Number.isFinite(Number(d?.temp)) ? Number(d.temp) : 25;
  const h = Number.isFinite(Number(d?.humidity)) ? Number(d.humidity) : 40;
  const h2s = Number.isFinite(Number(d?.h2s ?? d?.h2s_ppm))
    ? Number(d.h2s ?? d.h2s_ppm)
    : 0;
  const nh3 = Number.isFinite(Number(d?.nh3 ?? d?.nh3_ppm))
    ? Number(d.nh3 ?? d.nh3_ppm)
    : 0;
  const smoke = Number.isFinite(Number(d?.smoke ?? d?.smoke_ppm))
    ? Number(d.smoke ?? d.smoke_ppm)
    : 0;

  return (
    4 * h2s + // H2S weighted highest (safety)
    2.5 * nh3 + // NH3 next
    0.2 * smoke + // smoke broad/noisy → lower weight
    Math.max(0, (t - 27) * 2) +
    (h / 100) * 20
  );
}

// Robust slope (percentage points per hour) using first-vs-last.
// Accepts raw historical rows; internally normalizes & sorts.
export function slopePcts(rows) {
  const A = (rows ?? [])
    .map(normalizeHistRow)
    .filter(Boolean)
    .sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));

  if (A.length < 2) return 0;
  const first = A[0],
    last = A[A.length - 1];
  const dt = hoursDiff(first.saved_time, last.saved_time);
  if (dt <= 1e-9) return 0;
  return (last.level_in_percents - first.level_in_percents) / dt;
}

// Summaries over the window (returns 0 when missing).
export function summarizeGas(rows) {
  const A = (rows ?? []).map(normalizeHistRow).filter(Boolean);

  const take = (key) => {
    const vals = A.map((r) => Number(r[key])).filter(Number.isFinite);
    if (!vals.length) return { mean: 0, max: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals);
    return { mean, max };
  };

  const h2s = take("h2s");
  const nh3 = take("nh3");
  const smoke = take("smoke");

  return {
    h2s_mean: h2s.mean,
    h2s_max: h2s.max,
    nh3_mean: nh3.mean,
    nh3_max: nh3.max,
    smoke_mean: smoke.mean,
    smoke_max: smoke.max,
  };
}

// Hours since last "empty" event in the series.
// Defines empty as level <= 5% OR a drop >= 40% vs previous.
// If no signal → return a large sentinel (999).
export function hoursSinceLastEmpty(rows) {
  const A = (rows ?? [])
    .map(normalizeHistRow)
    .filter(Boolean)
    .sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));

  if (!A.length) return 999;

  let lastEmptyTime = null;
  for (let i = 0; i < A.length; i++) {
    const cur = A[i];
    const prev = A[i - 1];
    const low = cur.level_in_percents <= 5;
    const bigDrop = prev
      ? prev.level_in_percents - cur.level_in_percents >= 40
      : false;
    if (low || bigDrop) lastEmptyTime = cur.saved_time;
  }

  if (!lastEmptyTime) return 999;
  return hoursDiff(lastEmptyTime, new Date());
}

/** ---------- optional helpers (not required by your routes) ---------- **/

// Compute level% from geometry (H cm tall, level = cm from top).
// Returns 0..100, safe for bad inputs.
export function levelPctFromGeometry({ bin_height, level }) {
  const H = Number.isFinite(Number(bin_height)) ? Number(bin_height) : 0;
  const lvl = Number.isFinite(Number(level)) ? Number(level) : H;
  if (!H || H <= 0) return 0;
  const pct = ((H - lvl) * 100) / H;
  return clamp(pct, 0, 100);
}
