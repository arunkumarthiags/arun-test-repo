import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EvalCorpus from "./pages/EvalCorpus";
import TraceExplorer from "./pages/TraceExplorer";
import DeployGate from "./pages/DeployGate";
import Settings from "./pages/Settings";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/corpus", label: "Eval Corpus" },
  { to: "/traces", label: "Trace Explorer" },
  { to: "/gate", label: "Deploy Gate" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-edge bg-steel p-4">
        <div className="text-xl font-bold mb-1 tracking-tight">Gauntlet</div>
        <div className="text-xs muted mb-6">eval-as-CI/CD</div>
        <nav className="flex flex-col gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm ${isActive ? "bg-edge text-white" : "text-slate-300 hover:bg-edge/50"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/corpus" element={<EvalCorpus />} />
          <Route path="/traces" element={<TraceExplorer />} />
          <Route path="/gate" element={<DeployGate />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
