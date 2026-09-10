
## 2025-02-27 - Hardcoded Admin Passphrase Removal
**Vulnerability:** A critical vulnerability where a hardcoded admin passphrase was embedded in the client-side frontend bundle within `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** Storing secrets or administrative passwords directly in the source code exposes them to anyone who examines the client bundle. This happens frequently when creating simple gating mechanisms on the frontend without a dedicated backend auth route.
**Prevention:** For client-side-only authentication gates, developers should rely on cryptographic hashes. Use `window.crypto.subtle.digest` to evaluate entered passphrases against a stored hash value (e.g., SHA-256) instead of keeping the raw secret exposed in the JS bundle. If background services strictly require the raw passphrase payload, store it temporarily in `sessionStorage` post-authorization.
## 2024-05-31 - Hardcoded Plaintext Passphrase
**Vulnerability:** A backend API call in `src/utils/adminConfig.ts` was hardcoding the plaintext passphrase `th3scr1b3` in the payload body, exposing it in the client bundle.
**Learning:** While the client-side gate correctly hashed user input against a secure constant, the underlying API function call carelessly hardcoded the plaintext secret to authorize the request, defeating the entire purpose of the hash. It is crucial to verify that the *entire* lifecycle of authentication, including backend calls, does not leak the secret.
**Prevention:** Rather than hardcoding the secret in the bundle, dynamically retrieve the user's plaintext input from `sessionStorage` (which was already being stored during the initial hash validation) to pass to backend edge functions.
