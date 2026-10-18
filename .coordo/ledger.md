# Coordo Ledger

> Shared coordination ledger between Claude Code and Google Antigravity (and the human).
> Edit directly, or use the `coordo` CLI. Keep entries terse; link to files/commits for detail.

## Decisions Needed

## Tasks

## Resolved / Log

### [TASK-002] status:done from:codex to:codex opened:2026-10-18T08:57Z
Deploy Antigravity's cross-platform installation hub to Vercel production; verify Clerk, Turso, PWA download routes, and record the deployment outcome.

**Done Note (2026-10-18T09:05Z):** Committed Antigravity's cross-platform PWA install hub as 293e852 and pushed main. Vercel production deployment dpl_HVY3sGVvQ6Mh4cX2CFbTkkVzqqxb is Ready at https://fieldnotes-workspace.vercel.app. npm run lint and npm run build passed on Node 24.19.0; smoke-checked sign-in redirect, development Clerk sign-in UI, /download iOS/Android/Mac tabs, published DMG link, standalone manifest, icons, and protected unauthenticated API. Turso token passed a read-only SELECT 1 check. Clerk is intentionally still in development mode per user instruction.

### [TASK-001] status:done from:antigravity to:antigravity opened:2026-10-18T08:49Z
Implement cross-platform mobile installation (PWA, iOS Safari Add-to-Home-Screen guide, Android 1-tap Chrome install, and download hub)

**Done Note (2026-10-18T08:49Z):** Added app/manifest.ts, public icons (192, 512, apple-touch-icon), lib/use-pwa.ts hook with useSyncExternalStore, components/install-modal.tsx, app/download/download-view.tsx cross-platform hub, mobile install banner in workspace-app.tsx, .env.example mobile variables, and verified npm run lint & npm run build successfully

