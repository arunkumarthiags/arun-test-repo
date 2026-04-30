import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AGENT_ID } from "../api/client";
import { useState } from "react";

export default function Settings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.settings() });
  const clusters = useQuery({ queryKey: ["clusters"], queryFn: () => api.clusters(AGENT_ID) });

  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const merge = useMutation({
    mutationFn: () => api.mergeClusters(a, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clusters"] });
      qc.invalidateQueries({ queryKey: ["dist"] });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card">
        <h2 className="font-semibold mb-3">Scorer & alert configuration</h2>
        <pre className="text-xs bg-ink/40 p-3 rounded whitespace-pre-wrap">
{JSON.stringify(settings.data ?? {}, null, 2)}
        </pre>
        <p className="muted text-xs mt-2">Edit these in the API config / env. Surface a UI later.</p>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-3">Failure taxonomy</h2>
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-edge">
            <tr><th className="text-left py-2">id</th><th className="text-left">name</th><th className="text-left">7d</th><th className="text-left">30d</th></tr>
          </thead>
          <tbody>
            {(clusters.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-b border-edge/40">
                <td className="py-2 font-mono text-xs">{c.id.slice(0, 8)}</td>
                <td>{c.name}</td>
                <td>{c.count_7d}</td>
                <td>{c.count_30d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-end gap-2">
          <Input label="merge cluster A id" value={a} onChange={setA} />
          <Input label="into cluster B id" value={b} onChange={setB} />
          <button className="bg-accent text-ink font-semibold px-3 py-1 rounded text-sm" onClick={() => merge.mutate()}>
            merge
          </button>
        </div>
      </section>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs">
      <div className="muted">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} className="bg-ink border border-edge rounded px-2 py-1 font-mono w-72" />
    </label>
  );
}
