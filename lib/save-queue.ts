// Debounced autosave with one rule: "Saved" must mean the server has every edit.
//  - Edits to the same key merge, so a later patch cannot erase an unsaved earlier one.
//  - A key has at most one request in flight, so an older save cannot overwrite a newer one.
//  - Failed saves are kept and retried with backoff; they hold the state at "error" until they succeed.
//  - A save the server will never accept (not_found, invalid_request) is dropped and stays reported until dismissed.
export type SaveState = "saved" | "saving" | "error";
export type SaveAction = Record<string, unknown> & { action: string };

type Entry = {
  action: SaveAction | null; // edits not yet sent
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  sendWhenFree: boolean;
  failures: number;
  cancelled: boolean;
};

export type SaveQueueOptions = {
  send: (action: SaveAction, options: { keepalive: boolean }) => Promise<unknown>;
  onStateChange: (state: SaveState, previous: SaveState) => void;
  onFailure: (cause: unknown) => void;
  onSaved?: () => void;
  isPermanentFailure?: (cause: unknown) => boolean;
  delayMs?: number;
  retryDelayMs?: (failures: number) => number;
};

export function createSaveQueue(options: SaveQueueOptions) {
  const { send, onStateChange, onFailure, onSaved, isPermanentFailure = () => false, delayMs = 650 } = options;
  const retryDelayMs = options.retryDelayMs ?? ((failures: number) => Math.min(3000 * 2 ** (failures - 1), 60_000));
  const entries = new Map<string, Entry>();
  const waiters = new Set<() => void>();
  let rejected = false;
  let lastState: SaveState = "saved";
  let disposed = false;

  function state(): SaveState {
    if (rejected || [...entries.values()].some((entry) => entry.failures > 0)) return "error";
    return entries.size > 0 ? "saving" : "saved";
  }
  function publish() {
    const next = state();
    if (next !== lastState) { const previous = lastState; lastState = next; onStateChange(next, previous); }
    if (![...entries.values()].some((entry) => entry.inFlight || entry.timer !== null && entry.failures === 0)) {
      for (const resolve of [...waiters]) { waiters.delete(resolve); resolve(); }
    }
  }
  function clearTimer(entry: Entry) {
    if (entry.timer !== null) { clearTimeout(entry.timer); entry.timer = null; }
  }
  function schedule(key: string, entry: Entry, delay: number) {
    clearTimer(entry);
    entry.timer = setTimeout(() => { entry.timer = null; fire(key, false); }, delay);
  }

  function fire(key: string, keepalive: boolean) {
    const entry = entries.get(key);
    if (!entry) return;
    clearTimer(entry);
    if (entry.inFlight) { entry.sendWhenFree = true; return; }
    if (!entry.action) return;
    const sending = entry.action;
    entry.action = null;
    entry.inFlight = true;
    send(sending, { keepalive }).then(
      () => settle(key, entry, null, sending),
      (cause) => settle(key, entry, { cause }, sending),
    );
    publish();
  }

  function settle(key: string, entry: Entry, failure: { cause: unknown } | null, sent: SaveAction) {
    entry.inFlight = false;
    if (entry.cancelled) { publish(); return; }
    if (!failure) {
      entry.failures = 0;
      onSaved?.();
    } else if (isPermanentFailure(failure.cause)) {
      entry.failures = 0;
      rejected = true;
      onFailure(failure.cause);
    } else {
      entry.action = { ...sent, ...entry.action }; // newer edits win; nothing that failed is lost
      entry.failures += 1;
      onFailure(failure.cause);
      if (entry.timer === null && !entry.sendWhenFree && !disposed) schedule(key, entry, retryDelayMs(entry.failures));
    }
    if (entry.sendWhenFree) { entry.sendWhenFree = false; fire(key, false); }
    if (!entry.inFlight && !entry.action && entry.timer === null) entries.delete(key);
    publish();
  }

  return {
    /** Record an edit and (re)start this key's debounce. */
    enqueue(key: string, action: SaveAction) {
      disposed = false;
      const entry = entries.get(key) ?? { action: null, timer: null, inFlight: false, sendWhenFree: false, failures: 0, cancelled: false };
      entries.set(key, entry);
      entry.action = { ...entry.action, ...action };
      schedule(key, entry, delayMs);
      publish();
    },
    /** Forget a key whose target is being deleted. Returns its unsent edits, so a failed delete can put them back. */
    cancel(key: string): SaveAction | null {
      const entry = entries.get(key);
      if (!entry) return null;
      clearTimer(entry);
      const unsent = entry.action;
      entry.action = null;
      entry.cancelled = true;
      entries.delete(key);
      publish();
      return unsent;
    },
    /** Send everything now, without waiting for debounce or backoff (tab closing, back online). */
    flush(keepalive = false) {
      for (const key of [...entries.keys()]) fire(key, keepalive);
    },
    /** Resolves once nothing is in flight or waiting on debounce. Failed saves waiting for a retry do not block it. */
    idle(): Promise<void> {
      return new Promise((resolve) => { waiters.add(resolve); publish(); });
    },
    /** The user has acknowledged a save the server refused. */
    dismissRejected() {
      rejected = false;
      publish();
    },
    /** Stop all timers (component unmounted). Unsent edits are sent first. */
    dispose() {
      disposed = true;
      for (const key of [...entries.keys()]) fire(key, true);
      for (const entry of entries.values()) clearTimer(entry);
    },
  };
}
