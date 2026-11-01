// Runs before every test file. Its job is to make it impossible for a test to touch production:
//  - real Turso and Clerk credentials are removed from the environment;
//  - the database client refuses anything but a local file;
//  - outgoing network is blocked unless a test connects fetch to the route handlers itself.
import { vi } from "vitest";
import { session } from "./helpers/session";

for (const key of Object.keys(process.env)) {
  if (/^(TURSO_|CLERK_|NEXT_PUBLIC_CLERK_)/.test(key)) delete process.env[key];
}

globalThis.fetch = (async (input: unknown) => {
  throw new Error(`Network is blocked in tests (attempted: ${String(input)})`);
}) as typeof fetch;

vi.mock("@libsql/client/web", async () => {
  const real = await vi.importActual<typeof import("@libsql/client")>("@libsql/client");
  return {
    createClient(config: { url: string }) {
      if (!config.url.startsWith("file:")) throw new Error("Tests may only use a local file database");
      return real.createClient({ url: config.url });
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: session.userId }) }));
vi.mock("@clerk/nextjs", () => ({ SignOutButton: ({ children }: { children: unknown }) => children }));
