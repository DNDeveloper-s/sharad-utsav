// Only used by tests: a real Postgres running in memory (PGlite), set up
// with the same schema.sql and seed.sql as production.
import { readFileSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db, Row } from "./db";

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function sqlFile(name: string): string {
  return readFileSync(new URL(`../../db/${name}`, import.meta.url), "utf8");
}

function wrap(connection: PGlite | Transaction, pglite: PGlite): Db {
  return {
    async query(sql, params = []) {
      const result = await connection.query(sql, params);
      return { rows: result.rows.filter(isRow), rowCount: result.affectedRows ?? result.rows.length };
    },
    transaction(work) {
      if (connection !== pglite) throw new Error("Already inside a transaction");
      return pglite.transaction((tx) => work(wrap(tx, pglite)));
    },
  };
}

export async function createTestDb(): Promise<Db> {
  const pglite = new PGlite();
  await pglite.exec(sqlFile("schema.sql"));
  await pglite.exec(sqlFile("seed.sql"));
  return wrap(pglite, pglite);
}
