"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_MODEL = "pickup_in_12h_v2";

function num(val, digits = 2) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function pct01(val) {
  const n = Number(val);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "-";
}

function pct100(val) {
  const n = Number(val);
  return Number.isFinite(n) ? `${Math.round(n)}%` : "-";
}

function sensorWithBand(value, band, digits = 1) {
  const base = num(value, digits);
  return band ? `${base} (${band})` : base;
}

export default function PickupListPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [modelType, setModelType] = useState("logistic");
  const [modelName, setModelName] = useState(DEFAULT_MODEL);
  const [windowHours, setWindowHours] = useState("");

  useEffect(() => {
    if (!session) {
      router.push("/login");
    } else {
      router.push("/pickup-list");
    }
  }, [session, router]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint =
        modelType === "nb"
          ? "/api/predict-priority-nb"
          : "/api/predict-priority";
      const payload = { model_name: modelName };
      if (windowHours !== "") payload.window_hours = Number(windowHours);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to load priorities");
      }
      setRows(Array.isArray(data?.ranked) ? data.ranked : []);
      setMeta({
        model_name: data?.model_name,
        T_hours: data?.T_hours,
        window_hours: data?.window_hours,
        generated_at: data?.generated_at,
      });
    } catch (err) {
      setError(String(err?.message || err));
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, modelType, modelName]);

  return (
    <div className="mx-auto p-6 bg-gray-100 rounded-lg shadow-md text-gray-800 font-sans">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Pickup Priority List</h1>
          <p className="text-sm text-gray-600">
            Ranked bins from the ML model. Higher priority means earlier pickup.
          </p>
          {meta?.generated_at && (
            <p className="text-xs text-gray-500 mt-1">
              Generated: {new Date(meta.generated_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-600">Model</label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="p-2 border border-gray-300 rounded"
            >
              <option value="logistic">Logistic</option>
              <option value="nb">Naive Bayes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Model name</label>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="p-2 border border-gray-300 rounded"
              placeholder="pickup_in_12h_v2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Window hours</label>
            <input
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="p-2 border border-gray-300 rounded w-24"
              placeholder="auto"
            />
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Predicting..." : "Predict"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {meta && (
        <div className="text-sm text-gray-700 mb-3">
          <span className="mr-4">Model: {meta.model_name}</span>
          <span className="mr-4">T_hours: {meta.T_hours ?? "-"}</span>
          <span>Window: {meta.window_hours ?? "-"}h</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-200 text-gray-700">
            <tr>
              <th className="text-left p-3">Rank</th>
              <th className="text-left p-3">Device</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Prob (T)</th>
              <th className="text-left p-3">Level</th>
              <th className="text-left p-3">Fill rate</th>
              <th className="text-left p-3">Smell</th>
              <th className="text-left p-3">H2S</th>
              <th className="text-left p-3">NH3</th>
              <th className="text-left p-3">Smoke</th>
              <th className="text-left p-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={11}>
                  No priority data yet. Run training and prediction first.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.unique_id ?? i} className="border-b last:border-b-0">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3">{r.unique_id ?? "-"}</td>
                  <td className="p-3 font-semibold">{pct01(r.ops_priority)}</td>
                  <td className="p-3">{pct01(r.prob_pickup_in_T_hours)}</td>
                  <td className="p-3">{pct100(r.level_pct)}</td>
                  <td className="p-3">{num(r.fill_rate)}</td>
                  <td className="p-3">{num(r.smell_risk, 0)}</td>
                  <td className="p-3">{sensorWithBand(r.h2s, r.h2s_band)}</td>
                  <td className="p-3">{sensorWithBand(r.nh3, r.nh3_band)}</td>
                  <td className="p-3">
                    {sensorWithBand(r.smoke, r.smoke_band)}
                  </td>
                  <td className="p-3">{r.primary_reason ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
