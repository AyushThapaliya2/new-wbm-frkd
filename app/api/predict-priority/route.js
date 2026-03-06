// app/api/predict-priority/route.js
import { createClient } from "@supabase/supabase-js";
import { logisticPredict } from "@/lib/ml_logistic.js";
import {
  slopePcts,
  summarizeGas,
  hoursSinceLastEmpty,
  smellRisk,
} from "@/lib/features.js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Ops rules (tune as needed)
 * Sensor ranges (DFRobot): H2S 0.5–50; NH3 1–300; Smoke 10–1000; CH4 1–10000
 */
const RULES = {
  SMOKE_CRITICAL: 800, // ppm → top priority
  NH3_CRITICAL: 220, // ppm
  H2S_CRITICAL: 20, // ppm
  FILL_CRITICAL: 90, // % full

  // smooth scoring scales (map ppm → 0..1 roughly around these values)
  SMOKE_SCALE: 600,
  NH3_SCALE: 150,
  H2S_SCALE: 10,

  // final blending
  W_PROB: 0.5, // logistic probability (future risk)
  W_GAS: 0.3, // gas severity (present odor/safety)
  W_FILL: 0.2, // fullness (present operational load)

  // floors when “critical”
  MIN_FOR_CRITICAL_SMOKE: 0.95,
  MIN_FOR_DOUBLE_GAS: 0.9,
  MIN_FOR_FILL_CRITICAL: 0.85,
};

function clamp01(x) {
  return Math.max(0, Math.min(1, Number.isFinite(Number(x)) ? Number(x) : 0));
}

function gasSeverity({ smoke_ppm = 0, nh3_ppm = 0, h2s_ppm = 0 }) {
  const s = clamp01(Number(smoke_ppm) / RULES.SMOKE_SCALE);
  const n = clamp01(Number(nh3_ppm) / RULES.NH3_SCALE);
  const h = clamp01(Number(h2s_ppm) / RULES.H2S_SCALE);
  return clamp01(0.6 * s + 0.3 * n + 0.1 * h);
}

