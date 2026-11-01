// The signed-in user, as the mocked Clerk session reports it. Kept on globalThis so it survives
// vi.resetModules(). null means "not signed in".
const holder = globalThis as unknown as { __fieldnotesSession?: { userId: string | null } };
export const session = (holder.__fieldnotesSession ??= { userId: null });
