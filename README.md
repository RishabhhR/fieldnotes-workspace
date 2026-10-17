# Fieldnotes Workspace

An original, private web workspace inspired by the page-and-block workflow of Notion. This does not ship Notion code or use its service or account data. The first version supports pages, page icons, favorites, search across page titles and block text, autosaved blocks, block types, and archive.

## Stack

- Vinext/React on ChatGPT Sites, owner-private by default.
- ChatGPT sign-in provided by Sites; every API request uses the authenticated Site user ID.
- A dedicated Turso/libSQL database accessed from server routes only. The browser never receives the database URL or token.
- `@libsql/client/web` is pinned to `0.15.15` for the Cloudflare Worker runtime.

## Data

The server creates `pages` and `blocks` tables on first authenticated request. Every row has an `owner_id`; reads and writes include that ID. A new user gets one welcome page. Archive hides a page and its blocks from ordinary reads. The first version is single-user per Site account; it does not include team sharing, comments, uploaded files, or real-time collaboration.

Configure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as secret production environment variables in Sites. `.env.example` lists names only; no credentials belong in source. Use a dedicated Turso database for this app.

## Local development

Use Node 22 or newer. Install dependencies, set ignored local `.env` values, and run the Vinext preview. Local sign-in is simulated by the Sites starter at `/signin-with-chatgpt?return_to=/`. The published Site uses real Sites authentication.

See the separate [reverse-engineering report](../reverse-engineering-lab/investigations/notion-macos-7.34.0/README.md) for evidence about the installed macOS app. That report informs product boundaries; this implementation is independently authored.
