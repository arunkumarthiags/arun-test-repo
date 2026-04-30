import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, AGENT_ID } from "../api/client";

export default function DeployGate() {
  const qc = useQueryClient();
  const [version, setVersion] = useState("v1.5-rc1");
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api.runs(AGENT_ID) });

  const runGate = useMutation({
    mutationFn: () =>
      api.runGate({
        agent_id: AGENT_ID,
        agent_version: version,
        fail_on_regression: true,
        concurrency: 8,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs"] }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Deploy gate</h1>

      <section className="card flex items-end gap-3">
        <label className="text-sm">
          <div className="muted text-xs">candidate version</div>
          <input
            value={version}
            onChange={e => setVersion(e.target.value)}
            className="bg-ink border border-edge rounded px-2 py-1 font-mono text-sm w-48"
          />
        </label>
        <button
          className="bg-accent text-ink font-semibold px-4 py-2 rounded text-sm"
          onClick={() => runGate.mutate()}
          disabled={runGate.isPending}
        >
          {runGate.isPending ? "running…" : "run gate"}
        </button>
        {runGate.data && (
          <span className={`text-sm ${runGate.data.exit_code ? "text-bad" : "text-good"}`}>
            exit {runGate.data.exit_code} · pass {(runGate.data.pass_rate * 100).toFixed(1)}% · {runGate.data.n_regressions} regressions
            {runGate.data.cached && <span className="ml-2 muted">(cached)</span>}
          </span>
        )}
      </section>

      <section className="card overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-edge">
            <tr>
              <th className="text-left py-2">version</th>
              <th className="text-left">when</th>
              <th className="text-left">pass</th>
              <th className="text-left">regs</th>
              <th className="text-left">cost</th>
              <th className="text-left">cost Δ</th>
              <th className="text-left">p50</th>
              <th className="text-left">p50 Δ</th>
              <th className="text-left">cache</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((r: any) => (
              <tr key={r.id} className="border-b border-edge/40">
                <td className="py-2 font-mono">{r.agent_version}</td>
                <td className="muted text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td>{(r.pass_rate * 100).toFixed(1)}%</td>
                <td className={r.n_regressions ? "text-bad" : "text-good"}>{r.n_regressions}</td>
                <td className="font-mono">${r.cost_usd.toFixed(4)}</td>
                <td className="font-mono">${r.cost_delta_usd.toFixed(4)}</td>
                <td>{r.latency_p50_ms}ms</td>
                <td>{r.latency_delta_ms}ms</td>
                <td className="muted text-xs">{r.cached ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