function criticalFlags({
  smoke_ppm = 0,
  nh3_ppm = 0,
  h2s_ppm = 0,
  level_pct = 0,
}) {
  const smokeCritical = smoke_ppm >= RULES.SMOKE_CRITICAL;
  const nh3Critical = nh3_ppm >= RULES.NH3_CRITICAL;
  const h2sCritical = h2s_ppm >= RULES.H2S_CRITICAL;
  const fillCritical = level_pct >= RULES.FILL_CRITICAL;
  const criticalGasCount = [smokeCritical, nh3Critical, h2sCritical].filter(
    Boolean
  ).length;
  return {
    smokeCritical,
    nh3Critical,
    h2sCritical,
    fillCritical,
    criticalGasCount,
  };
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {}
    const model_name = body.model_name ?? "pickup_in_12h_v2";
    const user_window = Number(body.window_hours);

    // Single timestamp for this run (reused below)
    const nowISO = new Date().toISOString();

    // 1) load model
    const W = await sb
      .from("priority_weights")
      .select("*")
      .eq("model", model_name)
      .order("trained_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (W.error || !W.data) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No trained LR model found",
          model_name,
        }),
        { status: 400 }
      );
    }

    const fit = {
      weights: W.data.weights,
      bias: W.data.bias,
      meta: W.data.meta || {},
    };
    const features = Array.isArray(fit.meta.features) ? fit.meta.features : [];
    const T_hours = Number.isFinite(Number(fit.meta.T_hours))
      ? Number(fit.meta.T_hours)
      : 12;
    const window_hours = Number.isFinite(user_window)
      ? user_window
      : Number.isFinite(Number(fit.meta.window_hours))
      ? Number(fit.meta.window_hours)
      : 6;

    if (!features.length) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Model meta.features missing/empty",
          model_name,
        }),
        { status: 400 }
      );
    }
    const mean = fit.meta?.mean;
    const std = fit.meta?.std;
    const hasScale =
      mean &&
      std &&
      features.every(
        (f) =>
          Number.isFinite(Number(mean[f])) &&
          Number.isFinite(Number(std[f])) &&
          Number(std[f]) > 0
      );
    if (!hasScale) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Model normalization stats missing; retrain required",
          model_name,
        }),
        { status: 400 }
      );
    }

    // 2) devices (only registered + known bin_height)
    const dev = await sb
      .from("devices")
      .select(
        "unique_id, bin_height, level, temp, humidity, h2s_ppm, nh3_ppm, smoke_ppm, ch4_ppm, is_registered"
      )
      .eq("is_registered", true)
      .not("bin_height", "is", null);

    if (dev.error) {
      return new Response(
        JSON.stringify({ ok: false, error: dev.error.message }),
        { status: 500 }
      );
    }

    const rows = [];

    // 3) per-device features + predictions
    for (const d of dev.data ?? []) {
      const tStartISO = new Date(
        Date.now() - window_hours * 3_600_000
      ).toISOString();

      const hist = await sb
        .from("historical")
        .select(
          "unique_id, level_in_percents, saved_time, temp, humidity, h2s_ppm, nh3_ppm, smoke_ppm, ch4_ppm"
        )
        .eq("unique_id", d.unique_id)
        .gte("saved_time", tStartISO)
        .order("saved_time", { ascending: true });

      const H = hist.error ? [] : hist.data ?? [];
      const feat = {};

      // Current fullness from geometry (level = cm from top)
      const Hcm = Number(d.bin_height || 0);
      const lvlCm = d.level == null ? Hcm : Number(d.level);
      const level_pct = Hcm
        ? Math.max(0, Math.min(100, Math.round(((Hcm - lvlCm) * 100) / Hcm)))
        : 0;

      // Model features (safe fallbacks)
      feat.level_in_percents = level_pct;

      const histForSlope = H.length
        ? H
        : [{ ...d, level_in_percents: level_pct, saved_time: nowISO }];
      feat.fill_rate = slopePcts(histForSlope);

      feat.temp = Number.isFinite(Number(d.temp)) ? Number(d.temp) : 25;
      feat.humidity = Number.isFinite(Number(d.humidity))
        ? Number(d.humidity)
        : 40;
      feat.h2s_ppm = Number.isFinite(Number(d.h2s_ppm)) ? Number(d.h2s_ppm) : 0;
      feat.nh3_ppm = Number.isFinite(Number(d.nh3_ppm)) ? Number(d.nh3_ppm) : 0;
      feat.smoke_ppm = Number.isFinite(Number(d.smoke_ppm))
        ? Number(d.smoke_ppm)
        : 0;
      feat.ch4_ppm = Number.isFinite(Number(d.ch4_ppm)) ? Number(d.ch4_ppm) : 0;

      const gasStats = summarizeGas(H);
      feat.h2s_max_h = gasStats.h2s_max ?? 0;
      feat.h2s_mean_h = gasStats.h2s_mean ?? 0;
      feat.nh3_max_h = gasStats.nh3_max ?? 0;
      feat.nh3_mean_h = gasStats.nh3_mean ?? 0;
      feat.smoke_max_h = gasStats.smoke_max ?? 0;
      feat.smoke_mean_h = gasStats.smoke_mean ?? 0;

      feat.time_since_empty_h = hoursSinceLastEmpty(H);
      feat.smell_risk = smellRisk(feat);

      // Only pass trained features to the model
      const modelRow = {};
      for (const f of features) modelRow[f] = feat[f] ?? 0;

      const prob = logisticPredict(modelRow, fit); // 0..1

      // Ops-aware final priority
      const gasScore = gasSeverity({
        smoke_ppm: feat.smoke_ppm,
        nh3_ppm: feat.nh3_ppm,
        h2s_ppm: feat.h2s_ppm,
      });
      const fillScore = clamp01(level_pct / 100);

      let ops_priority = clamp01(
        RULES.W_PROB * clamp01(prob) +
          RULES.W_GAS * gasScore +
          RULES.W_FILL * fillScore
      );

      const flags = criticalFlags({
        smoke_ppm: feat.smoke_ppm,
        nh3_ppm: feat.nh3_ppm,
        h2s_ppm: feat.h2s_ppm,
        level_pct,
      });
      if (flags.smokeCritical)
        ops_priority = Math.max(ops_priority, RULES.MIN_FOR_CRITICAL_SMOKE);
      if (flags.criticalGasCount >= 2)
        ops_priority = Math.max(ops_priority, RULES.MIN_FOR_DOUBLE_GAS);
      if (flags.fillCritical)
        ops_priority = Math.max(ops_priority, RULES.MIN_FOR_FILL_CRITICAL);

      rows.push({
        unique_id: d.unique_id,
        level_pct,
        fill_rate: Math.round(feat.fill_rate * 100) / 100,
        smoke_ppm: feat.smoke_ppm,
        nh3_ppm: feat.nh3_ppm,
        h2s_ppm: feat.h2s_ppm,
        smell_risk: Math.round(feat.smell_risk),
        prob_pickup_in_T_hours: clamp01(prob),
        ops_priority: clamp01(ops_priority),
        model_used: model_name,
      });
    }

    // sort by ops priority
    rows.sort((a, b) => b.ops_priority - a.ops_priority);

    // snapshot (reuse the same nowISO defined above)
    if (rows.length) {
      const inserts = rows.map((r) => ({
        unique_id: r.unique_id,
        predicted_priority: r.ops_priority, // store ops-aware score
        predicted_full_at: null,
        model_used: model_name,
        generated_at: nowISO,
        prob_pickup_in_thours: r.prob_pickup_in_T_hours,
        level_pct: r.level_pct,
        fill_rate: r.fill_rate,
        smell_risk: r.smell_risk,
      }));
      const ins = await sb.from("bin_priority_predictions").insert(inserts);
      if (ins.error)
        console.error("[predict] snapshot insert error:", ins.error.message);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        model_name,
        T_hours,
        window_hours,
        generated_at: nowISO,
        ranked: rows,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("[predict] fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message || err) }),
      { status: 500 }
    );
  }
}
