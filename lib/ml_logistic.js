// lib/ml_logistic.js (ESM)

// Z-score each feature on the training set, store mean/std in meta
export function standardize(X, features) {
  const mean = {},
    std = {};
  for (const f of features) {
    const vals = X.map((r) =>
      Number.isFinite(Number(r[f])) ? Number(r[f]) : 0
    );
    const m = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const v =
      vals.reduce((s, v) => s + (v - m) * (v - m), 0) /
      Math.max(1, vals.length);
    mean[f] = m;
    std[f] = Math.sqrt(v) || 1;
  }
  const Z = X.map((r) =>
    features.map((f) => (Number(r[f] ?? 0) - (mean[f] ?? 0)) / (std[f] || 1))
  );
  return { Z, mean, std };
}

function sigmoid(z) {
  const zc = Math.max(-40, Math.min(40, z));
  return 1 / (1 + Math.exp(-zc));
}

// Simple L2-regularized logistic regression (GD)
export function logisticFit(
  X,
  y,
  features,
  { lr = 0.2, epochs = 1500, lambda = 0.001 } = {}
) {
  if (!X.length) throw new Error("No rows to fit");
  if (X.length !== y.length) throw new Error("X/y length mismatch");

  const { Z, mean, std } = standardize(X, features);
  const n = Z.length,
    d = features.length;
  let b = 0;
  const w = Array(d).fill(0);

  for (let ep = 0; ep < epochs; ep++) {
    let gb = 0;
    const gw = Array(d).fill(0);

    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const p = sigmoid(z);
      const err = p - y[i];
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

// Predict single row with stored scaling/meta
export function logisticPredict(row, fit) {
  const { features, mean, std } = fit.meta || {};
  if (!features || !Array.isArray(features)) return 0.5;
  let z = fit.bias ?? 0;
  for (const f of features) {
    const val = (Number(row[f] ?? 0) - (mean?.[f] ?? 0)) / (std?.[f] || 1);
    z += (fit.weights?.[f] ?? 0) * val;
  }
  return sigmoid(z);
}

// Batch predict
export function logisticPredictBatch(rows, fit) {
  return rows.map((r) => logisticPredict(r, fit));
}
