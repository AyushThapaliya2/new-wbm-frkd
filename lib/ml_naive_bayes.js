// lib/ml_naive_bayes.js
// Simple Gaussian Naive Bayes (binary: y ∈ {0,1}) with log-space scoring.

function safeVar(v) {
  // avoid zero variance; tiny ridge
  const EPS = 1e-6;
  return v > EPS ? v : EPS;
}

// Train GNB parameters: per-class mean/var for each feature + class priors
export function gnbFit(X, y, features) {
  if (!Array.isArray(X) || !X.length) throw new Error("No rows to fit");
  if (X.length !== y.length) throw new Error("X/y length mismatch");
  if (!Array.isArray(features) || !features.length) {
    throw new Error("No features");
  }

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
    const row = X[i];
    for (const f of features) {
      const v = Number(row[f] ?? 0);
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

  return {
    classes,
    priors,
    mean,
    variance,
    meta: { features, kind: "gaussian_nb" },
  };
}

// Log Gaussian PDF (up to additive const)
function logGauss(x, mu, varv) {
  const v = safeVar(varv);
  const diff = x - mu;
  return -0.5 * (Math.log(2 * Math.PI * v) + (diff * diff) / v);
}

// Return P(y=1 | x) using log-sum-exp
export function gnbPredictProba(row, fit) {
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

  // log-sum-exp for normalization
  const a = Math.max(logp[0], logp[1]);
  const p0 = Math.exp(logp[0] - a);
  const p1 = Math.exp(logp[1] - a);
  const Z = p0 + p1;
  return p1 / Math.max(1e-12, Z);
}

export function gnbPredictBatch(rows, fit) {
  return rows.map((r) => gnbPredictProba(r, fit));
}
