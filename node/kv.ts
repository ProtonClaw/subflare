import type { DatabaseSync } from "node:sqlite";

// Minimal text-only KVNamespace stored in the same SQLite file.
export function createKV(db: DatabaseSync): KVNamespace {
  db.exec("CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const getStmt = db.prepare("SELECT value FROM _kv WHERE key = ?");
  const putStmt = db.prepare("INSERT INTO _kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  const deleteStmt = db.prepare("DELETE FROM _kv WHERE key = ?");
  return {
    async get(key: string) {
      return (getStmt.get(key) as { value: string } | undefined)?.value ?? null;
    },
    async put(key: string, value: string) {
      putStmt.run(key, value);
    },
    async delete(key: string) {
      deleteStmt.run(key);
    },
  } as unknown as KVNamespace;
}
