## 2025-02-14 - Hardcoded Frontend Admin Credentials
**Vulnerability:** A hardcoded administration passphrase (`'th3scr1b3'`) was found in both `src/pages/AdminPage.tsx` and `src/pages/BeatmapEditor.tsx`.
**Learning:** These passphrases were part of the client bundle, meaning anyone inspecting the frontend code could find them and bypass the admin gates, potentially gaining unauthorized access to administrative or developer functions.
**Prevention:** Always use environment variables (e.g., `import.meta.env.VITE_ADMIN_PASSPHRASE`) to inject credentials into the application rather than hardcoding strings. Additionally, ensure that strict equality matching is used rather than case-insensitive checks which could inadvertently match a wider set of inputs.
