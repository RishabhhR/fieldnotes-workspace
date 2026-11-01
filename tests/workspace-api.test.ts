// The real route handlers and real SQL against a throwaway database. Only the Clerk session is faked.
import { describe, expect, it } from "vitest";
import { act, ALICE, BOB, load, newPage, UNKNOWN_ID } from "./helpers/api";
import { allRows, setupTestDatabase } from "./helpers/database";

const db = setupTestDatabase();
const orderOf = async (userId: string, pageId: string) =>
  (await load(userId)).body.blocks.filter((block) => block.pageId === pageId).map((block) => block.text);

describe("signed-out requests", () => {
  it("GET is rejected and creates nothing", async () => {
    const response = await load(null);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
    expect((await db.raw.execute("SELECT COUNT(*) AS n FROM pages")).rows[0].n).toBe(0);
  });

  it.each([
    ["createPage", { action: "createPage", title: "x" }],
    ["updatePage", { action: "updatePage", pageId: UNKNOWN_ID, title: "x" }],
    ["archivePage", { action: "archivePage", pageId: UNKNOWN_ID }],
    ["createBlock", { action: "createBlock", pageId: UNKNOWN_ID }],
    ["updateBlock", { action: "updateBlock", blockId: UNKNOWN_ID, text: "x" }],
    ["deleteBlock", { action: "deleteBlock", blockId: UNKNOWN_ID }],
  ])("%s is rejected and writes nothing", async (_name, body) => {
    const before = await allRows(db.raw);
    const response = await act(null, body);
    expect(response.status).toBe(401);
    expect(await allRows(db.raw)).toBe(before);
  });

  it("is rejected before the body is even parsed", async () => {
    expect((await act(null, undefined, "{not json")).status).toBe(401);
  });
});

describe("owner isolation", () => {
  it("a user's snapshot never contains another user's pages or blocks", async () => {
    const alice = await newPage(ALICE, "Alice private");
    await act(ALICE, { action: "updateBlock", blockId: alice.blockId, text: "alice secret" });
    const { body } = await load(BOB);
    expect(JSON.stringify(body)).not.toContain("alice secret");
    expect(JSON.stringify(body)).not.toContain("Alice private");
    expect(body.pages.some((page) => page.id === alice.pageId)).toBe(false);
    expect(body.blocks.some((block) => block.id === alice.blockId)).toBe(false);
  });

  type Target = { pageId: string; blockId: string; bobPageId: string };
  const attacks: Array<[string, (t: Target) => unknown]> = [
    ["rename the page", (t) => ({ action: "updatePage", pageId: t.pageId, title: "hacked" })],
    ["change the icon", (t) => ({ action: "updatePage", pageId: t.pageId, icon: "💀" })],
    ["favorite the page", (t) => ({ action: "updatePage", pageId: t.pageId, favorite: true })],
    ["archive the page", (t) => ({ action: "archivePage", pageId: t.pageId })],
    ["add a block to the page", (t) => ({ action: "createBlock", pageId: t.pageId, text: "hacked" })],
    ["add a block after her block, on his own page", (t) => ({ action: "createBlock", pageId: t.bobPageId, afterId: t.blockId, text: "probe" })],
    ["edit the block text", (t) => ({ action: "updateBlock", blockId: t.blockId, text: "hacked" })],
    ["change the block type", (t) => ({ action: "updateBlock", blockId: t.blockId, type: "code" })],
    ["tick the block", (t) => ({ action: "updateBlock", blockId: t.blockId, checked: true })],
    ["delete the block", (t) => ({ action: "deleteBlock", blockId: t.blockId })],
  ];

  it.each(attacks)("another user cannot %s", async (_name, attack) => {
    const alice = await newPage(ALICE);
    const bob = await newPage(BOB);
    const before = await allRows(db.raw);
    const response = await act(BOB, attack({ ...alice, bobPageId: bob.pageId }));
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" }); // the same answer as for an ID that does not exist
    expect(await allRows(db.raw)).toBe(before);
  });

  it("an owner ID in the request body is ignored", async () => {
    const created = await act(BOB, { action: "createPage", title: "mine", ownerId: ALICE, owner_id: ALICE, userId: ALICE });
    expect(created.status).toBe(200);
    const owners = await db.raw.execute({ sql: "SELECT owner_id FROM pages WHERE id = ?", args: [created.body.page.id] });
    expect(owners.rows[0].owner_id).toBe(BOB);
    const blocks = await db.raw.execute({ sql: "SELECT owner_id FROM blocks WHERE id = ?", args: [created.body.block.id] });
    expect(blocks.rows[0].owner_id).toBe(BOB);
  });
});

