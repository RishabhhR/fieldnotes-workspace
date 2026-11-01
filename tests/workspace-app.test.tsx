// @vitest-environment jsdom
// The real React app talking to the real route handlers and a real (throwaway) database. Only Clerk and the
// browser-to-server hop are faked, so "saved" here means the text actually reached the database.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/workspace/route";
import WorkspaceApp from "../components/workspace-app";
import { act, ALICE, load, newPage } from "./helpers/api";
import { setupTestDatabase } from "./helpers/database";
import { session } from "./helpers/session";

const db = setupTestDatabase();
type Action = { action: string; [key: string]: unknown };
const blockedFetch = globalThis.fetch;
let actions: Action[] = [];
let keepalives: Array<boolean | undefined> = [];
let shouldFail: (action: Action) => boolean = () => false;
let systemDark = false;
let systemListeners: Array<() => void> = [];

function connectFetchToRoute() {
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      const action = JSON.parse(String(init.body)) as Action;
      actions.push(action);
      keepalives.push(init.keepalive);
      if (shouldFail(action)) return new Response(JSON.stringify({ error: "storage_unavailable" }), { status: 503 });
      return POST(new Request("http://test.local/api/workspace", init));
    }
    return GET();
  }) as typeof fetch;
}

beforeEach(() => {
  actions = []; keepalives = []; shouldFail = () => false; systemDark = false; systemListeners = [];
  session.userId = ALICE;
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.matchMedia = ((query: string) => ({
    get matches() { return query.includes("dark") ? systemDark : false; },
    media: query,
    addEventListener: (_: string, listener: () => void) => systemListeners.push(listener),
    removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  connectFetchToRoute();
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.restoreAllMocks();
  globalThis.fetch = blockedFetch;
});

const saveState = () => document.querySelector(".save-indicator")?.textContent;
const textareas = () => screen.getAllByRole("textbox", { name: / block$/ }) as HTMLTextAreaElement[];
const updates = (key?: string) => actions.filter((a) => a.action === "updateBlock" && (!key || key in a));
const stored = async (blockId: string) => (await db.raw.execute({ sql: "SELECT * FROM blocks WHERE id = ?", args: [blockId] })).rows[0];
const waitForSaved = () => waitFor(() => expect(saveState()).toBe("Saved"), { timeout: 3000 });

async function openApp() {
  const user = userEvent.setup();
  const view = render(<WorkspaceApp userName="alice@example.com" />);
  await screen.findByRole("textbox", { name: "Page title" });
  return { user, view };
}
async function openPage(title = "Notes") {
  const { pageId, blockId } = await newPage(ALICE, title);
  const opened = await openApp();
  return { ...opened, pageId, blockId };
}

describe("loading", () => {
  it("shows the first page and the signed-in user", async () => {
    await openPage("Field trip");
    expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe("Field trip");
    expect(screen.getByText("alice")).toBeTruthy();
    expect(saveState()).toBe("Saved");
  });

  it("explains a storage failure instead of showing an empty workspace as if it were fine", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "storage_unavailable" }), { status: 503 })) as typeof fetch;
    render(<WorkspaceApp userName="alice@example.com" />);
    expect((await screen.findByRole("alert")).textContent).toContain("The database is unavailable");
  });

  it("reopens the page you were last on", async () => {
    const first = await newPage(ALICE, "One");
    await newPage(ALICE, "Two");
    window.localStorage.setItem("fieldnotes-active-page", first.pageId);
    await openApp();
    expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe("One");
  });
});

