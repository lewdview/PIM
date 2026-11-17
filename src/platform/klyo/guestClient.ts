// The portal build's stand-in for @supabase/supabase-js (vite.config.ts swaps it in). klyo
// runs the game as a guest with no account or backend of its own, and blocks every outside
// connection anyway, so this client answers each request as "unavailable" without touching
// the network. Calls can be chained and awaited exactly like the real client's; they all
// resolve to { data: null, error }, which is what the game already handles when it is
// offline. The auth half reports "no session" so nothing waits on a sign-in.

const UNAVAILABLE = { message: 'unavailable in this build', name: 'GuestBuild', status: 0 };
const RESULT = { data: null, error: UNAVAILABLE, count: null, status: 0, statusText: '' };

/** Anything called or read on it returns itself; awaiting it gives RESULT. */
function chain(): unknown {
  const self: unknown = new Proxy(function () {}, {
    get(_target, key) {
      if (key === 'then') return (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(RESULT).then(ok, fail);
      if (key === 'catch') return (fail: (e: unknown) => unknown) => Promise.resolve(RESULT).catch(fail);
      if (key === 'finally') return (done: () => void) => Promise.resolve(RESULT).finally(done);
      if (typeof key === 'symbol') return undefined;
      return self;
    },
    apply() {
      return self;
    },
  });
  return self;
}

const noSession = () => Promise.resolve({ data: { user: null, session: null }, error: UNAVAILABLE });

const auth: unknown = new Proxy(
  {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve({ error: null }),
  } as Record<string, unknown>,
  { get: (known, key) => (typeof key === 'symbol' ? undefined : key in known ? known[key] : noSession) },
);

/** Same call shape as the real createClient; the arguments are ignored. */
export function createClient(..._args: unknown[]): any {
  const rest = chain();
  return new Proxy({}, {
    get: (_target, key) => (key === 'auth' ? auth : typeof key === 'symbol' || key === 'then' ? undefined : rest),
  });
}