describe("request validation", () => {
  it.each([
    ["malformed JSON", undefined, "{not json"],
    ["an unknown action", { action: "dropTables" }, undefined],
    ["a page ID that is not a UUID", { action: "archivePage", pageId: "1 OR 1=1" }, undefined],
    ["a block type that does not exist", { action: "updateBlock", blockId: UNKNOWN_ID, type: "video" }, undefined],
    ["a title over the limit", { action: "updatePage", pageId: UNKNOWN_ID, title: "x".repeat(201) }, undefined],
    ["block text over the limit", { action: "updateBlock", blockId: UNKNOWN_ID, text: "x".repeat(50_001) }, undefined],
  ])("rejects %s", async (_name, body, raw) => {
    const response = await act(ALICE, body, raw);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });

  it("rejects an update that changes nothing", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    expect((await act(ALICE, { action: "updatePage", pageId })).body).toEqual({ error: "no_changes" });
    expect((await act(ALICE, { action: "updateBlock", blockId })).body).toEqual({ error: "no_changes" });
  });

  it("treats SQL in user text as plain text", async () => {
    const { blockId, pageId } = await newPage(ALICE);
    const text = `'); DROP TABLE pages; --`;
    await act(ALICE, { action: "updateBlock", blockId, text });
    expect(await orderOf(ALICE, pageId)).toEqual([text]);
  });
});

describe("pages", () => {
  it("the first visit creates one welcome page, and later visits do not add another", async () => {
    const first = await load(ALICE);
    expect(first.status).toBe(200);
    expect(first.body.pages.map((page) => page.title)).toEqual(["Welcome to Fieldnotes"]);
    expect(first.body.blocks).toHaveLength(1);
    expect((await load(ALICE)).body.pages).toHaveLength(1);
  });

  it("creates a page with one empty paragraph, and a blank title becomes Untitled", async () => {
    const created = await act(ALICE, { action: "createPage", title: "   " });
    expect(created.body.page.title).toBe("Untitled");
    expect(created.body.block).toMatchObject({ type: "paragraph", text: "", checked: false, pageId: created.body.page.id });
  });

  it("renames, re-icons and favorites a page, and lists favorites first", async () => {
    const older = await newPage(ALICE, "older");
    await newPage(ALICE, "newer");
    expect((await act(ALICE, { action: "updatePage", pageId: older.pageId, title: "  renamed  ", icon: "💡", favorite: true })).status).toBe(200);
    const [first, second] = (await load(ALICE)).body.pages;
    expect(first).toMatchObject({ id: older.pageId, title: "renamed", icon: "💡", favorite: true });
    expect(second.title).toBe("newer");
    await act(ALICE, { action: "updatePage", pageId: older.pageId, favorite: false });
    expect((await load(ALICE)).body.pages.find((page) => page.id === older.pageId)?.favorite).toBe(false);
  });
});

