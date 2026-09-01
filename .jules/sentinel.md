
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2024-05-18 - Hardcoded Supabase Credentials
**Vulnerability:** Hardcoded Supabase API Key and URL in `src/services/supabaseClient.ts`. Also `src/lib/firebase.ts` dummy api key replacements.
**Learning:** Defaulting to a hardcoded string when an environment variable is missing can accidentally commit sensitive information to source control and leak it to the public bundle.
**Prevention:** When implementing fallback values for environment variables, strictly use empty strings (`""`) or remove the fallback altogether. Rely on runtime checks (like `if (!SUPABASE_URL) throw new Error(...)`) to fail-fast if configuration is missing, rather than masking it with hardcoded values.
