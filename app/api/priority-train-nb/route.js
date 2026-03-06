// app/api/priority-train-nb/route.js
import { createClient } from "@supabase/supabase-js";
import { gnbFit } from "@/lib/ml_naive_bayes.js";
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
};

export async function POST(req) {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const model_name_base = body.model_name ?? body.version ?? "pickup_in_12h_v2";
  const model_name = `${model_name_base}_nb`; // store as a different model key
  const T_hours = Number(body.T_hours ?? DEF.T_hours);
  const window_hours = Number(body.window_hours ?? DEF.window_hours);
  const full_threshold = Number(body.full_threshold ?? DEF.full_threshold);
  const smell_threshold = Number(body.smell_threshold ?? DEF.smell_threshold);

  // devices
  const dev = await sb
    .from("devices")
    .select("unique_id, bin_height, is_registered")
    .eq("is_registered", true)
    .not("bin_height", "is", null);
  if (dev.error)
    return new Response(JSON.stringify({ error: dev.error.message }), {
      status: 500,
    });

  const X = [];
  const y = [];

  for (const d of dev.data ?? []) {
    const hist = await sb
      .from("historical")
      .select(
        "unique_id, level_in_percents, saved_time, temp, humidity, h2s_ppm, nh3_ppm, smoke_ppm, ch4_ppm"
      )
      .eq("unique_id", d.unique_id)
      .order("saved_time", { ascending: true });

    if (hist.error) continue;
    const H = hist.data ?? [];
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
      feat.h2s_ppm = Number(cur.h2s_ppm ?? 0);
      feat.nh3_ppm = Number(cur.nh3_ppm ?? 0);
      feat.smoke_ppm = Number(cur.smoke_ppm ?? 0);
      feat.ch4_ppm = Number(cur.ch4_ppm ?? 0);

      const gasStats = summarizeGas(W);
      feat.h2s_max_h = gasStats.h2s_max;
      feat.h2s_mean_h = gasStats.h2s_mean;
      feat.nh3_max_h = gasStats.nh3_max;
      feat.nh3_mean_h = gasStats.nh3_mean;
      feat.smoke_max_h = gasStats.smoke_max;
      feat.smoke_mean_h = gasStats.smoke_mean;

      feat.time_since_empty_h = hoursSinceLastEmpty(W);
      feat.smell_risk = smellRisk(feat);

      let y_i = 0;
      for (const fr of F) {
        const sr = smellRisk({
          temp: fr.temp,
          humidity: fr.humidity,
          h2s_ppm: fr.h2s_ppm,
          nh3_ppm: fr.nh3_ppm,
          smoke_ppm: fr.smoke_ppm,
          ch4_ppm: fr.ch4_ppm,
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

  // Train Gaussian NB
  const fit = gnbFit(X, y, features);

  // Store model in the SAME table you already use, keyed by model name.
  // We'll put params under weights/bias with a recognizable structure.
  const save = await sb.from("priority_weights").upsert({
    model: model_name,
    // For consistency with existing schema:
    weights: { mean: fit.mean, variance: fit.variance, priors: fit.priors },
    bias: 0, // unused by NB
    meta: {
      features,
      kind: "gaussian_nb",
      T_hours,
      window_hours,
      full_threshold,
      smell_threshold,
      trained_on: new Date().toISOString(),
      y_rate: y.reduce((a, b) => a + b, 0) / y.length,
    },
  });
  if (save.error)
    return new Response(JSON.stringify({ error: save.error.message }), {
      status: 500,
    });

  return new Response(
    JSON.stringify({
      ok: true,
      model: model_name,
      n_rows: X.length,
      features,
      meta: fit.meta,
    }),
    { status: 200 }
  );
}