describe("autosave", () => {
  it("shows Saving, sends one request for a burst of typing, then shows Saved with the text in the database", async () => {
    const { user, blockId } = await openPage();
    await user.type(textareas()[0], "hello world");
    expect(saveState()).toBe("Saving");
    expect(updates()).toHaveLength(0); // still inside the debounce window
    await waitForSaved();
    expect(updates("text")).toHaveLength(1);
    expect((await stored(blockId)).text).toBe("hello world");
  });

  it("saves two blocks edited back to back", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    const second = await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "" });
    const { user } = await openApp();
    await user.type(textareas()[0], "first");
    await user.type(textareas()[1], "second");
    await waitForSaved();
    expect((await stored(blockId)).text).toBe("first");
    expect((await stored(second.body.block.id)).text).toBe("second");
  });

  it("saves a renamed page", async () => {
    const { user, pageId } = await openPage("Old");
    const title = screen.getByRole("textbox", { name: "Page title" });
    await user.clear(title);
    await user.type(title, "New name");
    await waitForSaved();
    expect((await load(ALICE)).body.pages.find((page) => page.id === pageId)?.title).toBe("New name");
    expect(document.querySelector(".breadcrumb-current")?.textContent).toBe("New name");
  });

  it("a failed save is visible, keeps the text on screen, and the next successful save recovers", async () => {
    const { user, blockId } = await openPage();
    shouldFail = (action) => action.action === "updateBlock";
    await user.type(textareas()[0], "precious");
    await waitFor(() => expect(saveState()).toBe("Not saved"), { timeout: 3000 });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(textareas()[0].value).toBe("precious");
    expect((await stored(blockId)).text).toBe("");
    shouldFail = () => false;
    await user.type(textareas()[0], " text");
    await waitForSaved();
    expect((await stored(blockId)).text).toBe("precious text");
  });

  // Regressions found by this suite (TASK-053): each of these used to lose text or misreport it.
  it("ticking a to-do right after typing must not lose the typed text", async () => {
    const { pageId } = await newPage(ALICE, "Todos");
    const todo = await act(ALICE, { action: "createBlock", pageId, type: "todo", text: "" });
    window.localStorage.setItem("fieldnotes-active-page", pageId);
    const { user } = await openApp();
    const box = textareas().find((el) => el.getAttribute("aria-label") === "todo block")!;
    await user.type(box, "buy milk");
    await user.click(screen.getByRole("checkbox", { name: "Mark to-do complete" }));
    await waitForSaved();
    const row = await stored(todo.body.block.id);
    expect(row.checked).toBe(1);
    expect(row.text).toBe("buy milk");
  });

  it("emptying a block and pressing Backspace again must not report a save error", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    const second = await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "x" });
    const { user } = await openApp();
    await user.click(textareas()[1]);
    await user.keyboard("{Backspace}{Backspace}"); // the first empties it, the second deletes the block
    await waitFor(() => expect(textareas()).toHaveLength(1));
    expect(await stored(second.body.block.id)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 900)); // past the debounce of the now-orphaned save
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saveState()).toBe("Saved");
  });

  it("one block failing to save must not be reported as Saved because another block succeeded", async () => {
    const { pageId, blockId } = await newPage(ALICE, "Two blocks");
    const second = await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "" });
    window.localStorage.setItem("fieldnotes-active-page", pageId);
    const { user } = await openApp();
    shouldFail = (action) => action.action === "updateBlock" && action.blockId === blockId;
    await user.type(textareas()[0], "lost words");
    await waitFor(() => expect(saveState()).toBe("Not saved"), { timeout: 3000 });
    await user.type(textareas()[1], "other block");
    await waitFor(() => expect((updates("text").find((a) => a.blockId === second.body.block.id))).toBeTruthy(), { timeout: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await stored(blockId)).text).toBe(""); // really not saved...
    expect(saveState()).toBe("Not saved"); // ...so the indicator must not claim otherwise
  });
});

describe("saves that must survive", () => {
  it("closing the tab sends pending edits at once, in a request that outlives the page", async () => {
    const { user, blockId } = await openPage();
    await user.type(textareas()[0], "last words");
    expect(updates()).toHaveLength(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(updates("text")).toEqual([expect.objectContaining({ text: "last words" })]);
    expect(keepalives.at(-1)).toBe(true);
    await waitForSaved();
    expect((await stored(blockId)).text).toBe("last words");
  });

  it("hiding the tab also sends pending edits", async () => {
    const { user } = await openPage();
    await user.type(textareas()[0], "backgrounded on a phone");
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(updates("text")).toHaveLength(1);
    visibility.mockRestore();
    await waitForSaved();
  });

  it("a failed save retries by itself, and the error clears once the text is stored", async () => {
    const { user, blockId } = await openPage();
    shouldFail = (action) => action.action === "updateBlock";
    await user.type(textareas()[0], "keep trying");
    await waitFor(() => expect(saveState()).toBe("Not saved"), { timeout: 3000 });
    expect(screen.getByRole("alert")).toBeTruthy();
    shouldFail = () => false;
    await waitFor(() => expect(saveState()).toBe("Saved"), { timeout: 5000 }); // no further typing
    expect((await stored(blockId)).text).toBe("keep trying");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("coming back online retries straight away", async () => {
    const { user, blockId } = await openPage();
    shouldFail = (action) => action.action === "updateBlock";
    await user.type(textareas()[0], "offline note");
    await waitFor(() => expect(saveState()).toBe("Not saved"), { timeout: 3000 });
    shouldFail = () => false;
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(saveState()).toBe("Saved"), { timeout: 1000 }); // well before the 3 s retry
    expect((await stored(blockId)).text).toBe("offline note");
  });

  it("archiving right after typing stores the text first and reports no false error", async () => {
    await newPage(ALICE, "Keep");
    const gone = await newPage(ALICE, "Gone");
    window.localStorage.setItem("fieldnotes-active-page", gone.pageId);
    const { user } = await openApp();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.type(textareas()[0], "final thought");
    await user.click(screen.getByRole("button", { name: "Page options" }));
    await user.click(screen.getByRole("button", { name: /Move to archive/ }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe("Keep"));
    expect((await stored(gone.blockId)).text).toBe("final thought");
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saveState()).toBe("Saved");
  });

  it("if deleting a block fails, its unsaved edits are still stored", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    const second = await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "" });
    const { user } = await openApp();
    await user.type(textareas()[1], "do not lose me");
    shouldFail = (action) => action.action === "deleteBlock";
    await user.click(screen.getAllByRole("button", { name: "Block type" })[1]);
    await user.click(screen.getByRole("button", { name: /Delete block/ }));
    await screen.findByRole("alert");
    expect(textareas()).toHaveLength(2);
    await waitFor(async () => expect((await stored(second.body.block.id)).text).toBe("do not lose me"), { timeout: 3000 });
  });

  it("a save the server refuses is not retried forever, and stays reported until dismissed", async () => {
    const { user, pageId } = await openPage();
    await user.type(textareas()[0], "typed while archived elsewhere");
    await act(ALICE, { action: "archivePage", pageId }); // another device archives the page
    session.userId = ALICE;
    await waitFor(() => expect(saveState()).toBe("Not saved"), { timeout: 3000 });
    const attempts = updates().length;
    await new Promise((resolve) => setTimeout(resolve, 3300));
    expect(updates()).toHaveLength(attempts);
    expect(saveState()).toBe("Not saved");
    await user.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(saveState()).toBe("Saved");
  });

  it("when a page runs out of room, new blocks appear in the right place without a reload", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, text: "start" });
    const end = await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "end" });
    await db.raw.execute({ sql: "UPDATE blocks SET position = ? WHERE id = ?", args: [1000 + 1e-7, end.body.block.id] });
    const { user } = await openApp();
    await user.click(textareas()[0]);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(textareas()).toHaveLength(3));
    expect(textareas().map((el) => el.value)).toEqual(["start", "", "end"]);
    expect((await load(ALICE)).body.blocks.map((block) => block.text)).toEqual(["start", "", "end"]);
  });
});

