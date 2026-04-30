const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
export const AGENT_ID = "user-story-agent";

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  health: () => j<{ status: string }>("/health"),
  traces: (params: Record<string, string> = {}) =>
    j<any[]>(`/v1/traces?${new URLSearchParams(params).toString()}`),
  trace: (id: string) => j<any>(`/v1/traces/${id}`),
  evalCases: (params: Record<string, string> = {}) =>
    j<any[]>(`/v1/eval-cases?${new URLSearchParams(params).toString()}`),
  patchCase: (id: string, body: any) =>
    j<any>(`/v1/eval-cases/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  clusters: (agent_id: string) => j<any[]>(`/v1/clusters?agent_id=${agent_id}`),
  distribution: (agent_id: string, days = 7) =>
    j<any>(`/v1/clusters/distribution?agent_id=${agent_id}&window=${days}`),
  mergeClusters: (a: string, b: string) =>
    j<any>(`/v1/clusters/${a}/merge/${b}`, { method: "POST" }),
  jobs: (status?: string) =>
    j<any[]>(`/v1/adversarial/jobs${status ? `?status=${status}` : ""}`),
  decideJob: (id: string, body: any) =>
    j<any>(`/v1/adversarial/jobs/${id}/decide`, { method: "POST", body: JSON.stringify(body) }),
  runs: (agent_id: string) => j<any[]>(`/v1/runs?agent_id=${agent_id}`),
  drift: (agent_id: string) => j<any>(`/v1/drift/${agent_id}`),
  driftSeries: (agent_id: string, days = 30) =>
    j<any>(`/v1/drift/${agent_id}/timeseries?days=${days}`),
  settings: () => j<any>("/v1/settings"),
  runGate: (body: any) => j<any>("/v1/gate", { method: "POST", body: JSON.stringify(body) }),
};
