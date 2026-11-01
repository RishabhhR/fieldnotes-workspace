import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { ensureSchema } from "../../lib/workspace-db";

/** A throwaway SQLite file per test file, emptied before each test. Also returns a direct handle for raw assertions. */
export function setupTestDatabase() {
  const handle = { raw: null as unknown as Client };
  let dir = "";
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "fieldnotes-test-"));
    const url = `file:${path.join(dir, "test.db")}`;
    process.env.TURSO_DATABASE_URL = url;
    process.env.TURSO_AUTH_TOKEN = "test-token";
    handle.raw = createClient({ url });
    await ensureSchema();
  });
  beforeEach(async () => {
    await handle.raw.batch(["DELETE FROM blocks", "DELETE FROM pages"], "write");
  });
  afterAll(() => {
    handle.raw.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return handle;
}

/** Every stored row, for proving another user's request changed nothing at all. */
export async function allRows(raw: Client) {
  const pages = await raw.execute("SELECT * FROM pages ORDER BY id");
  const blocks = await raw.execute("SELECT * FROM blocks ORDER BY id");
  return JSON.stringify({ pages: pages.rows, blocks: blocks.rows });
}
