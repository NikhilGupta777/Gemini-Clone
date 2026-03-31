import { Route, Switch } from "wouter";
import { useSimulation } from "./hooks/useSimulation";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import AlertHistory from "./pages/AlertHistory";
import Settings from "./pages/Settings";

function getThreatLevel(anomalyCount: number, types: string[]): "secure" | "warning" | "critical" {
  if (anomalyCount === 0) return "secure";
  if (types.includes("running")) return "critical";
  if (types.includes("unattended_object")) return "critical";
  return "warning";
}

export default function App() {
  const { frame, connected } = useSimulation();

  const anomalyTypes = frame?.anomalies.map((a) => a.type) ?? [];
  const threatLevel = getThreatLevel(frame?.anomalies.length ?? 0, anomalyTypes);

  return (
    <Layout connected={connected} threatLevel={threatLevel}>
      <Switch>
        <Route path="/" component={() => <Dashboard frame={frame} connected={connected} />} />
        <Route path="/history" component={AlertHistory} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div style={{ color: "#64748b", padding: 40 }}>Page not found</div>
        </Route>
      </Switch>
    </Layout>
  );
}