describe("keyboard editing", () => {
  it("Enter at the end of a block opens a new block and moves the cursor there", async () => {
    const { user } = await openPage();
    await user.type(textareas()[0], "one{Enter}");
    await waitFor(() => expect(textareas()).toHaveLength(2));
    await waitFor(() => expect(document.activeElement).toBe(textareas()[1]));
    await user.keyboard("two");
    await waitForSaved();
    expect((await load(ALICE)).body.blocks.map((block) => block.text).filter(Boolean)).toEqual(expect.arrayContaining(["one", "two"]));
  });

  it("Enter in the middle splits the text across two blocks, and both halves are stored", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, text: "headtail" });
    const { user } = await openApp();
    const box = textareas()[0];
    await user.click(box);
    box.setSelectionRange(4, 4);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(textareas()).toHaveLength(2));
    await waitForSaved();
    expect(textareas().map((el) => el.value)).toEqual(["head", "tail"]);
    const saved = (await load(ALICE)).body.blocks.filter((block) => block.pageId === pageId).map((block) => block.text);
    expect(saved).toEqual(["head", "tail"]);
  });

  it("Shift+Enter is a line break, not a new block", async () => {
    const { user } = await openPage();
    await user.type(textareas()[0], "a{Shift>}{Enter}{/Shift}b");
    expect(textareas()).toHaveLength(1);
    expect(textareas()[0].value).toBe("a\nb");
    await waitForSaved();
  });

  it("Enter inside a code block is a line break, not a new block", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, type: "code" });
    window.localStorage.setItem("fieldnotes-active-page", pageId);
    const { user } = await openApp();
    await user.type(textareas()[0], "x{Enter}y");
    expect(textareas()).toHaveLength(1);
    expect(textareas()[0].value).toBe("x\ny");
    await waitForSaved();
  });

  it("Backspace in an empty block removes it and returns to the previous block", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, text: "keep" });
    await act(ALICE, { action: "createBlock", pageId, afterId: blockId, text: "" });
    window.localStorage.setItem("fieldnotes-active-page", pageId);
    const { user } = await openApp();
    await user.click(textareas()[1]);
    await user.keyboard("{Backspace}");
    await waitFor(() => expect(textareas()).toHaveLength(1));
    await waitFor(() => expect(document.activeElement).toBe(textareas()[0]));
    expect((await load(ALICE)).body.blocks.filter((block) => block.pageId === pageId)).toHaveLength(1);
  });

  it("Backspace cannot remove the only block on a page", async () => {
    const { user } = await openPage();
    await user.click(textareas()[0]);
    await user.keyboard("{Backspace}");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(textareas()).toHaveLength(1);
    expect(actions.filter((a) => a.action === "deleteBlock")).toHaveLength(0);
  });
});

