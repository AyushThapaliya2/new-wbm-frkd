/**
 * window_comparison.mjs
 *
 * Compares 6-hour windows against 10h, 12h, and 24h windows.
 * Run from the project directory:
 *   node window_comparison.mjs
 *
 * Tests every combination of (lookback_hours, lookahead_hours):
 *   (6,6)  (10,10)  (12,12)  (24,24)
 * Trains both production feature sets on 80%, tests on 20% (chronological per device):
 *   - Logistic Regression: 9 features (same as app/api/priority-train/route.js)
 *   - Gaussian Naive Bayes: 8 features (same as app/api/priority-train-nb/route.js)
 * Prints a side-by-side metrics table.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Supabase connection ──────────────────────────────────────────────────────
const SUPABASE_URL = "https://hqnhdueeosxdcdfvhpyj.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbmhkdWVlb3N4ZGNkZnZocHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5ODM0MjEsImV4cCI6MjA2ODU1OTQyMX0.Ue2dlPlbJpT48-yw46IzHEAuTvWMTvw1GTz9-PQK5rY";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Fixed thresholds (same as production) ───────────────────────────────────
const FULL_THRESHOLD  = 92;
const SMELL_THRESHOLD = 600;
const MIN_ROWS        = 8;
const TEST_RATIO      = 0.20;

// ─── Window configs to compare ───────────────────────────────────────────────
const CONFIGS = [
  { label: " 6h / 6h ",  lookback:  6, lookahead:  6 },
  { label: "10h / 10h",  lookback: 10, lookahead: 10 },
  { label: "12h / 12h",  lookback: 12, lookahead: 12 },
  { label: "24h / 24h",  lookback: 24, lookahead: 24 },
];

const LR_FEATURES = [
  "level_in_percents",
  "fill_rate",
  "temp",
  "humidity",
  "h2s_max_h",
  "nh3_max_h",
  "smoke_max_h",
  "time_since_empty_h",
  "smell_risk",
];

const NB_FEATURES = [
  "level_in_percents",
  "fill_rate",
  "temp",
  "humidity",
  "h2s_max_h",
  "nh3_max_h",
  "smoke_max_h",
  "time_since_empty_h",
];

// ─── Feature engineering (inlined from lib/features.js) ──────────────────────

function hoursDiff(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return (tb - ta) / 3_600_000;
}

function normalizeRow(r) {
  if (!r || !r.saved_time) return null;
  const lp = Number(r.level_in_percents);
  if (!Number.isFinite(lp)) return null;
  return {
    saved_time:        r.saved_time,
    level_in_percents: lp,
    temp:    Number.isFinite(Number(r.temp))    ? Number(r.temp)    : null,
    humidity:Number.isFinite(Number(r.humidity))? Number(r.humidity): null,
    h2s:     Number.isFinite(Number(r.h2s))     ? Number(r.h2s)     : null,
    nh3:     Number.isFinite(Number(r.nh3))     ? Number(r.nh3)     : null,
    smoke:   Number.isFinite(Number(r.smoke))   ? Number(r.smoke)   : null,
  };
}

function smellRisk(d) {
  const h2s   = Number.isFinite(Number(d?.h2s))      ? Number(d.h2s)      : 0;
  const nh3   = Number.isFinite(Number(d?.nh3))      ? Number(d.nh3)      : 0;
  const smoke = Number.isFinite(Number(d?.smoke))    ? Number(d.smoke)    : 0;
  const t     = Number.isFinite(Number(d?.temp))     ? Number(d.temp)     : 25;
  const h     = Number.isFinite(Number(d?.humidity)) ? Number(d.humidity) : 40;
  return (
    4.0 * h2s +
    2.5 * nh3 +
    0.2 * smoke +
    Math.max(0, (t - 27) * 2) +
    (h / 100) * 20
  );
}

function slopePcts(rows) {
  const A = (rows ?? [])
    .map(normalizeRow).filter(Boolean)
    .sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));
  if (A.length < 2) return 0;
  const first = A[0], last = A[A.length - 1];
  const dt = hoursDiff(first.saved_time, last.saved_time);
  if (dt <= 1e-9) return 0;
  return (last.level_in_percents - first.level_in_percents) / dt;
}

function summarizeGas(rows) {
  const A = (rows ?? []).map(normalizeRow).filter(Boolean);
  const take = (key) => {
    const vals = A.map(r => Number(r[key])).filter(Number.isFinite);
    if (!vals.length) return { mean: 0, max: 0 };
    return {
      mean: vals.reduce((a, b) => a + b, 0) / vals.length,
      max:  Math.max(...vals),
    };
  };
  const h2s = take("h2s"), nh3 = take("nh3"), smoke = take("smoke");
  return {
    h2s_mean: h2s.mean, h2s_max: h2s.max,
    nh3_mean: nh3.mean, nh3_max: nh3.max,
    smoke_mean: smoke.mean, smoke_max: smoke.max,
  };
}

function hoursSinceLastEmpty(rows) {
  const A = (rows ?? [])
    .map(normalizeRow).filter(Boolean)
    .sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));
  if (!A.length) return 999;
  let lastEmptyTime = null;
  for (let i = 0; i < A.length; i++) {
    const cur  = A[i], prev = A[i - 1];
    const low     = cur.level_in_percents <= 5;
    const bigDrop = prev ? prev.level_in_percents - cur.level_in_percents >= 40 : false;
    if (low || bigDrop) lastEmptyTime = cur.saved_time;
  }
  if (!lastEmptyTime) return 999;
  return hoursDiff(lastEmptyTime, new Date());
}

// ─── Logistic regression (inlined from lib/ml_logistic.js) ───────────────────

function sigmoid(z) {
  const zc = Math.max(-40, Math.min(40, z));
  return 1 / (1 + Math.exp(-zc));
}

function standardize(X, features) {
  const mean = {}, std = {};
  for (const f of features) {
    const vals = X.map(r => Number.isFinite(Number(r[f])) ? Number(r[f]) : 0);
    const m    = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const v    = vals.reduce((s, v) => s + (v - m) * (v - m), 0) / Math.max(1, vals.length);
    mean[f]    = m;
    std[f]     = Math.sqrt(v) || 1;
  }
  const Z = X.map(r =>
    features.map(f => (Number(r[f] ?? 0) - (mean[f] ?? 0)) / (std[f] || 1))
  );
  return { Z, mean, std };
}

function logisticFit(X, y, features) {
  const { Z, mean, std } = standardize(X, features);
  const n = Z.length, d = features.length;
  let b = 0;
  const w = Array(d).fill(0);
  const lr = 0.05, epochs = 2000, lambda = 0.5;

  for (let ep = 0; ep < epochs; ep++) {
    let gb = 0;
    const gw = Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const err = sigmoid(z) - y[i];
      gb += err;
      for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
    }
    for (let j = 0; j < d; j++) gw[j] += lambda * w[j];
    const step = lr / Math.max(1, n);
    b -= step * gb;
    for (let j = 0; j < d; j++) w[j] -= step * gw[j];
  }
  const weights = {};
  for (let j = 0; j < features.length; j++) weights[features[j]] = w[j];
  return { weights, bias: b, meta: { features, mean, std } };
}

function logisticPredict(row, fit) {
  const { features, mean, std } = fit.meta;
  let z = fit.bias ?? 0;
  for (const f of features) {
    const val = (Number(row[f] ?? 0) - (mean?.[f] ?? 0)) / (std?.[f] || 1);
    z += (fit.weights?.[f] ?? 0) * val;
  }
  return sigmoid(z);
}

// ─── Gaussian Naive Bayes (inlined from lib/ml_naive_bayes.js) ───────────────

function safeVar(v) {
  const EPS = 1e-6;
  return v > EPS ? v : EPS;
}

function gnbFit(X, y, features) {
  if (!Array.isArray(X) || !X.length) throw new Error("No rows to fit");
  if (X.length !== y.length) throw new Error("X/y length mismatch");

  const classes = [0, 1];
  const counts = { 0: 0, 1: 0 };
  const sum = { 0: {}, 1: {} };
  const sumsq = { 0: {}, 1: {} };

  for (const c of classes) {
    for (const f of features) {
      sum[c][f] = 0;
      sumsq[c][f] = 0;
    }
  }

  for (let i = 0; i < X.length; i++) {
    const c = Number(y[i]) === 1 ? 1 : 0;
    counts[c] += 1;
    for (const f of features) {
      const v = Number(X[i][f] ?? 0);
      sum[c][f] += v;
      sumsq[c][f] += v * v;
    }
  }

  const priors = {
    0: counts[0] / Math.max(1, X.length),
    1: counts[1] / Math.max(1, X.length),
  };
  const mean = { 0: {}, 1: {} };
  const variance = { 0: {}, 1: {} };

  for (const c of classes) {
    const n = Math.max(1, counts[c]);
    for (const f of features) {
      const m = sum[c][f] / n;
      const v = sumsq[c][f] / n - m * m;
      mean[c][f] = m;
      variance[c][f] = safeVar(v);
    }
  }

  return { classes, priors, mean, variance, meta: { features, kind: "gaussian_nb" } };
}

function logGauss(x, mu, varv) {
  const v = safeVar(varv);
  const diff = x - mu;
  return -0.5 * (Math.log(2 * Math.PI * v) + (diff * diff) / v);
}

function gnbPredictProba(row, fit) {
  const { classes, priors, mean, variance } = fit;
  const features = fit.meta?.features ?? Object.keys(row);

  const logp = {};
  for (const c of classes) {
    let s = Math.log(Math.max(1e-12, priors[c]));
    for (const f of features) {
      const x = Number(row[f] ?? 0);
      s += logGauss(x, mean[c][f], variance[c][f]);
    }
    logp[c] = s;
  }

  const a = Math.max(logp[0], logp[1]);
  const p0 = Math.exp(logp[0] - a);
  const p1 = Math.exp(logp[1] - a);
  return p1 / Math.max(1e-12, p0 + p1);
}

// ─── Metrics (inlined from lib/ml_metrics.js) ────────────────────────────────

function binaryMetrics(yTrue, probs, threshold = 0.5) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const pred = probs[i] >= threshold ? 1 : 0;
    if      (pred === 1 && yTrue[i] === 1) tp++;
    else if (pred === 0 && yTrue[i] === 0) tn++;
    else if (pred === 1 && yTrue[i] === 0) fp++;
    else                                   fn++;
  }
  const total     = yTrue.length;
  const accuracy  = (tp + tn) / Math.max(1, total);
  const precision = tp / Math.max(1, tp + fp);
  const recall    = tp / Math.max(1, tp + fn);
  const f1        = (2 * precision * recall) / Math.max(1e-12, precision + recall);
  return { total, tp, tn, fp, fn, accuracy, precision, recall, f1,
           positives: yTrue.reduce((a, b) => a + b, 0) };
}

// ─── Dataset builder ─────────────────────────────────────────────────────────

async function buildDataset(allDeviceHistories, lookback_h, lookahead_h) {
  const samples = [];

  for (const { device_id, records } of allDeviceHistories) {
    const H = records;
    if (H.length < MIN_ROWS) continue;

    for (let i = 2; i < H.length - 2; i++) {
      const tRef   = new Date(H[i].saved_time);
      const tStart = new Date(tRef.getTime() - lookback_h  * 3_600_000);
      const tEnd   = new Date(tRef.getTime() + lookahead_h * 3_600_000);

      const W = H.filter(r => new Date(r.saved_time) >= tStart &&
                               new Date(r.saved_time) <= tRef);
      if (W.length < 2) continue;

      const F = H.filter(r => new Date(r.saved_time) >  tRef &&
                               new Date(r.saved_time) <= tEnd);

      const cur  = H[i];
      const gas  = summarizeGas(W);
      const commonFeat = {
        level_in_percents:  Number(cur.level_in_percents ?? 0),
        fill_rate:          slopePcts(W),
        temp:               Number(cur.temp     ?? 25),
        humidity:           Number(cur.humidity ?? 40),
        h2s_max_h:          gas.h2s_max,
        nh3_max_h:          gas.nh3_max,
        smoke_max_h:        gas.smoke_max,
        time_since_empty_h: hoursSinceLastEmpty(W),
      };
      const feat_lr = {
        ...commonFeat,
        smell_risk: smellRisk({
          h2s:   Number(cur.h2s   ?? 0),
          nh3:   Number(cur.nh3   ?? 0),
          smoke: Number(cur.smoke ?? 0),
          temp: commonFeat.temp,
          humidity: commonFeat.humidity,
        }),
      };
      const feat_nb = { ...commonFeat };

      let label = 0;
      for (const fr of F) {
        const sr = smellRisk(fr);
        if ((fr.level_in_percents ?? 0) >= FULL_THRESHOLD || sr >= SMELL_THRESHOLD) {
          label = 1;
          break;
        }
      }

      samples.push({ device_id, saved_time: H[i].saved_time, feat_lr, feat_nb, label });
    }
  }
  return samples;
}

// ─── Chronological train/test split (per device, same as production) ─────────

function splitChronological(samples) {
  const byDevice = new Map();
  for (const s of samples) {
    if (!byDevice.has(s.device_id)) byDevice.set(s.device_id, []);
    byDevice.get(s.device_id).push(s);
  }
  const train = [], test = [];
  for (const rows of byDevice.values()) {
    rows.sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));
    const testCount = Math.max(1, Math.floor(rows.length * TEST_RATIO));
    const splitAt   = rows.length - testCount;
    train.push(...rows.slice(0, splitAt));
    test.push(...rows.slice(splitAt));
  }
  return { train, test };
}

// ─── Pull data from Supabase once, reuse for all configs ─────────────────────

async function fetchAllData() {
  console.log("Fetching registered devices from Supabase...");
  const { data: devices, error: devErr } = await sb
    .from("devices")
    .select("unique_id, bin_height, is_registered")
    .eq("is_registered", true)
    .not("bin_height", "is", null);

  if (devErr) throw new Error("Devices fetch failed: " + devErr.message);
  console.log(`Found ${devices.length} registered device(s): ${devices.map(d => d.unique_id).join(", ")}`);

  const allDeviceHistories = [];
  let totalRows = 0;

  for (const d of devices) {
    process.stdout.write(`  Fetching history for device ${d.unique_id}... `);
    const { data: records, error: histErr } = await sb
      .from("historical")
      .select("unique_id, level_in_percents, saved_time, temp, humidity, h2s, nh3, smoke")
      .eq("unique_id", d.unique_id)
      .order("saved_time", { ascending: true });

    if (histErr) {
      console.log("FAILED:", histErr.message);
      continue;
    }
    console.log(`${records.length} rows`);
    totalRows += records.length;
    allDeviceHistories.push({ device_id: d.unique_id, records: records ?? [] });
  }

  console.log(`Total historical rows fetched: ${totalRows}\n`);
  return allDeviceHistories;
}

// ─── Run one config and return metrics ───────────────────────────────────────

async function runConfig(allDeviceHistories, lookback_h, lookahead_h) {
  const samples  = await buildDataset(allDeviceHistories, lookback_h, lookahead_h);
  if (!samples.length) return null;

  const { train, test } = splitChronological(samples);
  if (!train.length || !test.length) return null;

  const XtrainLR = train.map(s => s.feat_lr);
  const XtestLR  = test.map(s => s.feat_lr);
  const XtrainNB = train.map(s => s.feat_nb);
  const XtestNB  = test.map(s => s.feat_nb);
  const ytrain = train.map(s => s.label);
  const ytest  = test.map(s => s.label);

  const fitLR   = logisticFit(XtrainLR, ytrain, LR_FEATURES);
  const probsLR = XtestLR.map(r => logisticPredict(r, fitLR));
  const lr      = binaryMetrics(ytest, probsLR, 0.5);

  const fitNB   = gnbFit(XtrainNB, ytrain, NB_FEATURES);
  const probsNB = XtestNB.map(r => gnbPredictProba(r, fitNB));
  const nb      = binaryMetrics(ytest, probsNB, 0.3);

  return {
    n_samples: samples.length,
    n_train:   train.length,
    n_test:    test.length,
    pos_rate:  (lr.positives / lr.total * 100).toFixed(1),
    lr,
    nb,
  };
}

// ─── Print results table ─────────────────────────────────────────────────────

function pct(v) { return (v * 100).toFixed(1).padStart(6) + "%"; }
function num(v) { return String(v).padStart(6); }

function printTable(results) {
  const divider = "─".repeat(118);
  console.log("\n" + divider);
  console.log(
    "WINDOW CONFIG".padEnd(14) +
    "│ Model".padEnd(11) +
    "│ Feats".padEnd(8) +
    "│ Samples".padEnd(11) +
    "│ Train".padEnd(9) +
    "│ Test".padEnd(8) +
    "│ +Label%".padEnd(10) +
    "│ Accuracy".padEnd(11) +
    "│ Precision".padEnd(12) +
    "│ Recall ★".padEnd(12) +
    "│ F1"
  );
  console.log(divider);

  for (const { config, metrics: m } of results) {
    if (!m) {
      console.log(`${config.label.padEnd(14)}│ NOT ENOUGH DATA`);
      continue;
    }
    const rows = [
      { model: "LR", feats: LR_FEATURES.length, metrics: m.lr },
      { model: "NB", feats: NB_FEATURES.length, metrics: m.nb },
    ];
    const bestRecall = Math.max(
      ...results.flatMap(r => r.metrics ? [r.metrics.lr.recall, r.metrics.nb.recall] : [])
    );
    for (const row of rows) {
      const mm = row.metrics;
      const recallStr = pct(mm.recall);
      const isBest = mm.recall === bestRecall;
      console.log(
        config.label.padEnd(14) + "│" +
        row.model.padStart(6).padEnd(10) + "│" +
        String(row.feats).padStart(5).padEnd(7) + "│" +
        num(m.n_samples)       + " │" +
        num(m.n_train)         + " │" +
        num(m.n_test)          + " │" +
        (m.pos_rate + "%").padStart(7) + "  │" +
        pct(mm.accuracy)       + "  │" +
        pct(mm.precision)      + "    │" +
        recallStr + (isBest ? " ← BEST" : "       ") + " │" +
        pct(mm.f1)
      );
    }
  }

  console.log(divider);

  // Confusion matrices
  console.log("\nCONFUSION MATRICES (TP / FP / FN / TN)\n");
  for (const { config, metrics: m } of results) {
    if (!m) continue;
    console.log(`  ${config.label} LR(9)  TP=${m.lr.tp}  FP=${m.lr.fp}  FN=${m.lr.fn}  TN=${m.lr.tn}   (threshold=0.5)`);
    console.log(`  ${config.label} NB(8)  TP=${m.nb.tp}  FP=${m.nb.fp}  FN=${m.nb.fn}  TN=${m.nb.tn}   (threshold=0.3)`);
  }

  // Why 6h is best explanation
  console.log("\n" + divider);
  console.log("WHY THE RESULTS LOOK THIS WAY");
  console.log(divider);
  console.log(`
  Recall is the primary metric — it measures how many URGENT bins the model catches.
  Missing an urgent bin (false negative) is the worst outcome in this system.

  This script now uses the same production feature sets as the training routes:
  Logistic Regression uses ${LR_FEATURES.length} features, and Gaussian Naive Bayes uses ${NB_FEATURES.length} features.

  As the window grows from 6h → 24h:

  1. LABEL DISTRIBUTION SHIFTS: A longer lookahead flags more examples as urgent
     because there are more future readings to cross the threshold.
     This inflates the positive rate but makes labels less specific.

  2. FEATURE TREND BECOMES NOISIER: A 24-hour lookback window averages old behavior
     with recent acceleration. A bin that was stable all morning and only started
     filling fast in the last 2 hours looks "moderate" on a 24h slope —
     the trend signal is diluted. The 6h slope sees the recent spike clearly.

  3. TRAINING EXAMPLES DECREASE: Longer windows need more history before and after
     each record. Records near the edges of the deployment period get skipped,
     reducing the number of usable training examples.

  4. PREDICTION LEAD TIME VS ACCURACY TRADEOFF: Predicting 24h ahead is a harder
     problem than predicting 6h ahead — far more can change in 24 hours.
     The model's learned weights are less reliable at longer horizons.

  OPERATIONAL CONCLUSION: Do not choose the window by recall alone. Longer
  horizons can inflate recall by making nearly every example positive. The useful
  window is the one that still catches urgent bins while preserving true negatives,
  usable class balance, and an actionable lead time for campus facilities staff.
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log("  Window Size Comparison — Production 9-feature LR and 8-feature NB");
  console.log("═".repeat(60));
  console.log(`  Threshold: fill ≥ ${FULL_THRESHOLD}% OR smellRisk ≥ ${SMELL_THRESHOLD}`);
  console.log(`  Split: ${(1 - TEST_RATIO) * 100}% train / ${TEST_RATIO * 100}% test (chronological per device)`);
  console.log(`  LR: ${LR_FEATURES.length} features, lr=0.05, epochs=2000, λ=0.5, threshold=0.5`);
  console.log(`  NB: ${NB_FEATURES.length} features, Gaussian NB, threshold=0.3\n`);

  const allDeviceHistories = await fetchAllData();
  const results = [];

  for (const config of CONFIGS) {
    process.stdout.write(`Running config ${config.label} (lookback=${config.lookback}h, lookahead=${config.lookahead}h)... `);
    const metrics = await runConfig(allDeviceHistories, config.lookback, config.lookahead);
    if (metrics) {
      process.stdout.write(
        `LR recall=${(metrics.lr.recall * 100).toFixed(1)}%  NB recall=${(metrics.nb.recall * 100).toFixed(1)}%  samples=${metrics.n_samples}\n`
      );
    } else {
      process.stdout.write("not enough data\n");
    }
    results.push({ config, metrics });
  }

  printTable(results);
}

main().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
