
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-02-27 - Hardcoded API Keys in Config
**Vulnerability:** A critical vulnerability where hardcoded fallback API keys and endpoints for Supabase (URL, Anon Key) and Firebase (API Key, App ID) were present in `src/services/supabaseClient.ts` and `src/lib/firebase.ts`. This effectively bypassed the intended runtime environment variable checks.
**Learning:** Including functional placeholder/fallback credentials in configuration files exposes the application to unauthorized access if those keys are pushed to the repository or if the environment variables are accidentally omitted, rendering the missing-variable safety checks useless.
**Prevention:** Always default to empty strings or `undefined` for fallback secrets, and implement robust startup assertions (`if (!KEY) throw new Error(...)`) that force the app to fail fast when environment variables are missing, ensuring secrets are never hardcoded.
