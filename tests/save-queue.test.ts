// The autosave rules on their own, with fake timers and hand-controlled responses.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue, type SaveAction, type SaveState } from "../lib/save-queue";

type Call = { action: SaveAction; keepalive: boolean; ok: () => Promise<void>; fail: (message?: string) => Promise<void> };

function setup() {
  const calls: Call[] = [];
  const states: SaveState[] = [];
  const failures: unknown[] = [];
  let saved = 0;
  const queue = createSaveQueue({
    send: (action, { keepalive }) => new Promise((resolve, reject) => {
      calls.push({
        action, keepalive,
        ok: async () => { resolve(undefined); await vi.advanceTimersByTimeAsync(0); },
        fail: async (message = "storage_unavailable") => { reject(new Error(message)); await vi.advanceTimersByTimeAsync(0); },
      });
    }),
    onStateChange: (state) => states.push(state),
    onFailure: (cause) => failures.push(cause),
    onSaved: () => { saved += 1; },
    isPermanentFailure: (cause) => (cause as Error).message === "not_found",
  });
  return { queue, calls, states, failures, savedCount: () => saved, state: () => states.at(-1) ?? "saved" };
}
const edit = (patch: Record<string, unknown>): SaveAction => ({ action: "updateBlock", blockId: "b1", ...patch });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("debounce and merging", () => {
  it("restarts the wait on each edit and sends once", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(600);
    t.queue.enqueue("k", edit({ text: "ab" }));
    await vi.advanceTimersByTimeAsync(600);
    expect(t.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(t.calls.map((c) => c.action.text)).toEqual(["ab"]);
  });

  it("merges different fields, so a later patch cannot erase an earlier one", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "typed" }));
    t.queue.enqueue("k", edit({ checked: true }));
    await vi.advanceTimersByTimeAsync(650);
    expect(t.calls[0].action).toEqual({ action: "updateBlock", blockId: "b1", text: "typed", checked: true });
  });

  it("reports saving until the response arrives, then saved", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    expect(t.state()).toBe("saving");
    await vi.advanceTimersByTimeAsync(650);
    expect(t.state()).toBe("saving");
    await t.calls[0].ok();
    expect(t.states).toEqual(["saving", "saved"]);
    expect(t.savedCount()).toBe(1);
  });
});

describe("ordering", () => {
  it("never has two requests in flight for one key, so an older save cannot overwrite a newer one", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "old" }));
    await vi.advanceTimersByTimeAsync(650);
    t.queue.enqueue("k", edit({ text: "new" }));
    await vi.advanceTimersByTimeAsync(650);
    expect(t.calls).toHaveLength(1);
    expect(t.state()).toBe("saving");
    await t.calls[0].ok();
    expect(t.state()).toBe("saving");
    expect(t.calls[1].action.text).toBe("new");
    await t.calls[1].ok();
    expect(t.state()).toBe("saved");
  });

  it("does not say Saved while another key is still in flight", async () => {
    const t = setup();
    t.queue.enqueue("a", edit({ text: "a" }));
    t.queue.enqueue("b", edit({ text: "b" }));
    await vi.advanceTimersByTimeAsync(650);
    expect(t.calls).toHaveLength(2); // different keys do not wait for each other
    await t.calls[0].ok();
    expect(t.state()).toBe("saving");
    await t.calls[1].ok();
    expect(t.state()).toBe("saved");
  });
});

describe("failures", () => {
  it("keeps the edit, reports the error and retries with growing delays", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[0].fail();
    expect(t.state()).toBe("error");
    expect(t.failures).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(t.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.calls).toHaveLength(2);
    await t.calls[1].fail();
    await vi.advanceTimersByTimeAsync(5999);
    expect(t.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.calls[2].action.text).toBe("a");
    expect(t.state()).toBe("error");
    await t.calls[2].ok();
    expect(t.state()).toBe("saved");
  });

  it("the retry delay stops growing at one minute", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    for (let attempt = 0; attempt < 8; attempt++) {
      await t.calls.at(-1)!.fail();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    expect(t.calls).toHaveLength(9);
  });

  it("merges newer edits over the failed ones, keeping fields only the failed save had", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "old", checked: true }));
    await vi.advanceTimersByTimeAsync(650);
    t.queue.enqueue("k", edit({ text: "new" }));
    await t.calls[0].fail();
    await vi.advanceTimersByTimeAsync(650);
    expect(t.calls[1].action).toMatchObject({ text: "new", checked: true });
  });

  it("another key succeeding does not hide the failure", async () => {
    const t = setup();
    t.queue.enqueue("bad", edit({ text: "x" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[0].fail();
    t.queue.enqueue("good", edit({ text: "y" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[1].ok();
    expect(t.state()).toBe("error");
  });

  it("a refused save is not retried and stays reported until dismissed", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[0].fail("not_found");
    expect(t.state()).toBe("error");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.calls).toHaveLength(1);
    t.queue.enqueue("other", edit({ text: "b" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[1].ok();
    expect(t.state()).toBe("error"); // another save succeeding must not hide it
    t.queue.dismissRejected();
    expect(t.state()).toBe("saved");
  });
});

describe("cancel", () => {
  it("drops a waiting edit and returns it, so a failed delete can put it back", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    expect(t.queue.cancel("k")).toEqual(edit({ text: "a" }));
    expect(t.state()).toBe("saved");
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.calls).toHaveLength(0);
  });

  it("ignores the outcome of a request already in flight", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    t.queue.cancel("k");
    await t.calls[0].fail("not_found");
    expect(t.failures).toHaveLength(0);
    expect(t.state()).toBe("saved");
  });

  it("clears the failure of the cancelled key and stops its retries", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[0].fail();
    t.queue.cancel("k");
    expect(t.state()).toBe("saved");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.calls).toHaveLength(1);
  });

  it("returns null for a key with nothing pending", () => {
    expect(setup().queue.cancel("nothing")).toBeNull();
  });
});

describe("flush, idle and dispose", () => {
  it("flush sends now and passes keepalive through", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    t.queue.flush(true);
    expect(t.calls[0]).toMatchObject({ keepalive: true });
    await t.calls[0].ok();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.calls).toHaveLength(1);
  });

  it("flush retries a failed save without waiting for the backoff", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    await vi.advanceTimersByTimeAsync(650);
    await t.calls[0].fail();
    t.queue.flush();
    expect(t.calls).toHaveLength(2);
  });

  it("idle waits for debounced and in-flight saves, but not for a failed one waiting to retry", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    let done = false;
    void t.queue.idle().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(650);
    expect(done).toBe(false);
    await t.calls[0].fail();
    expect(done).toBe(true);
    await expect(t.queue.idle()).resolves.toBeUndefined();
  });

  it("dispose sends unsent edits and leaves no retry running", async () => {
    const t = setup();
    t.queue.enqueue("k", edit({ text: "a" }));
    t.queue.dispose();
    expect(t.calls[0]).toMatchObject({ keepalive: true });
    await t.calls[0].fail();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.calls).toHaveLength(1);
  });
});
