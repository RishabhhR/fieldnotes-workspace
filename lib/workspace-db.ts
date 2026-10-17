import { createClient, type Client } from "@libsql/client/web";

export type Page = {
  id: string;
  title: string;
  icon: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "bullet"
  | "todo"
  | "quote"
  | "code";

export type Block = {
  id: string;
  pageId: string;
  type: BlockType;
  text: string;
  checked: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("storage_unconfigured");
  client = createClient({ url, authToken });
  return client;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = getClient();
    await db.execute(`CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📄',
      favorite INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS pages_owner_active ON pages(owner_id, archived_at, updated_at)");
    await db.execute(`CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      checked INTEGER NOT NULL DEFAULT 0,
      position REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await db.execute("CREATE INDEX IF NOT EXISTS blocks_owner_page_position ON blocks(owner_id, page_id, position)");
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export function rowToPage(row: Record<string, unknown>): Page {
  return {
    id: String(row.id),
    title: String(row.title),
    icon: String(row.icon),
    favorite: Number(row.favorite) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function rowToBlock(row: Record<string, unknown>): Block {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    type: String(row.type) as BlockType,
    text: String(row.text),
    checked: Number(row.checked) === 1,
    position: Number(row.position),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function now(): string {
  return new Date().toISOString();
}
