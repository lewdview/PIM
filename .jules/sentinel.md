## 2024-08-23 - Client-Side Hardcoded Secrets
**Vulnerability:** Admin passphrase was hardcoded in plaintext in the client bundle and checked locally, exposing the secret to any user inspecting the code. A secondary check allowed reading a plaintext passphrase from sessionStorage.
**Learning:** Client-side gating must not rely on plaintext strings, as Vite statically embeds them into the bundle.
**Prevention:** Use Web Crypto API (SHA-256) to compare hashes instead of plain text on the frontend, and avoid caching plaintext secrets in sessionStorage.
