## 2024-05-24 - [CRITICAL] Fixed Hardcoded Admin Credentials
**Vulnerability:** A critical vulnerability existed where the plaintext administrative passphrase (`th3scr1b3`) was hardcoded directly in the client-side bundle in `AdminPage.tsx`. Anyone inspecting the page source could extract this passphrase.
**Learning:** In Vite/React frontend apps, anything in the client source code is public. For frontend-only gating, we should use client-side hashing (e.g. `crypto.subtle.digest('SHA-256')`) and compare against a hardcoded hash, not plaintext.
**Prevention:** Never hardcode credentials in frontend code. Use hashed values for client-side comparison, and temporarily store sensitive credentials entered by the user in `sessionStorage` strictly for authorized backend API calls.
