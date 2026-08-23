## 2024-08-23 - Hardcoded Plaintext Passphrase Exposure

**Vulnerability:** Admin passwords ('th3scr1b3') are stored in plaintext in the codebase (`AdminPage.tsx`, `BeatmapEditor.tsx`, `adminConfig.ts`) and sent to backend API calls as plaintext. It also caches this passphrase in `sessionStorage` in `AdminPage.tsx`.
**Learning:** In purely client-side gated areas without a server-side authentication proxy, storing secrets in plaintext directly exposes them to users via standard inspect tools or built source files. A one-way cryptographic hash must be used instead.
**Prevention:** Use the Web Crypto API to hash inputs securely, comparing against pre-computed hashes rather than raw text.
