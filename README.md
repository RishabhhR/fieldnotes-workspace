# Fieldnotes Workspace

An original page-and-block writing app inspired by the workflow of modern note tools. It includes pages, block types, search, favorites, archive, autosave, and a saved light/dark theme that follows the system preference until changed. The web app runs on Next.js and Vercel, uses Clerk for sign-in, and stores each user's pages in Turso.

## Web setup

Use Node.js 22.13 or newer. Copy `.env.example` to an ignored `.env.local` and provide a dedicated Turso database URL and token plus a Clerk publishable key and secret key. Then run `npm install` and `npm run dev`.

The API gets the user ID from Clerk's verified server session. Browser requests cannot choose an owner ID. Turso credentials stay on the server. The first authenticated request creates the database tables and a welcome page.

Deploy this directory as a Next.js project on Vercel with the same environment variables.
- `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL`: macOS desktop DMG download URL.
- `NEXT_PUBLIC_IOS_APP_STORE_URL`: (Optional) Apple App Store or TestFlight link.
- `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`: (Optional) Google Play Store link.
- `NEXT_PUBLIC_ANDROID_APK_URL`: (Optional) Direct Android APK download URL.

## Mobile app (iOS & Android)

Fieldnotes is fully configured as a Progressive Web App (PWA) with native mobile installation:
- **iPhone & iPad (iOS)**: Users visiting in Safari can install Fieldnotes directly to their Home Screen via **Share → Add to Home Screen**. It opens fullscreen with standalone app windowing, saved theme, and no browser URL bars.
- **Android**: Users visiting in Chrome or Edge can install Fieldnotes with 1 tap via the native install prompt or through **⋮ → Install app / Add to Home screen**.
- **In-App Mobile Banner & Modal**: When accessing Fieldnotes on a phone, an unobtrusive banner and the "Get the app" sidebar option provide device-tailored installation steps and direct store/APK links if configured.
- **Unified `/download` hub**: The `/download` page automatically detects the visitor's operating system (iOS, Android, or Mac) and provides device-specific installation guides and downloads.

Clerk production instances require a domain you own. Until a domain and production Clerk keys are configured, deployments using development keys are suitable for preview use only.

## macOS app

`desktop/` contains a small Electron app that opens the hosted Fieldnotes web app in a dedicated window. It requires an internet connection and an Apple Silicon Mac. It does not store a second local copy of workspace data. Set `desktop/config.json` to the deployed URL and run `npm install && npm run build:mac` from that directory to create a DMG in `outputs/desktop/`.

The current DMG has an ad hoc signature. Public distribution without Gatekeeper warnings requires an Apple Developer ID Application certificate, a hardened runtime, notarization, and stapling. The available local Apple Development certificate is insufficient for direct public distribution.

## Tests

```bash
npm test            # run everything once; needs no credentials or network
npm run test:watch  # re-run on change
npm run test:types  # type-check the tests
```

The tests run the real API route handlers and real SQL against a throwaway local database, and the real React app on top of those handlers in jsdom. Only the Clerk session and the browser-to-server hop are faked. `tests/setup.ts` makes production unreachable: Turso and Clerk variables are removed, `.env.local` is not loaded, the database client refuses anything but a local file, and outgoing network is blocked.

Covered: signed-out rejection, owner isolation across every action, request validation, page and block CRUD, archive, storage errors, autosave and its failure states, keyboard editing, search, favorites and theme persistence.

When a bug can't be fixed right away, pin it with `it.fails`, named `KNOWN BUG`: fixing it turns the suite red until `it.fails` becomes `it`.

**Not covered**, because it cannot be tested safely or meaningfully here: real Clerk session verification and `proxy.ts` route protection (the session is faked); Turso's network behavior (a local SQLite file stands in for it); visual layout and CSS; real-browser behavior, including the PWA install flow and `/download`; and the Electron app.

## Data boundary

The earlier ChatGPT Site and this Clerk app use different user IDs. They can point at the same Turso database, but existing Site pages are not automatically reassigned to Clerk users. No data migration is performed without an explicit account mapping.

This app does not contain Notion code or Notion account data. The first version has no team sharing, comments, uploads, offline editing, or real-time collaboration. The separate reverse-engineering report lives in `../reverse-engineering-lab/investigations/notion-macos-7.34.0/README.md` in the local workspace.
