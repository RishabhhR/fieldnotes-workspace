import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  ensureSchema,
  getClient,
  now,
  rowToBlock,
  rowToPage,
  type Block,
  type Page,
} from "../../../lib/workspace-db";

export const dynamic = "force-dynamic";

const blockType = z.enum([
  "paragraph", "heading1", "heading2", "bullet", "todo", "quote", "code",
]);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createPage"), title: z.string().max(120).optional() }),
  z.object({ action: z.literal("updatePage"), pageId: z.string().uuid(), title: z.string().max(200).optional(), icon: z.string().max(16).optional(), favorite: z.boolean().optional() }),
  z.object({ action: z.literal("archivePage"), pageId: z.string().uuid() }),
  z.object({ action: z.literal("createBlock"), pageId: z.string().uuid(), afterId: z.string().uuid().nullable().optional(), type: blockType.optional(), text: z.string().max(50_000).optional() }),
  z.object({ action: z.literal("updateBlock"), blockId: z.string().uuid(), text: z.string().max(50_000).optional(), type: blockType.optional(), checked: z.boolean().optional() }),
  z.object({ action: z.literal("deleteBlock"), blockId: z.string().uuid() }),
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function storageError(error: unknown) {
  console.error("Workspace storage error", error);
  return jsonError(error instanceof Error && error.message === "storage_unconfigured" ? "storage_unconfigured" : "storage_unavailable", 503);
}

async function requireOwner() {
  const user = await getChatGPTUser();
  return user?.userId ?? null;
}

async function activePage(ownerId: string, pageId: string) {
  const result = await getClient().execute({
    sql: "SELECT * FROM pages WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
    args: [pageId, ownerId],
  });
  return result.rows[0] ?? null;
}

