### Passkey/AASA local development (branch notes)

Short summary of what changed for passkey + AASA local dev and how to set up HTTPS certs used by the dev server.

### What changed

- `components/TurnkeyProvider.tsx`
  - Added `getRuntimeRpId()` with env override and dev fallback; logs RP ID and AASA dev mode.
  - Native `TurnkeyProvider` configured via `EXPO_PUBLIC_TURNKEY_*`.

- `hooks/useUser.ts`
  - Passkey flows (signup/login/safeAA) now use `getRuntimeRpId()` for `rpId` on both web and iOS.
  - Added detailed logs around platform, RP ID, and passkey results.

- `lib/config.ts`
  - New envs for dev: `EXPO_PUBLIC_AASA_URL`, `EXPO_PUBLIC_RELYING_PARTY_ID`, `EXPO_PUBLIC_FRONTEND_URL`, `EXPO_PUBLIC_ALLOWED_ORIGINS`, `EXPO_PUBLIC_ASA_PORT`.
  - `isAASADevelopment` flips when `RELYING_PARTY_ID === "localhost.com"` and `AASA_URL` is set.

- `app.config.js` (iOS only for this branch)
  - `associatedDomains`:
    - `webcredentials:localhost.com?mode=developer`
    - `applinks:localhost.com?mode=developer`
  - `appleTeamId` present.

- `ios/Solid/Solid.entitlements` (mirrors `associatedDomains`)

- `metro.config.js`
  - HTTPS dev server on port 443; reads `localhost-key.pem` and `localhost-cert.pem` from repo root.
  - Host set to `localhost` (Expo constraint). `https://localhost.com` still resolves via `/etc/hosts`.

- `package.json` scripts
  - `web`: `expo start --web --https --host localhost --port 443`
  - `start:https`: `sudo expo start --web --https --host localhost --port 443`

### SSL certificates (mkcert)

Prereqs (macOS):

```bash
brew install mkcert
mkcert -install
```

Generate certs in the repo root (cover all local names used):

```bash
cd /Users/nikolayrivkin/Documents/vscode/solid-ui-1
mkcert -key-file localhost-key.pem -cert-file localhost-cert.pem "localhost" "localhost.com" "127.0.0.1" "::1"
```

Trust root CA on macOS (mkcert usually does this via `-install`). If needed:

```bash
open "$(mkcert -CAROOT)"
# In Keychain Access, set the mkcert root CA to "Always Trust" (System + Login keychains).
```

Trust on iOS Simulator (for AASA/passkeys testing):

- Drag the mkcert root CA `.pem` from `$(mkcert -CAROOT)` into a booted Simulator to install the profile.
- On the Simulator: Settings → General → About → Certificate Trust Settings → enable full trust for that root.

Do NOT commit the PEMs:

- Keep `localhost-key.pem` and `localhost-cert.pem` out of git.

### Hostname mapping

Ensure `localhost.com` maps locally:

```bash
sudo sh -c 'echo "127.0.0.1 localhost.com" >> /etc/hosts'
```

Expo must run with host `localhost`. Access works via both:

- `https://localhost:443`
- `https://localhost.com:443` (via `/etc/hosts`)

### Run

```bash
npm run web
# or (if needed for privileged port 443)
npm run start:https
```

Quick verify:

```bash
curl -kI https://localhost:443 | head -1
curl -kI https://localhost.com:443 | head -1
```

### Env (optional for AASA/passkeys dev)

```bash
export EXPO_PUBLIC_RELYING_PARTY_ID=localhost.com
export EXPO_PUBLIC_AASA_URL=https://localhost.com/.well-known/apple-app-site-association
export EXPO_PUBLIC_FRONTEND_URL=https://localhost.com
export EXPO_PUBLIC_ALLOWED_ORIGINS=https://localhost.com
```

Notes:

- Web fallback RP ID (when env is not set): `localhost` in dev, `solid.xyz` otherwise.
- AASA server should serve the file on 443 with `Content-Type: application/json` (no charset), and `webcredentials.apps` should include `TeamID.BundleID` (e.g., `QC9255BHMY.xyz.solid.ios`).
