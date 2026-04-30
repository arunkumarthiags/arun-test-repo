import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, AGENT_ID } from "../api/client";

export default function EvalCorpus() {
  const qc = useQueryClient();
  const [cluster, setCluster] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [golden, setGolden] = useState<string>("");

  const cases = useQuery({
    queryKey: ["cases", cluster, method, diff, golden],
    queryFn: () => {
      const p: Record<string, string> = { agent_id: AGENT_ID };
      if (cluster) p.cluster_tag = cluster;
      if (method) p.generation_method = method;
      if (diff) p.difficulty = diff;
      if (golden) p.golden = golden;
      return api.evalCases(p);
    },
  });

  const jobs = useQuery({ queryKey: ["jobs", "review"], queryFn: () => api.jobs("review") });

  const decideMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.decideJob(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
  });

  const filteredCount = cases.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Eval corpus</h1>

      <section className="card">
        <h2 className="font-semibold mb-2">Adversarial review queue</h2>
        {(jobs.data ?? []).length === 0 && (
          <p className="muted text-sm">no jobs awaiting review.</p>
        )}
        {(jobs.data ?? []).map((j: any) => (
          <ReviewJob key={j.id} job={j} onDecide={(body) => decideMut.mutate({ id: j.id, body })} />
        ))}
      </section>

      <section>
        <div className="flex gap-2 mb-3 flex-wrap">
          <Filter label="cluster" value={cluster} onChange={setCluster} options={[
            "", "compliance_language_failure", "international_context", "regulatory_feature",
            "ambiguous_requirement", "nested_dependency",
          ]} />
          <Filter label="method" value={method} onChange={setMethod} options={["", "human", "adversarial", "promoted_from_production"]} />
          <Filter label="difficulty" value={diff} onChange={setDiff} options={["", "1", "2", "3", "4", "5"]} />
          <Filter label="golden" value={golden} onChange={setGolden} options={["", "true", "false"]} />
          <span className="ml-auto text-sm muted self-center">{filteredCount} cases</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(cases.data ?? []).map((c: any) => (
            <article key={c.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-mono text-slate-400">{c.id.slice(0, 8)}</div>
                <div className="flex gap-1">
                  <Tag>{c.cluster_tag}</Tag>
                  <Tag>{c.generation_method}</Tag>
                  <Tag>diff {c.difficulty}</Tag>
                  {c.golden && <Tag tone="good">★ golden</Tag>}
                </div>
              </div>
              <div className="mt-2 text-sm">{(c.input?.request ?? JSON.stringify(c.input)).slice(0, 220)}</div>
              <div className="mt-1 text-xs muted">{(c.rubric ?? "").slice(0, 200)}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="muted">{label}</span>
      <select className="bg-edge border border-edge rounded px-2 py-1" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o || "(any)"}</option>)}
      </select>
    </label>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "good" }) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone === "good" ? "border-good text-good" : "border-edge text-slate-300"}`}>{children}</span>;
}

function ReviewJob({ job, onDecide }: { job: any; onDecide: (b: any) => void }) {
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const cases = (job.generated_cases ?? []) as any[];
  const setOne = (idx: number, v: boolean) => setDecisions(d => ({ ...d, [String(idx)]: v }));

  const submit = () => {
    onDecide({ approvals: decisions, notes: "Reviewed in dashboard" });
    setDecisions({});
  };

  return (
    <div className="border border-edge rounded p-3 mb-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          job <span className="font-mono">{job.id.slice(0, 8)}</span> · {cases.length} variants ·
          <span className="ml-2 muted">cluster {job.cluster_id.slice(0, 8)}</span>
        </div>
        <button className="bg-accent text-ink font-semibold px-3 py-1 rounded text-sm" onClick={submit}>
          Submit decisions
        </button>
      </div>
      <ul className="mt-2 space-y-1 text-sm max-h-72 overflow-auto">
        {cases.map((c, i) => (
          <li key={i} className="flex items-start gap-2 border-b border-edge/40 py-1">
            <span className="text-xs px-2 py-0.5 rounded bg-edge text-slate-300 mr-1">{c.strategy}</span>
            <span className="text-xs muted">d{c.difficulty}</span>
            <span className="flex-1 truncate">{(c.input?.request ?? JSON.stringify(c.input)).slice(0, 180)}</span>
            <button className={`px-2 py-0.5 text-xs rounded ${decisions[String(i)] === true ? "bg-good text-ink" : "bg-edge"}`} onClick={() => setOne(i, true)}>approve</button>
            <button className={`px-2 py-0.5 text-xs rounded ${decisions[String(i)] === false ? "bg-bad text-ink" : "bg-edge"}`} onClick={() => setOne(i, false)}>reject</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
