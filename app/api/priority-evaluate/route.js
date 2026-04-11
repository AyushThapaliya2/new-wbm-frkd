import { createClient } from "@supabase/supabase-js";
import { logisticFit, logisticPredict } from "@/lib/ml_logistic.js";
import { gnbFit, gnbPredictProba } from "@/lib/ml_naive_bayes.js";
import { binaryMetrics } from "@/lib/ml_metrics.js";
import {
  slopePcts,
  hoursSinceLastEmpty,
  summarizeGas,
  smellRisk,
} from "@/lib/features.js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEF = {
  T_hours: 12,
  window_hours: 6,
  full_threshold: 80,
  smell_threshold: 50,
  min_rows_per_bin: 8,
  test_ratio: 0.2,
};

function splitChronological(samples, testRatio) {
  const byDevice = new Map();
  for (const sample of samples) {
    const key = sample.unique_id;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key).push(sample);
  }

  const train = [];
  const test = [];

  for (const rows of byDevice.values()) {
    rows.sort((a, b) => new Date(a.saved_time) - new Date(b.saved_time));
    const n = rows.length;
    if (n < 2) {
      train.push(...rows);
      continue;
    }

    let testCount = Math.max(1, Math.floor(n * testRatio));
    if (testCount >= n) testCount = n - 1;
    const splitAt = n - testCount;
    train.push(...rows.slice(0, splitAt));
    test.push(...rows.slice(splitAt));
  }

  return { train, test };
}

function unpack(rows) {
  return {
    X: rows.map((r) => r.feat),
    y: rows.map((r) => r.label),
  };
}

async function buildSamples({
  T_hours,
  window_hours,
  full_threshold,
  smell_threshold,
}) {
  const dev = await sb
    .from("devices")
    .select("unique_id, bin_height, is_registered")
    .eq("is_registered", true)
    .not("bin_height", "is", null);

  if (dev.error) {
    throw new Error(dev.error.message);
  }

  const samples = [];
  let eligible_historical_rows = 0;

  for (const d of dev.data ?? []) {
    const hist = await sb
      .from("historical")
      .select(
        "unique_id, level_in_percents, saved_time, temp, humidity, h2s, nh3, smoke"
      )
      .eq("unique_id", d.unique_id)
      .order("saved_time", { ascending: true });

    if (hist.error) continue;
    const H = hist.data ?? [];
    eligible_historical_rows += H.length;
    if (H.length < DEF.min_rows_per_bin) continue;

    for (let i = 2; i < H.length - 2; i++) {
      const tRef = new Date(H[i].saved_time);
      const tStart = new Date(tRef.getTime() - window_hours * 3_600_000);
      const W = H.filter(
        (r) =>
          new Date(r.saved_time) >= tStart && new Date(r.saved_time) <= tRef
      );
      if (W.length < 2) continue;

      const tEnd = new Date(tRef.getTime() + T_hours * 3_600_000);
      const F = H.filter(
        (r) => new Date(r.saved_time) > tRef && new Date(r.saved_time) <= tEnd
      );

      const cur = H[i];
      const feat = {
        level_in_percents: Number(cur.level_in_percents ?? 0),
        fill_rate: slopePcts(W),
        temp: Number(cur.temp ?? 25),
        humidity: Number(cur.humidity ?? 40),
        h2s: Number(cur.h2s ?? 0),
        nh3: Number(cur.nh3 ?? 0),
        smoke: Number(cur.smoke ?? 0),
      };

      const gasStats = summarizeGas(W);
      feat.h2s_max_h = gasStats.h2s_max;
      feat.h2s_mean_h = gasStats.h2s_mean;
      feat.nh3_max_h = gasStats.nh3_max;
      feat.nh3_mean_h = gasStats.nh3_mean;
      feat.smoke_max_h = gasStats.smoke_max;
      feat.smoke_mean_h = gasStats.smoke_mean;
      feat.time_since_empty_h = hoursSinceLastEmpty(W);
      feat.smell_risk = smellRisk(feat);

      let label = 0;
      for (const fr of F) {
        const sr = smellRisk({
          temp: fr.temp,
          humidity: fr.humidity,
          h2s: fr.h2s,
          nh3: fr.nh3,
          smoke: fr.smoke,
        });
        if (
          (fr.level_in_percents ?? 0) >= full_threshold ||
          sr >= smell_threshold
        ) {
          label = 1;
          break;
        }
      }

      samples.push({
        unique_id: d.unique_id,
        saved_time: H[i].saved_time,
        feat,
        label,
      });
    }
  }

  return { samples, eligible_historical_rows };
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {}

    const model_type = body.model_type === "nb" ? "nb" : "logistic";
    const T_hours = Number(body.T_hours ?? DEF.T_hours);
    const window_hours = Number(body.window_hours ?? DEF.window_hours);
    const full_threshold = Number(body.full_threshold ?? DEF.full_threshold);
    const smell_threshold = Number(body.smell_threshold ?? DEF.smell_threshold);
    const test_ratio = Math.min(
      0.5,
      Math.max(0.1, Number(body.test_ratio ?? DEF.test_ratio))
    );

    const historicalCount = await sb
      .from("historical")
      .select("*", { count: "exact", head: true });

    const total_historical_rows = historicalCount.error
      ? null
      : historicalCount.count ?? null;

    const { samples, eligible_historical_rows } = await buildSamples({
      T_hours,
      window_hours,
      full_threshold,
      smell_threshold,
    });

    const features = Object.keys(samples[0]?.feat ?? {});
    if (!samples.length || !features.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not enough historical data to evaluate." }),
        { status: 400 }
      );
    }

    const { train, test } = splitChronological(samples, test_ratio);
    if (!train.length || !test.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Not enough samples to form train/test splits.",
          n_samples: samples.length,
        }),
        { status: 400 }
      );
    }

    const trainData = unpack(train);
    const testData = unpack(test);

    let probs = [];
    if (model_type === "nb") {
      const fit = gnbFit(trainData.X, trainData.y, features);
      probs = testData.X.map((row) => gnbPredictProba(row, fit));
    } else {
      const fit = logisticFit(trainData.X, trainData.y, features, {
        lr: 0.05,
        epochs: 2000,
        lambda: 0.5,
      });
      probs = testData.X.map((row) => logisticPredict(row, fit));
    }

    const metrics = binaryMetrics(testData.y, probs, 0.5);

    return new Response(
      JSON.stringify({
        ok: true,
        model_type,
        split: "chronological_holdout_per_device",
        test_ratio,
        n_samples: samples.length,
        n_train: train.length,
        n_test: test.length,
        eligible_historical_rows,
        total_historical_rows,
        features,
        metrics,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500 }
    );
  }
}
