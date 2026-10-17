# Fieldnotes Workspace

An original page-and-block writing app inspired by the workflow of modern note tools. It includes pages, block types, search, favorites, archive, autosave, and a saved light/dark theme that follows the system preference until changed. The web app runs on Next.js and Vercel, uses Clerk for sign-in, and stores each user's pages in Turso.

## Web setup

Use Node.js 22.13 or newer. Copy `.env.example` to an ignored `.env.local` and provide a dedicated Turso database URL and token plus a Clerk publishable key and secret key. Then run `npm install` and `npm run dev`.

The API gets the user ID from Clerk's verified server session. Browser requests cannot choose an owner ID. Turso credentials stay on the server. The first authenticated request creates the database tables and a welcome page.

Deploy this directory as a Next.js project on Vercel with the same environment variables. `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` controls the desktop download link and public `/download` page.

Clerk production instances require a domain you own. Until a domain and production Clerk keys are configured, deployments using development keys are suitable for preview use only.

## macOS app

`desktop/` contains a small Electron app that opens the hosted Fieldnotes web app in a dedicated window. It requires an internet connection and an Apple Silicon Mac. It does not store a second local copy of workspace data. Set `desktop/config.json` to the deployed URL and run `npm install && npm run build:mac` from that directory to create a DMG in `outputs/desktop/`.

The current DMG has an ad hoc signature. Public distribution without Gatekeeper warnings requires an Apple Developer ID Application certificate, a hardened runtime, notarization, and stapling. The available local Apple Development certificate is insufficient for direct public distribution.

## Data boundary

The earlier ChatGPT Site and this Clerk app use different user IDs. They can point at the same Turso database, but existing Site pages are not automatically reassigned to Clerk users. No data migration is performed without an explicit account mapping.

This app does not contain Notion code or Notion account data. The first version has no team sharing, comments, uploads, offline editing, or real-time collaboration. The separate reverse-engineering report lives in `../reverse-engineering-lab/investigations/notion-macos-7.34.0/README.md` in the local workspace.
