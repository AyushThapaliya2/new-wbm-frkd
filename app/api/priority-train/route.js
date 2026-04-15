// app/api/priority-train/route.js
import { createClient } from "@supabase/supabase-js";
import { logisticFit } from "@/lib/ml_logistic.js";
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

// defaults (tune here)
// smellRisk formula: 4*h2s + 2.5*nh3 + 0.2*smoke + temp_factor + humidity_factor
// Max possible (H2S=50ppm, NH3=300ppm, smoke=1000ppm): ~1196
// smell_threshold=600 ≈ 50% of max — represents a bin with genuinely elevated odor.
// (Original threshold of 50 was a unit mismatch bug: smellRisk is NOT on a 0-100 scale.)
const DEF = {
  T_hours: 6,
  window_hours: 6,
  full_threshold: 85,
  smell_threshold: 600,
  min_rows_per_bin: 8,
};

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}

  const model_name = body.model_name ?? body.version ?? "pickup_in_12h_v2";
  const T_hours = Number(body.T_hours ?? DEF.T_hours);
  const window_hours = Number(body.window_hours ?? DEF.window_hours);
  const full_threshold = Number(body.full_threshold ?? DEF.full_threshold);
  const smell_threshold = Number(body.smell_threshold ?? DEF.smell_threshold);

  const historicalCount = await sb
    .from("historical")
    .select("*", { count: "exact", head: true });

  const total_historical_rows = historicalCount.error
    ? null
    : historicalCount.count ?? null;

  // 1) devices
  const dev = await sb
    .from("devices")
    .select("unique_id, bin_height, is_registered")
    .eq("is_registered", true)
    .not("bin_height", "is", null);

  if (dev.error) {
    return new Response(JSON.stringify({ error: dev.error.message }), {
      status: 500,
    });
  }

  // 2) build dataset from historical
  const X = [];
  const y = [];
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
      const feat = {};
      feat.level_in_percents = Number(cur.level_in_percents ?? 0);
      feat.fill_rate = slopePcts(W);
      feat.temp = Number(cur.temp ?? 25);
      feat.humidity = Number(cur.humidity ?? 40);
      feat.h2s = Number(cur.h2s ?? 0);
      feat.nh3 = Number(cur.nh3 ?? 0);
      feat.smoke = Number(cur.smoke ?? 0);

      const gasStats = summarizeGas(W);
      feat.h2s_max_h = gasStats.h2s_max;
      feat.h2s_mean_h = gasStats.h2s_mean;
      feat.nh3_max_h = gasStats.nh3_max;
      feat.nh3_mean_h = gasStats.nh3_mean;
      feat.smoke_max_h = gasStats.smoke_max;
      feat.smoke_mean_h = gasStats.smoke_mean;

      feat.time_since_empty_h = hoursSinceLastEmpty(W);
      feat.smell_risk = smellRisk(feat);

      // label: becomes full OR smelly within T hours?
      let y_i = 0;
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
          y_i = 1;
          break;
        }
      }

      X.push(feat);
      y.push(y_i);
    }
  }

  const features = Object.keys(X[0] ?? {});
  if (!X.length || !features.length) {
    return new Response(
      JSON.stringify({ error: "Not enough historical data to train." }),
      { status: 400 }
    );
  }

  // 3) fit logistic on standardized features
  const fit = logisticFit(X, y, features, {
    lr: 0.05,
    epochs: 2000,
    lambda: 0.5,
  });

  // 4) persist
  const save = await sb.from("priority_weights").upsert({
    model: model_name,
    weights: fit.weights,
    bias: fit.bias,
    meta: {
      features,
      mean: fit.meta?.mean,
      std: fit.meta?.std,
      kind: "logistic_regression",
      T_hours,
      window_hours,
      full_threshold,
      smell_threshold,
      trained_on: new Date().toISOString(),
      y_rate: y.reduce((a, b) => a + b, 0) / y.length,
    },
  });

  if (save.error) {
    return new Response(JSON.stringify({ error: save.error.message }), {
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      model: model_name,
      n_rows: X.length,
      eligible_historical_rows,
      total_historical_rows,
      features,
    }),
    { status: 200 }
  );
}