describe("blocks and pages from the interface", () => {
  it("turns a block into another type and stores it", async () => {
    const { user, blockId } = await openPage();
    await user.click(screen.getByRole("button", { name: "Block type" }));
    await user.click(screen.getByRole("button", { name: "Heading 1" }));
    await waitForSaved();
    expect((await stored(blockId)).type).toBe("heading1");
    expect(document.querySelector(".block-heading1")).toBeTruthy();
  });

  it("ticks a to-do and stores it", async () => {
    const { pageId, blockId } = await newPage(ALICE);
    await act(ALICE, { action: "updateBlock", blockId, type: "todo" });
    window.localStorage.setItem("fieldnotes-active-page", pageId);
    const { user } = await openApp();
    await user.click(screen.getByRole("checkbox", { name: "Mark to-do complete" }));
    await waitForSaved();
    expect((await stored(blockId)).checked).toBe(1);
  });

  it("creates a page and switches to it, then switches back", async () => {
    const { user } = await openPage("Original");
    await user.click(screen.getByRole("button", { name: /New page/ }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe(""));
    expect(document.querySelector(".breadcrumb-current")?.textContent).toBe("Untitled");
    await user.click(within(screen.getByRole("navigation", { name: "Pages" })).getByRole("button", { name: /Original/ }));
    expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe("Original");
  });

  it("search finds pages by title and by block text, and says when nothing matches", async () => {
    const hit = await newPage(ALICE, "Garden plan");
    await act(ALICE, { action: "updateBlock", blockId: hit.blockId, text: "plant tomatoes in may" });
    await newPage(ALICE, "Taxes");
    const { user } = await openApp();
    const nav = within(screen.getByRole("navigation", { name: "Pages" }));
    const search = screen.getByRole("textbox", { name: "Search pages" });
    await user.type(search, "TOMATOES");
    expect(nav.queryByRole("button", { name: /Garden plan/ })).toBeTruthy();
    expect(nav.queryByRole("button", { name: /Taxes/ })).toBeNull();
    await user.clear(search);
    await user.type(search, "tax");
    expect(nav.queryByRole("button", { name: /Taxes/ })).toBeTruthy();
    expect(nav.queryByRole("button", { name: /Garden plan/ })).toBeNull();
    await user.clear(search);
    await user.type(search, "zzz");
    expect(nav.getByText("No matching pages")).toBeTruthy();
  });

  it("favorites a page, lists it under Favorites and stores it", async () => {
    const { user, pageId } = await openPage("Star me");
    await user.click(screen.getByRole("button", { name: "Add favorite" }));
    await screen.findByText("Favorites");
    expect(screen.getByRole("button", { name: "Remove favorite" })).toBeTruthy();
    await waitFor(async () => expect((await load(ALICE)).body.pages.find((page) => page.id === pageId)?.favorite).toBe(true));
  });

  it("archives only after confirmation", async () => {
    const keep = await newPage(ALICE, "Keep");
    const gone = await newPage(ALICE, "Gone");
    window.localStorage.setItem("fieldnotes-active-page", gone.pageId);
    const { user } = await openApp();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Page options" }));
    await user.click(screen.getByRole("button", { name: /Move to archive/ }));
    expect(actions.filter((a) => a.action === "archivePage")).toHaveLength(0);
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /Move to archive/ }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Page title" }) as HTMLInputElement).value).toBe("Keep"));
    expect((await load(ALICE)).body.pages.map((page) => page.id)).toEqual([keep.pageId]);
  });
});

describe("theme", () => {
  // The script in app/layout.tsx that sets the theme before first paint, so there is no flash.
  const bootScript = /__html: `([^`]+)`/.exec(readFileSync(path.join(import.meta.dirname, "../app/layout.tsx"), "utf8"))![1];
  const boot = () => new Function(bootScript)();

  it("toggling changes the page and is remembered", async () => {
    document.documentElement.dataset.theme = "light";
    const { user } = await openPage();
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("fieldnotes-theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("fieldnotes-theme")).toBe("light");
  });

  it("the choice survives a reload, even when the system prefers the opposite", () => {
    window.localStorage.setItem("fieldnotes-theme", "dark");
    systemDark = false;
    boot();
    expect(document.documentElement.dataset.theme).toBe("dark");
    window.localStorage.setItem("fieldnotes-theme", "light");
    systemDark = true;
    boot();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("with no saved choice it follows the system on load", () => {
    systemDark = true;
    boot();
    expect(document.documentElement.dataset.theme).toBe("dark");
    systemDark = false;
    boot();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("a live system change is followed only while no choice is saved", async () => {
    document.documentElement.dataset.theme = "light";
    await openPage();
    systemDark = true;
    systemListeners.forEach((listener) => listener());
    await screen.findByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    window.localStorage.setItem("fieldnotes-theme", "dark");
    systemDark = false;
    systemListeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
