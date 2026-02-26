# Solid (solid-ui)

React Native / Expo crypto savings app. Frontend-only repo — all backend APIs are external.

## Cursor Cloud specific instructions

### Running the app (web mode)

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx expo start --web --port 8081
```

- The Metro bundler requires ~8 GB heap to bundle 11k+ modules (heavy web3 deps: thirdweb, walletconnect, viem, etc.). Without `--max-old-space-size=8192` it will OOM.
- First bundle takes ~90s on a cold cache; subsequent reloads are ~8s (Metro caches).
- The `--clear` flag forces a full rebuild from scratch (use when env vars change).
- Missing asset warnings (`purple_onboarding_bg.png`, `animations/rocket.json`, etc.) are pre-existing and do not block the app from loading.

### Environment variables

- All `EXPO_PUBLIC_*` secrets are injected as environment variables by the Cloud Agent infrastructure.
- Expo reads from `.env.local` **and** the process environment. To pick up injected secrets, write them to `.env.local`:
  ```bash
  env | grep '^EXPO_PUBLIC_' | sort > .env.local
  echo "HEAD_ORIGIN=$HEAD_ORIGIN" >> .env.local
  ```
- After changing env vars, restart the Expo server with `--clear` so Metro picks up the new values.

### Lint, test, format

See `package.json` scripts. Key commands:

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Unit tests | `npx jest --testPathIgnorePatterns='playwright'` |
| Format check | `npm run format:check` |

- `npm test` will fail because Jest picks up Playwright specs under `playwright/`. Use the `--testPathIgnorePatterns='playwright'` flag.
- Playwright E2E tests (`npm run test:e2e`) require a running web server and pre-generated auth state (`npm run generate:auth`).

### Gotchas

- `postinstall` runs `patch-package && npm run assets:update`. If `npm install` fails on postinstall, check that `scripts/update-assets.ts` and the patched tarballs exist.
- The app shows "Failed to fetch" errors on first load when backend APIs are unreachable. Clicking "Visit Home" recovers to the dashboard with partial functionality.
- `EXPO_PUBLIC_ENVIRONMENT=qa` connects to the QA backend. Use `preview` for the staging environment.