describe("archive", () => {
  it("is a soft delete: the page leaves the snapshot but its rows survive", async () => {
    const keep = await newPage(ALICE, "keep");
    const gone = await newPage(ALICE, "gone");
    await act(ALICE, { action: "updateBlock", blockId: gone.blockId, text: "still stored" });
    expect((await act(ALICE, { action: "archivePage", pageId: gone.pageId })).body).toEqual({ ok: true });
    const { body } = await load(ALICE);
    expect(body.pages.map((page) => page.id)).toEqual([keep.pageId]);
    expect(body.blocks.some((block) => block.pageId === gone.pageId)).toBe(false);
    const stored = await db.raw.execute({ sql: "SELECT archived_at FROM pages WHERE id = ?", args: [gone.pageId] });
    expect(stored.rows[0].archived_at).toBeTruthy();
    const text = await db.raw.execute({ sql: "SELECT text FROM blocks WHERE id = ?", args: [gone.blockId] });
    expect(text.rows[0].text).toBe("still stored");
  });

  it("an archived page and its blocks can no longer be changed", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "archivePage", pageId });
    const before = await allRows(db.raw);
    for (const body of [
      { action: "updatePage", pageId, title: "x" },
      { action: "archivePage", pageId },
      { action: "createBlock", pageId },
      { action: "updateBlock", blockId, text: "x" },
      { action: "deleteBlock", blockId },
    ]) expect((await act(ALICE, body)).status, JSON.stringify(body)).toBe(404);
    expect(await allRows(db.raw)).toBe(before);
  });

  it("archiving the last page gives the user a fresh welcome page on the next visit", async () => {
    const { pages } = (await load(ALICE)).body;
    await act(ALICE, { action: "archivePage", pageId: pages[0].id });
    const next = (await load(ALICE)).body.pages;
    expect(next).toHaveLength(1);
    expect(next[0].id).not.toBe(pages[0].id);
  });
});

describe("blocks", () => {
  it("inserts at the end, in the middle and at the top, and keeps that order on reload", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, text: "first" });
    await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "last" });
    await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "middle" });
    await act(ALICE, { action: "createBlock", pageId, afterId: null, text: "top" });
    expect(await orderOf(ALICE, pageId)).toEqual(["top", "first", "middle", "last"]);
  });

  it.each(["paragraph", "heading1", "heading2", "bullet", "todo", "quote", "code"])("stores the %s type", async (type) => {
    const { pageId, blockId } = await newPage(ALICE);
    expect((await act(ALICE, { action: "createBlock", pageId, type, text: "made" })).body.block.type).toBe(type);
    await act(ALICE, { action: "updateBlock", blockId, type });
    expect((await load(ALICE)).body.blocks.find((block) => block.id === blockId)?.type).toBe(type);
  });

  it("round-trips text, line breaks, unicode and the to-do tick", async () => {
    const { blockId } = await newPage(ALICE);
    const text = "line one\nline two — ✦ 📝 ñ 日本語";
    await act(ALICE, { action: "updateBlock", blockId, text, type: "todo", checked: true });
    expect((await load(ALICE)).body.blocks.find((block) => block.id === blockId)).toMatchObject({ text, type: "todo", checked: true });
    await act(ALICE, { action: "updateBlock", blockId, checked: false });
    expect((await load(ALICE)).body.blocks.find((block) => block.id === blockId)?.checked).toBe(false);
  });

  it("deletes a block, and a second delete reports not_found", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "stays" });
    expect((await act(ALICE, { action: "deleteBlock", blockId })).body).toEqual({ ok: true });
    expect(await orderOf(ALICE, pageId)).toEqual(["stays"]);
    expect((await act(ALICE, { action: "deleteBlock", blockId })).status).toBe(404);
  });

  it("adding a block marks the page as edited", async () => {
    const { pageId } = await newPage(ALICE);
    await db.raw.execute({ sql: "UPDATE pages SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", args: [pageId] });
    await act(ALICE, { action: "createBlock", pageId, text: "new" });
    const page = (await load(ALICE)).body.pages.find((item) => item.id === pageId);
    expect(page?.updatedAt.startsWith("2000")).toBe(false);
  });

  // KNOWN BUG: each insert halves the gap, so after 52 inserts floating-point positions collide and order breaks on
  // reload. it.fails turns the suite red once this is fixed: then change it to it.
  it.fails("KNOWN BUG: keeps order when many blocks are inserted one after another in the same gap", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, text: "start" });
    await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "end" });
    const expected = ["start"];
    let after = blockId;
    for (let line = 1; line <= 70; line++) {
      const created = await act(ALICE, { action: "createBlock", pageId, afterId: after, text: `line ${line}` });
      expect(created.status).toBe(200);
      after = created.body.block.id;
      expected.push(`line ${line}`);
    }
    expected.push("end");
    expect(await orderOf(ALICE, pageId)).toEqual(expected);
  });
});
