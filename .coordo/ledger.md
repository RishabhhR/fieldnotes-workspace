# Coordo Ledger

> Shared coordination ledger between Claude Code and Google Antigravity (and the human).
> Edit directly, or use the `coordo` CLI. Keep entries terse; link to files/commits for detail.

## Decisions Needed

## Tasks

### [TASK-010] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 8/8 — macOS installer release readiness

Project context: Fieldnotes has a macOS Electron wrapper that loads the hosted web app remotely; it requires internet and the current download is Apple Silicon only. The DMG is ad hoc-signed and not notarized, so macOS may show Gatekeeper warnings. Web/PWA remains the main cross-platform path. App is deployed at https://fieldnotes-workspace.vercel.app.

Relevant sources: desktop/package.json; desktop/electron-builder.yml (if present); desktop/README.md; app/download/download-view.tsx; README.md. Inspect actual packaging configuration before changing it.

Improve macOS installer release readiness: assess Intel versus Apple Silicon support, reliable version/update behavior for the remote wrapper, signing/notarization requirements, and user-facing installation instructions. Implement any repository-only packaging/docs fixes that do not require external account access. Do not create or request certificates, store secrets, sign with an unverified identity, publish a release, or change Vercel production. If notarization requires an Apple Developer account/team or secrets unavailable in the repo, provide the precise blocker and a reproducible handoff for the user. Acceptance: current architecture/support requirements and installation limitations are accurately documented; available local packaging validation is recorded; no signing or release is claimed unless actually completed.

### [TASK-009] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 7/8 — Automated regression coverage

Project context: Fieldnotes is an authenticated Next.js page/block app using Clerk and Turso, deployed at https://fieldnotes-workspace.vercel.app. The repo currently provides lint and production build scripts but no automated test script or test files. Existing core flows include authenticated page CRUD, favorites/archive, seven text block types, autosave, search, theme preference, and PWA/download routes.

Relevant sources: package.json; app/api/workspace/route.ts; lib/workspace-db.ts; components/workspace-app.tsx; README.md.

Establish a maintainable automated test foundation and cover the existing high-risk behavior before the feature tasks expand it. Prioritize owner isolation and unauthenticated API rejection, page/block CRUD and archive behavior, keyboard editing/autosave states, and theme persistence. Use isolated fixtures/mocks; tests must never require or mutate production Turso/Clerk data. Add feature-specific regression tests with later TASK-003 through TASK-008 changes. Acceptance: a documented test command runs in CI/local without credentials, covers the core flows above, and catches cross-user data access plus save regressions; note gaps that cannot be tested safely without configured services. Do not change application behavior as part of this task.

### [TASK-008] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 6/6 — Offline editing and synchronization

Project context: Fieldnotes is the authenticated personal page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso. The app has a PWA manifest/install flow and a macOS Electron wrapper, but README explicitly says offline editing is not supported. Current editor sends debounced changes to the server and shows save status; it has no durable local edit queue or conflict resolution.

Relevant sources: lib/use-pwa.ts; app/manifest.ts; app/api/workspace/route.ts; components/workspace-app.tsx; lib/workspace-db.ts; README.md. Do not cache Clerk tokens or private workspace content in a shared/public cache.

Implement offline-safe editing and reconnect synchronization. Define which content can be stored locally, encryption and logout/account-switch cleanup behavior, conflict handling for edits from multiple devices, and the user-visible pending/synced/error states. Keep server authorization authoritative and avoid silently overwriting newer remote changes. Acceptance: a signed-in user can edit while disconnected, close/reopen without losing queued edits, reconnect and sync, and recover from a conflict; a signed-out or different account cannot view prior local content; document the data flow, limits, migrations, and validation evidence. Coordinate conflict semantics with TASK-004/006/007 before touching editor or persistence code.

### [TASK-007] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 5/6 — Sharing, comments, and live collaboration

Project context: Fieldnotes is currently a single-user authenticated page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso. README explicitly says there is no team sharing, comments, or real-time collaboration. Existing API authorization assumes a single owner_id per record.

Relevant sources: README.md; app/api/workspace/route.ts; lib/workspace-db.ts; components/workspace-app.tsx. Do not weaken existing Clerk ownership checks or rely on client-supplied user IDs.

Design and implement secure page sharing, comments, and real-time collaboration. Start with a concise threat/access model and schema/API plan; enforce explicit per-page permissions (owner/editor/viewer), revoke access correctly, validate every operation server-side, and avoid exposing private pages through search or archive endpoints. Add comments and conflict-safe live updates with clear presence/save states. Acceptance: two authorized accounts can collaborate on a shared page; an unrelated account cannot read, search, mutate, or infer its content; revocation takes effect; document permission model, migrations, operational needs, and validation evidence. Coordinate with TASK-003 and TASK-005 before shared schema edits. Do not change Clerk from development to production or deploy without the user's existing domain/key prerequisites.

### [TASK-006] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 4/6 — Page history and data portability

Project context: Fieldnotes is the authenticated personal page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso. It currently saves page titles/blocks with a debounced update but has no version history, restore point, export, or import. README and current UI expose no portability workflow.

Relevant sources: app/api/workspace/route.ts; lib/workspace-db.ts; components/workspace-app.tsx; README.md. Current ownership is derived from the verified Clerk session; all workspace records carry owner_id.

