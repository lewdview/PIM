## 2023-10-27 - [Fix Admin Passphrase Exposure]
**Vulnerability:** A hardcoded admin passphrase was exposed in the client-side JavaScript bundle and used directly in API payloads.
**Learning:** Client-side gating must never ship the plaintext secret in the bundle (not even in `VITE_` variables), and ephemeral state decoupling from `sessionStorage` causes silent failures on reload if backend API calls require the lost secret without a fallback.
**Prevention:** Use SHA-256 client-side hash checks for frontend gating, and ensure backend sync logic includes a `prompt()` fallback to request the credentials if lost due to an ephemeral state wipe (e.g., page refresh).
