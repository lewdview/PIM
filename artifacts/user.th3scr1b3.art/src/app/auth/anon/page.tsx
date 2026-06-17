'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Loader2, Fingerprint } from 'lucide-react';
import styles from './page.module.css';

function AnonLoginContent() {
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<string[]>(['[SYSTEM] Initializing node bridge...']);
  const [error, setError] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    const performAnonAuth = async () => {
      const redirectUri = searchParams.get('redirect_uri') || 'http://localhost:5173/';
      addLog(`[SYSTEM] Target node detected: ${redirectUri}`);

      try {
        // 1. Check existing session
        addLog('[SYSTEM] Checking active authorization matrix...');
        const { data: { session } } = await supabase.auth.getSession();

        let activeSession = session;

        if (activeSession) {
          addLog('[SYSTEM] Existing active session detected. Re-binding credentials...');
        } else {
          addLog('[SYSTEM] No session active. Generating anonymous client credentials...');
          const { data, error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) throw anonError;
          activeSession = data.session;
          addLog('[SYSTEM] Anonymous credentials successfully compiled.');
        }

        if (!activeSession) {
          throw new Error('Failed to establish session.');
        }

        const accessToken = activeSession.access_token;
        const refreshToken = activeSession.refresh_token;

        addLog('[SYSTEM] Dispatching authorization clearance tokens...');
        
        // Append tokens to redirect URL
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.set('access_token', accessToken);
        redirectUrl.searchParams.set('refresh_token', refreshToken);
        
        addLog('[SYSTEM] Establishing secure tunnel handshake...');
        
        // Wait a short duration to let logs render for visual polish
        await new Promise(resolve => setTimeout(resolve, 800));
        
        window.location.href = redirectUrl.toString();
      } catch (err: any) {
        console.error('Anonymous login error:', err);
        setError(err.message || 'Unknown authentication failure.');
        addLog(`[ERROR] Auth sequence terminated: ${err.message || 'Unknown error'}`);
      }
    };

    performAnonAuth();
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <div className={styles.terminal}>
        <div className={styles.terminalHeader}>
          <Fingerprint size={16} className={styles.icon} />
          <span>IDENTITY_TUNNEL.EXE</span>
        </div>
        <div className={styles.terminalBody}>
          {logs.map((log, index) => (
            <div key={index} className={styles.logLine}>
              {log}
            </div>
          ))}
          {error ? (
            <div className={styles.errorLine}>
              [FATAL] {error}
            </div>
          ) : (
            <div className={styles.spinnerLine}>
              <Loader2 className={styles.spinner} size={14} />
              <span>Processing secure tunnel clearance...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnonLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-black text-white font-mono text-xs">
        Loading Identity Portal...
      </div>
    }>
      <AnonLoginContent />
    </Suspense>
  );
}