Implement version history with preview/restore and user-scoped export/import. Define retention/size behavior and use a backward-compatible migration; make import preview and validation safe against malformed or oversized files and ID collisions. Exports must contain only the requesting user's content and must not include credentials or server configuration. Acceptance: users can inspect prior versions, restore one without losing current content, export their workspace, preview an import, and complete/cancel it safely; document retention, file format, migrations, authorization, and validation evidence. Coordinate data-model decisions with TASK-003/005 before touching overlapping schema.

### [TASK-005] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 3/6 — Tables, database-style content, and media/files

Project context: Fieldnotes is the authenticated personal page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso. Current persisted block model is text plus type/checked/position; supported types are paragraph, heading 1/2, bullet, to-do, quote, and code. There are no tables, database views, inline images, or file uploads.

Relevant sources: lib/workspace-db.ts; app/api/workspace/route.ts; components/workspace-app.tsx; README.md; .env.example. The API derives ownership from Clerk and validates actions with Zod. No object/file storage provider is currently configured.

Design and implement table/database-style blocks and inline image/file attachments. First document the proposed schema, storage provider, size/type limits, access controls, and migration approach in the task notes; keep binaries out of Turso and never expose public cross-user URLs. Preserve existing block data and ensure all reads/downloads are authorized to the owning user. Do not add external storage credentials or deploy secret changes. Acceptance: create/edit/delete and reload persisted table rows and attachments; enforce validation and authorization; document configuration, migration, and validation evidence. If a storage vendor/account or billable choice is required, report the exact blocker and proposed options instead of inventing credentials.

### [TASK-004] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 2/6 — Editor formatting and editing controls

Project context: Fieldnotes is the authenticated personal page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso. Current editor supports paragraph, heading 1, heading 2, bullet, to-do, quote, and code blocks; textareas edit plain text. Enter splits a block, Shift+Enter inserts a line break, Backspace in an empty block removes it when there is a previous block, and Enter in code inserts a newline. There is no rich-text/Markdown formatting, drag-and-drop block reorder, or undo/redo.

Relevant sources: components/workspace-app.tsx; app/api/workspace/route.ts; lib/workspace-db.ts; app/globals.css. Saving is debounced and shows Saved/Saving/Not saved.

Implement accessible formatting and editing controls: inline rich text or a clearly specified Markdown interaction, block reorder by keyboard and pointer, and reliable undo/redo for edits/reordering. Keep plain text content readable and migrate compatibly if a new representation is needed. Acceptance: keyboard users can perform all key editing actions; reorder persists without duplicate/lost blocks; undo/redo restores text and structure accurately; save failures remain visible and recoverable; document shortcuts and validation evidence. Avoid bundling database, upload, or collaboration work into this task.

### [TASK-003] status:open from:codex to:claude opened:2026-10-30T23:39Z
FIELDNOTES GAP 1/6 — Page organization and archive recovery

Project context: Fieldnotes is the authenticated personal page/block app at https://fieldnotes-workspace.vercel.app. Stack: Next.js, Clerk authentication (currently development instance by user choice), Turso SQLite-compatible storage. Current pages can be created, renamed, assigned one of 9 emoji icons, favorited, and archived. Active pages sort favorites first then updated time. Archive is a soft delete via archived_at, but the UI has no archive view or restore action. Pages currently have no parent/child hierarchy.

Relevant sources: components/workspace-app.tsx; app/api/workspace/route.ts; lib/workspace-db.ts; README.md. The verified Clerk server session owns every page/block; API callers cannot choose another owner ID.

Implement page nesting and a usable archive/restore flow. Preserve existing page IDs and data. Define safe parent relationships (owner scoped, no cycles, deleting/archiving a parent must not orphan or expose descendants), migrate existing rows safely, and ensure navigation remains usable on desktop/mobile. Acceptance: users can create/move nested pages, browse archived pages, restore them, and archive a parent without losing descendants; every query and mutation remains owner-scoped; document schema/API/UI changes and rollout/validation evidence. Do not introduce team sharing here.

## Resolved / Log

### [TASK-002] status:done from:codex to:codex opened:2026-10-18T08:57Z
Deploy Antigravity's cross-platform installation hub to Vercel production; verify Clerk, Turso, PWA download routes, and record the deployment outcome.

**Done Note (2026-10-18T09:05Z):** Committed Antigravity's cross-platform PWA install hub as 293e852 and pushed main. Vercel production deployment dpl_HVY3sGVvQ6Mh4cX2CFbTkkVzqqxb is Ready at https://fieldnotes-workspace.vercel.app. npm run lint and npm run build passed on Node 24.19.0; smoke-checked sign-in redirect, development Clerk sign-in UI, /download iOS/Android/Mac tabs, published DMG link, standalone manifest, icons, and protected unauthenticated API. Turso token passed a read-only SELECT 1 check. Clerk is intentionally still in development mode per user instruction.

### [TASK-001] status:done from:antigravity to:antigravity opened:2026-10-18T08:49Z
Implement cross-platform mobile installation (PWA, iOS Safari Add-to-Home-Screen guide, Android 1-tap Chrome install, and download hub)

**Done Note (2026-10-18T08:49Z):** Added app/manifest.ts, public icons (192, 512, apple-touch-icon), lib/use-pwa.ts hook with useSyncExternalStore, components/install-modal.tsx, app/download/download-view.tsx cross-platform hub, mobile install banner in workspace-app.tsx, .env.example mobile variables, and verified npm run lint & npm run build successfully