export async function GET() {
  const ownerId = await requireOwner();
  if (!ownerId) return jsonError("unauthorized", 401);
  try {
    await ensureSchema();
    const db = getClient();
    let pagesResult = await db.execute({
      sql: "SELECT * FROM pages WHERE owner_id = ? AND archived_at IS NULL ORDER BY favorite DESC, updated_at DESC",
      args: [ownerId],
    });
    if (pagesResult.rows.length === 0) {
      const id = crypto.randomUUID();
      const timestamp = now();
      await db.batch([
        { sql: "INSERT INTO pages(id, owner_id, title, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [id, ownerId, "Welcome to Fieldnotes", "✦", timestamp, timestamp] },
        { sql: "INSERT INTO blocks(id, page_id, owner_id, type, text, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [crypto.randomUUID(), id, ownerId, "paragraph", "A quiet place for your ideas. Create a page, write a thought, or use the block menu to structure what comes next.", 1000, timestamp, timestamp] },
      ], "write");
      pagesResult = await db.execute({
        sql: "SELECT * FROM pages WHERE owner_id = ? AND archived_at IS NULL ORDER BY favorite DESC, updated_at DESC",
        args: [ownerId],
      });
    }
    const blocksResult = await db.execute({
      sql: "SELECT b.* FROM blocks b JOIN pages p ON p.id = b.page_id WHERE b.owner_id = ? AND p.owner_id = ? AND p.archived_at IS NULL ORDER BY b.page_id, b.position, b.created_at",
      args: [ownerId, ownerId],
    });
    return NextResponse.json({
      pages: pagesResult.rows.map((row) => rowToPage(row as Record<string, unknown>)),
      blocks: blocksResult.rows.map((row) => rowToBlock(row as Record<string, unknown>)),
    });
  } catch (error) {
    return storageError(error);
  }
}

export async function POST(request: Request) {
  const ownerId = await requireOwner();
  if (!ownerId) return jsonError("unauthorized", 401);
  let input: z.infer<typeof actionSchema>;
  try {
    input = actionSchema.parse(await request.json());
  } catch {
    return jsonError("invalid_request", 400);
  }
  try {
    await ensureSchema();
    const db = getClient();
    const timestamp = now();

    if (input.action === "createPage") {
      const page: Page = { id: crypto.randomUUID(), title: input.title?.trim() || "Untitled", icon: "📄", favorite: false, createdAt: timestamp, updatedAt: timestamp };
      const block: Block = { id: crypto.randomUUID(), pageId: page.id, type: "paragraph", text: "", checked: false, position: 1000, createdAt: timestamp, updatedAt: timestamp };
      await db.batch([
        { sql: "INSERT INTO pages(id, owner_id, title, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [page.id, ownerId, page.title, page.icon, timestamp, timestamp] },
        { sql: "INSERT INTO blocks(id, page_id, owner_id, type, text, checked, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [block.id, page.id, ownerId, block.type, block.text, 0, block.position, timestamp, timestamp] },
      ], "write");
      return NextResponse.json({ page, block });
    }

    if (input.action === "updatePage") {
      if (!await activePage(ownerId, input.pageId)) return jsonError("not_found", 404);
      const fields: string[] = [];
      const args: Array<string | number> = [];
      if (input.title !== undefined) { fields.push("title = ?"); args.push(input.title.trim() || "Untitled"); }
      if (input.icon !== undefined) { fields.push("icon = ?"); args.push(input.icon || "📄"); }
      if (input.favorite !== undefined) { fields.push("favorite = ?"); args.push(input.favorite ? 1 : 0); }
      if (fields.length === 0) return jsonError("no_changes", 400);
      fields.push("updated_at = ?"); args.push(timestamp, input.pageId, ownerId);
      await db.execute({ sql: `UPDATE pages SET ${fields.join(", ")} WHERE id = ? AND owner_id = ? AND archived_at IS NULL`, args });
      return NextResponse.json({ updatedAt: timestamp });
    }

    if (input.action === "archivePage") {
      const result = await db.execute({
        sql: "UPDATE pages SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND archived_at IS NULL",
        args: [timestamp, timestamp, input.pageId, ownerId],
      });
      return result.rowsAffected ? NextResponse.json({ ok: true }) : jsonError("not_found", 404);
    }

    if (input.action === "createBlock") {
      if (!await activePage(ownerId, input.pageId)) return jsonError("not_found", 404);
      let position = 1000;
      if (input.afterId) {
        const previous = await db.execute({ sql: "SELECT position FROM blocks WHERE id = ? AND page_id = ? AND owner_id = ?", args: [input.afterId, input.pageId, ownerId] });
        if (!previous.rows[0]) return jsonError("not_found", 404);
        const priorPosition = Number(previous.rows[0].position);
        const next = await db.execute({ sql: "SELECT position FROM blocks WHERE page_id = ? AND owner_id = ? AND position > ? ORDER BY position LIMIT 1", args: [input.pageId, ownerId, priorPosition] });
        position = next.rows[0] ? (priorPosition + Number(next.rows[0].position)) / 2 : priorPosition + 1000;
      } else {
        const first = await db.execute({ sql: "SELECT MIN(position) AS position FROM blocks WHERE page_id = ? AND owner_id = ?", args: [input.pageId, ownerId] });
        position = first.rows[0]?.position == null ? 1000 : Number(first.rows[0].position) - 1000;
      }
      const block: Block = { id: crypto.randomUUID(), pageId: input.pageId, type: input.type ?? "paragraph", text: input.text ?? "", checked: false, position, createdAt: timestamp, updatedAt: timestamp };
      await db.execute({ sql: "INSERT INTO blocks(id, page_id, owner_id, type, text, checked, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [block.id, block.pageId, ownerId, block.type, block.text, 0, position, timestamp, timestamp] });
      await db.execute({ sql: "UPDATE pages SET updated_at = ? WHERE id = ? AND owner_id = ?", args: [timestamp, input.pageId, ownerId] });
      return NextResponse.json({ block });
    }

    if (input.action === "updateBlock") {
      const fields: string[] = [];
      const args: Array<string | number> = [];
      if (input.text !== undefined) { fields.push("text = ?"); args.push(input.text); }
      if (input.type !== undefined) { fields.push("type = ?"); args.push(input.type); }
      if (input.checked !== undefined) { fields.push("checked = ?"); args.push(input.checked ? 1 : 0); }
      if (fields.length === 0) return jsonError("no_changes", 400);
      fields.push("updated_at = ?"); args.push(timestamp, input.blockId, ownerId);
      const result = await db.execute({ sql: `UPDATE blocks SET ${fields.join(", ")} WHERE id = ? AND owner_id = ? AND page_id IN (SELECT id FROM pages WHERE owner_id = ? AND archived_at IS NULL)`, args: [...args, ownerId] });
      return result.rowsAffected ? NextResponse.json({ updatedAt: timestamp }) : jsonError("not_found", 404);
    }

    const result = await db.execute({ sql: "DELETE FROM blocks WHERE id = ? AND owner_id = ? AND page_id IN (SELECT id FROM pages WHERE owner_id = ? AND archived_at IS NULL)", args: [input.blockId, ownerId, ownerId] });
    return result.rowsAffected ? NextResponse.json({ ok: true }) : jsonError("not_found", 404);
  } catch (error) {
    return storageError(error);
  }
}
