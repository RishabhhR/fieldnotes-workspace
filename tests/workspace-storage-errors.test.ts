// Fresh modules per test because lib/workspace-db.ts caches its client.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { session } from "./helpers/session";

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  session.userId = "user_alice";
});
afterEach(() => vi.restoreAllMocks());

it("missing configuration answers storage_unconfigured", async () => {
  const { GET } = await import("../app/api/workspace/route");
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "storage_unconfigured" });
});

it("a database failure answers storage_unavailable and reveals no details", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fieldnotes-test-"));
  process.env.TURSO_DATABASE_URL = `file:${path.join(dir, "no-such-dir", "secret-name.db")}`;
  process.env.TURSO_AUTH_TOKEN = "test-token";
  const { GET, POST } = await import("../app/api/workspace/route");
  const read = await GET();
  expect(read.status).toBe(503);
  const text = await read.text();
  expect(JSON.parse(text)).toEqual({ error: "storage_unavailable" });
  expect(text).not.toContain("secret-name");
  const write = await POST(new Request("http://test.local/api/workspace", { method: "POST", body: JSON.stringify({ action: "createPage" }) }));
  expect(write.status).toBe(503);
  rmSync(dir, { recursive: true, force: true });
});

it("the safety net refuses a remote database URL", async () => {
  process.env.TURSO_DATABASE_URL = "libsql://production.example.turso.io";
  process.env.TURSO_AUTH_TOKEN = "test-token";
  const { getClient } = await import("../lib/workspace-db");
  expect(() => getClient()).toThrow("local file database");
});

it("the safety net blocks outgoing network and removes real credentials", async () => {
  await expect(fetch("https://example.com")).rejects.toThrow("Network is blocked");
  expect(Object.keys(process.env).filter((key) => /^(CLERK_|NEXT_PUBLIC_CLERK_)/.test(key))).toEqual([]);
});
