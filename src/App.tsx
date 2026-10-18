import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { api } from "./lib/api";

type Health = InferResponseType<typeof api.health.$get>;

function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health
      .$get()
      .then((res) => res.json())
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-6 font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">SubFlare</h1>
      {error && <p className="text-red-600">{error}</p>}
      {!health && !error && <p className="text-zinc-500">Checking…</p>}
      {health && (
        <ul className="divide-y rounded-xl border">
          {Object.entries(health.checks).map(([name, check]) => (
            <li key={name} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium uppercase">{name}</span>
              <span className={check.ok ? "text-emerald-600" : "text-red-600"}>
                {check.ok ? `ok · ${check.latencyMs}ms` : check.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
