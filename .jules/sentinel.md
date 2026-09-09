
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-14 - Fix Hardcoded Admin Passphrase in adminConfig.ts
**Vulnerability:** A hardcoded admin passphrase was found in `src/utils/adminConfig.ts` when making a call to `vault-engine`.
**Learning:** This existed to sync the admin config to the backend edge function, which apparently requires the plaintext passphrase to authenticate.
**Prevention:** Hardcoded secrets should never be embedded in the client code bundle. The plaintext secret must be dynamically provided at runtime (e.g., from `sessionStorage` populated during manual admin login) to prevent it from leaking in the static client build while still satisfying the edge function's authentication requirements.
## 2023-10-27 - Remove hardcoded Firebase API keys
**Vulnerability:** Hardcoded API keys in `src/lib/firebase.ts` dummy strings (e.g., `AIzaSy_dummy_api_key_replace_me`).
**Learning:** Dummy strings formatted like real API keys (starting with `AIzaSy...`) can trigger automated secret scanners (like GitGuardian or TruffleHog) and create unnecessary alert noise. Hardcoded dummy keys in environment variable fallbacks also prevent fail-fast assertions during local development when actual keys are missing.
**Prevention:** Always replace dummy secrets in environment variable fallbacks with empty strings (`""`) to prevent false positive secret scanning alerts and enforce fail-fast behavior when required environment variables are absent.
