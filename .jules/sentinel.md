## 2025-02-23 - [Hardcoded Admin Passphrase in Client Bundle]
**Vulnerability:** A plaintext hardcoded admin passphrase (`th3scr1b3`) was found in the frontend client bundle (`AdminPage.tsx` and `BeatmapEditor.tsx`).
**Learning:** Hardcoding plaintext secrets in the frontend bundle exposes them to anyone inspecting the source code, leading to unauthorized access to admin functionalities.
**Prevention:** Always use client-side hashing (e.g., Web Crypto API SHA-256) to compare user input against a hardcoded hash, or rely on proper backend authentication. Never hardcode plaintext secrets in the client bundle.
