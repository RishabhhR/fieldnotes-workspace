import { GET, POST } from "../../app/api/workspace/route";
import type { Block, Page } from "../../lib/workspace-db";
import { session } from "./session";

export const ALICE = "user_alice";
export const BOB = "user_bob";
export const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

export type Snapshot = { pages: Page[]; blocks: Block[] };

export async function load(userId: string | null) {
  session.userId = userId;
  const response = await GET();
  return { status: response.status, body: (await response.json()) as Snapshot & { error?: string } };
}

export async function act(userId: string | null, body: unknown, rawBody?: string) {
  session.userId = userId;
  const response = await POST(new Request("http://test.local/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(body),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: response.status, body: (await response.json()) as any };
}

/** A new page for this user, with its first block. */
export async function newPage(userId: string, title = "A page") {
  const { body } = await act(userId, { action: "createPage", title });
  return { pageId: body.page.id as string, blockId: body.block.id as string };
}
