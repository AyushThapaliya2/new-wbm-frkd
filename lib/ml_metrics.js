function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function binaryMetrics(yTrue, probs, threshold = 0.5) {
  const y = Array.isArray(yTrue) ? yTrue.map((v) => (Number(v) === 1 ? 1 : 0)) : [];
  const p = Array.isArray(probs) ? probs.map((v) => clamp01(v)) : [];
  if (!y.length || y.length !== p.length) {
    throw new Error("binaryMetrics requires equally-sized non-empty arrays");
  }

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  for (let i = 0; i < y.length; i++) {
    const pred = p[i] >= threshold ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp += 1;
    else if (pred === 0 && y[i] === 0) tn += 1;
    else if (pred === 1 && y[i] === 0) fp += 1;
    else fn += 1;
  }

  const total = y.length;
  const accuracy = (tp + tn) / Math.max(1, total);
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 =
    (2 * precision * recall) / Math.max(1e-12, precision + recall);

  return {
    threshold,
    total,
    positives: y.reduce((a, b) => a + b, 0),
    negatives: total - y.reduce((a, b) => a + b, 0),
    accuracy,
    precision,
    recall,
    f1,
    confusion_matrix: {
      tp,
      tn,
      fp,
      fn,
    },
  };
}
