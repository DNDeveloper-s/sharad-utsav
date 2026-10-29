import { Pool, type PoolClient } from "pg";

// The little bit of a database we need. Keeping it this small means the
// real Postgres (Neon) and the in-memory one used by tests both fit it.
export type Row = Record<string, unknown>;

export type Db = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Row[]; rowCount: number }>;
  // Runs `work` in one transaction: all of it happens, or none of it does.
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
};

function clientDb(client: PoolClient): Db {
  return {
    async query(sql, params = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    transaction() {
      throw new Error("Already inside a transaction");
    },
  };
}

function poolDb(pool: Pool): Db {
  return {
    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(clientDb(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let db: Db | undefined;

// Created on first use, so `next build` works without DATABASE_URL.
// Vercel functions are reused between requests, so the pool is too.
export function getDb(): Db {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    db = poolDb(new Pool({ connectionString, max: 5 }));
  }
  return db;
}
