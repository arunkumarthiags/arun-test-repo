import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AGENT_ID } from "../api/client";

export default function TraceExplorer() {
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);

  const traces = useQuery({
    queryKey: ["traces"],
    queryFn: () => api.traces({ agent_id: AGENT_ID, limit: "100" }),
  });

  const a = useQuery({ queryKey: ["trace", selA], enabled: !!selA, queryFn: () => api.trace(selA!) });
  const b = useQuery({ queryKey: ["trace", selB], enabled: !!selB, queryFn: () => api.trace(selB!) });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Trace explorer</h1>
      <p className="muted text-sm">Pick two traces (A / B) to compare side-by-side. Click a row to assign.</p>
      <div className="grid grid-cols-3 gap-4 items-start">
        <div className="card max-h-[70vh] overflow-auto">
          <div className="text-sm font-semibold mb-2">recent traces</div>
          <ul>
            {(traces.data ?? []).map((t: any) => {
              const passed = t.scores?.__rollup__?.passed;
              return (
                <li key={t.id} className="border-b border-edge/40 py-2 text-sm flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${passed ? "bg-good" : "bg-bad"}`} />
                  <span className="font-mono text-xs">{t.id.slice(0, 8)}</span>
                  <span className="muted text-xs">{t.source}</span>
                  <span className="muted text-xs">{t.version}</span>
                  <button className="ml-auto text-xs px-2 py-0.5 bg-edge rounded" onClick={() => setSelA(t.id)}>A</button>
                  <button className="text-xs px-2 py-0.5 bg-edge rounded" onClick={() => setSelB(t.id)}>B</button>
                </li>
              );
            })}
          </ul>
        </div>

        <TracePane label="A" data={a.data} />
        <TracePane label="B" data={b.data} />
      </div>
    </div>
  );
}

function TracePane({ label, data }: { label: string; data: any }) {
  if (!data) return <div className="card max-h-[70vh] overflow-auto"><div className="muted">Pick {label}</div></div>;
  const rollup = data.scores?.__rollup__;
  return (
    <div className="card max-h-[70vh] overflow-auto">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">trace {label} <span className="font-mono text-xs muted">{data.id.slice(0, 8)}</span></div>
        <span className={`text-xs px-2 py-0.5 rounded ${rollup?.passed ? "bg-good text-ink" : "bg-bad text-ink"}`}>
          {rollup?.passed ? "PASS" : "FAIL"} · {(rollup?.overall_score ?? 0).toFixed(2)}
        </span>
      </div>
      <div className="text-xs muted mt-1">v{data.version} · {data.latency_ms}ms · ${data.total_cost_usd?.toFixed(4)} · {data.total_tokens} tok</div>
      <h3 className="mt-3 text-xs uppercase tracking-wide muted">input</h3>
      <pre className="text-xs bg-ink/40 p-2 rounded whitespace-pre-wrap">{JSON.stringify(data.input, null, 2)}</pre>
      <h3 className="mt-3 text-xs uppercase tracking-wide muted">steps</h3>
      <ul className="text-xs space-y-1">
        {(data.steps ?? []).map((s: any, i: number) => (
          <li key={i} className="border border-edge rounded p-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-edge rounded text-[10px]">{s.kind}</span>
              {s.name && <span className="text-slate-300">{s.name}</span>}
              <span className="ml-auto muted">{s.tokens ?? 0} tok · ${(s.cost_usd ?? 0).toFixed(4)} · {s.latency_ms ?? 0}ms</span>
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-xs uppercase tracking-wide muted">scores</h3>
      <ul className="text-xs space-y-1">
        {Object.entries(data.scores ?? {}).filter(([k]) => k !== "__rollup__").map(([k, v]: any) => (
          <li key={k} className="flex justify-between border-b border-edge/40 py-1">
            <span>{k}</span>
            <span className="font-mono">{(v?.score ?? 0).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-xs uppercase tracking-wide muted">output</h3>
      <pre className="text-xs bg-ink/40 p-2 rounded whitespace-pre-wrap">{JSON.stringify(data.output, null, 2)}</pre>
    </div>
  );
}
