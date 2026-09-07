
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2025-02-27 - Hardcoded API Keys in Client Configuration
**Vulnerability:** Hardcoded API keys (Firebase API Key, App ID, Supabase URL, and Supabase Anon Key) were exposed in the source code as fallback values for environment variables in `src/lib/firebase.ts` and `src/services/supabaseClient.ts`.
**Learning:** Developers often provide hardcoded test or dummy strings as fallbacks during development. However, these are frequently checked into version control and can expose sensitive infrastructure details or trigger automated secret scanners (e.g., GitGuardian), causing alert fatigue.
**Prevention:** Instead of using functional dummy strings or real development endpoints, use empty strings (`""`) as fallbacks when chaining string methods like `.trim()`. This enforces strict runtime assertions to fail fast without bypassing security checks.
