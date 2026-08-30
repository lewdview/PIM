
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.

## 2025-03-01 - Avoid Bypass Logic in Environment Configuration
**Vulnerability:** Hardcoded API keys (production and dummy keys) were used as fallbacks for missing environment variables in `supabaseClient.ts` and `firebase.ts`.
**Learning:** Providing functional keys as fallbacks for missing `.env` configuration ensures the app boots but completely bypasses intended secret management, quietly leaking credentials in the client bundle.
**Prevention:** When setting up fallback values for environment variables in initialization scripts (e.g. `import.meta.env.VITE_KEY || ""`), always use empty strings so runtime assertion checks appropriately fail fast, or explicitly handle the lack of configuration rather than exposing hardcoded keys.
