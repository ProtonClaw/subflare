import type { DatabaseSync, SQLInputValue, StatementSync } from "node:sqlite";

// Minimal D1Database over node:sqlite, covering what drizzle-orm/d1 uses: prepare/bind/all/raw/run/first/batch.

function toSqlValue(value: unknown): SQLInputValue {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value as SQLInputValue;
}

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly query: string,
    private readonly params: SQLInputValue[] = []
  ) {}

  bind(...values: unknown[]): Statement {
    return new Statement(this.db, this.query, values.map(toSqlValue));
  }

  private prepare(): StatementSync {
    return this.db.prepare(this.query);
  }

  execute(): D1Result {
    const stmt = this.prepare();
    if (stmt.columns().length === 0) {
      const { changes, lastInsertRowid } = stmt.run(...this.params);
      return { success: true, results: [], meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) } } as unknown as D1Result;
    }
    return { success: true, results: stmt.all(...this.params), meta: {} } as unknown as D1Result;
  }

  async all(): Promise<D1Result> {
    return this.execute();
  }

  async run(): Promise<D1Result> {
    return this.execute();
  }

  async raw(): Promise<unknown[][]> {
    const stmt = this.prepare();
    stmt.setReturnArrays(true);
    return stmt.all(...this.params) as unknown as unknown[][];
  }

  async first(column?: string): Promise<unknown> {
    const row = this.prepare().get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return column === undefined ? row : (row[column] ?? null);
  }
}

export function createD1(db: DatabaseSync): D1Database {
  return {
    prepare: (query: string) => new Statement(db, query),
    async batch(statements: Statement[]) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => s.execute());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}
