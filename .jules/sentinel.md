## 2025-02-14 - Replace Hardcoded Secrets with Empty Strings in Fallbacks
**Vulnerability:** Found `DEFAULT_SUPABASE_ANON_KEY` hardcoded with an actual API key JWT (starting with `eyJhbGc...`) in NextJS endpoints, Vite Supabase client init, test scripts, and the discord bot config.
**Learning:** Hardcoding a secret in configuration scripts or fallbacks defeats secret scanning and poses a critical vulnerability risk, as source control now tracks valid credentials, allowing any developer/system with repo access to abuse them. Dummy strings or default strings shouldn't be valid looking keys.
**Prevention:** Always replace dummy secrets in environment variable fallbacks with empty strings (`""`) to prevent false positive secret scanning alerts and enforce fail-fast behavior when required environment variables are absent.

## 2025-02-14 - Replace Hardcoded Secrets with Empty Strings in Fallbacks
**Vulnerability:** Found `DEFAULT_SUPABASE_ANON_KEY` hardcoded with an actual API key JWT (starting with `eyJhbGc...`) in NextJS endpoints, Vite Supabase client init, test scripts, and the discord bot config.
**Learning:** Hardcoding a secret in configuration scripts or fallbacks defeats secret scanning and poses a critical vulnerability risk, as source control now tracks valid credentials, allowing any developer/system with repo access to abuse them. Dummy strings or default strings shouldn't be valid looking keys.
**Prevention:** Always replace dummy secrets in environment variable fallbacks with empty strings (`""`) to prevent false positive secret scanning alerts and enforce fail-fast behavior when required environment variables are absent.
