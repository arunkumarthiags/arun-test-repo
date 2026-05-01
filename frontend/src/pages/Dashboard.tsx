import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { api, AGENT_ID } from "../api/client";

export default function Dashboard() {
  const dist = useQuery({ queryKey: ["dist"], queryFn: () => api.distribution(AGENT_ID, 7) });
  const series = useQuery({ queryKey: ["drift-series"], queryFn: () => api.driftSeries(AGENT_ID, 30) });
  const drift = useQuery({ queryKey: ["drift"], queryFn: () => api.drift(AGENT_ID) });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api.runs(AGENT_ID) });

  const driftPoints = (series.data?.points ?? []).map((p: any) => ({
    ts: p.ts.slice(0, 10),
    eval: Math.round((p.eval_pass_rate ?? 0) * 100),
    prod: Math.round((p.prod_pass_rate_7d ?? 0) * 100),
    delta: p.delta_pct,
  }));

  const distBuckets = (dist.data?.buckets ?? []).map((b: any) => ({
    name: b.name,
    count: b.count,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard — {AGENT_ID}</h1>
        <p className="muted text-sm">Eval as CI/CD. The chart that matters: eval vs production pass rate.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Stat label="Eval pass rate" value={pct(drift.data?.eval_pass_rate)} tone="good" />
        <Stat label="Prod pass rate (7d)" value={pct(drift.data?.prod_pass_rate_7d)} tone="warn" />
        <Stat
          label="Eval-to-prod gap"
          value={`${(drift.data?.delta_pct ?? 0).toFixed(1)} pp`}
          tone={(drift.data?.delta_pct ?? 0) > (drift.data?.threshold_pct ?? 10) ? "bad" : "good"}
          sub={drift.data?.alert_fired ? "ALERT — drift threshold exceeded" : "within threshold"}
        />
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Eval vs production pass rate (last 30 days)</h2>
          <span className="text-xs muted">the single most important chart in the product</span>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={driftPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
              <XAxis dataKey="ts" stroke="#94a3b8" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: "#1c2230", border: "1px solid #2a3142" }} />
              <Legend />
              <Line type="monotone" dataKey="eval" stroke="#34d399" name="eval" dot={false} />
              <Line type="monotone" dataKey="prod" stroke="#f87171" name="production (7d)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-2">Failure distribution (7d)</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={distBuckets} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={150} />
                <Tooltip contentStyle={{ background: "#1c2230", border: "1px solid #2a3142" }} />
                <Bar dataKey="count" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-2">Recent deploy gate runs</h2>
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-edge">
              <tr><th className="text-left py-2">version</th><th className="text-left">pass</th><th className="text-left">regs</th><th className="text-left">cost Δ</th></tr>
            </thead>
            <tbody>
              {(runs.data ?? []).slice(0, 8).map((r: any) => (
                <tr key={r.id} className="border-b border-edge/40">
                  <td className="py-2 font-mono">{r.agent_version}</td>
                  <td>{(r.pass_rate * 100).toFixed(1)}%</td>
                  <td className={r.n_regressions ? "text-bad" : "text-good"}>{r.n_regressions}</td>
                  <td className="font-mono">${r.cost_delta_usd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone: "good" | "warn" | "bad"; sub?: string }) {
  const colour = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-amber-300";
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide muted">{label}</div>
      <div className={`text-3xl font-bold ${colour}`}>{value}</div>
      {sub && <div className="text-xs muted mt-1">{sub}</div>}
    </div>
  );
}

function pct(v?: number) {
  if (v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
