## 2024-08-13 - Hardcoded Admin Passphrase in Client Bundle
**Vulnerability:** The plaintext admin passphrase was hardcoded in `AdminPage.tsx` and `BeatmapEditor.tsx` and included in the frontend client bundle, allowing anyone inspecting the source to bypass the admin gate.
**Learning:** Frontend authentication gating using hardcoded strings exposes secrets to the client. Relying on simple string comparison for authentication is highly insecure in a browser environment where all source code is visible.
**Prevention:** Always use client-side hashing (like SHA-256 via Web Crypto API) to compare user input against a pre-computed hash instead of a plaintext string.
