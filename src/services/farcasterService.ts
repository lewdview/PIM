// ════════════════════════════════════════════════════════════════════════════════
// farcasterService.ts — PIM : th3v4ult Farcaster Mini App (Frames v2) Integration
// Full-spectrum support: Handshake, Base EVM Wallet, Context Sync, Cast Composer
// ════════════════════════════════════════════════════════════════════════════════

import sdk from '@farcaster/miniapp-sdk';

export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface NotificationDetails {
  url: string;
  token: string;
}

export interface FarcasterClientContext {
  clientFid: number;
  added: boolean;
  safeAreaInsets?: SafeAreaInsets;
  notificationDetails?: NotificationDetails;
}

export interface FarcasterContext {
  user?: FarcasterUser;
  client?: FarcasterClientContext;
  location?: unknown;
}

export interface CastOptions {
  text: string;
  embeds?: string[];
  channelKey?: string;
}

class FarcasterService {
  private initialized = false;
  private isFrame = false;
  private context: FarcasterContext | null = null;

  /**
   * Detects if the app is currently running inside an iframe or webview
   */
  public isInsideFrame(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Initialize the Farcaster Mini App SDK, notify host with ready(), and extract context
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window === 'undefined') return;

    this.isFrame = this.isInsideFrame();
    console.log('[Farcaster] Initializing Mini App service. Inside frame:', this.isFrame);

    try {
      // 1. Await context if available
      try {
        if (sdk && typeof sdk.context !== 'undefined') {
          const rawContext = await sdk.context;
          if (rawContext) {
            this.context = rawContext as unknown as FarcasterContext;
            console.log('[Farcaster] Context loaded from SDK:', this.context);
            this.applySafeAreaInsets(this.context?.client?.safeAreaInsets);
            if (this.context?.client?.notificationDetails && this.context?.user?.fid) {
              this.registerNotificationToken(this.context.client.notificationDetails, this.context.user.fid)
                .catch(err => console.warn('[Farcaster] Auto-token sync warn:', err));
            }
          }
        }
      } catch (ctxErr) {
        console.warn('[Farcaster] Non-fatal: error loading context:', ctxErr);
      }

      // 2. Signal to the parent Warpcast/Farcaster client that the frame is ready
      // disableNativeGestures: true prevents swipe notes in the rhythm engine from triggering browser back gestures
      try {
        if (sdk?.actions?.ready) {
          await sdk.actions.ready({ disableNativeGestures: true });
          console.log('[Farcaster] sdk.actions.ready({ disableNativeGestures: true }) successfully called.');
        }
      } catch (readyErr) {
        console.warn('[Farcaster] Non-fatal: error calling sdk.actions.ready():', readyErr);
      }
    } catch (err) {
      console.warn('[Farcaster] Unexpected initialization error:', err);
    }
  }

  /**
   * Applies client safe area insets as CSS root variables
   */
  private applySafeAreaInsets(insets?: SafeAreaInsets): void {
    if (!insets || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (insets.top != null) root.style.setProperty('--fc-safe-area-top', `${insets.top}px`);
    if (insets.bottom != null) root.style.setProperty('--fc-safe-area-bottom', `${insets.bottom}px`);
    if (insets.left != null) root.style.setProperty('--fc-safe-area-left', `${insets.left}px`);
    if (insets.right != null) root.style.setProperty('--fc-safe-area-right', `${insets.right}px`);
  }

  /**
   * Returns current Farcaster user context if authenticated in Warpcast
   */
  public getUser(): FarcasterUser | null {
    return this.context?.user || null;
  }

  /**
   * Returns the entire context object
   */
  public getContext(): FarcasterContext | null {
    return this.context;
  }

  /**
   * Returns whether the app is running as a verified Farcaster frame
   */
  public isFarcaster(): boolean {
    return this.isFrame || !!this.context?.user;
  }

  /**
   * Retrieves the embedded Base EVM wallet provider from Farcaster
   */
  public async getEthereumProvider(): Promise<any | null> {
    try {
      if (sdk?.wallet?.getEthereumProvider) {
        const provider = await sdk.wallet.getEthereumProvider();
        if (provider) return provider;
      }
    } catch (e) {
      console.warn('[Farcaster] Failed to get ethereum provider from SDK:', e);
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return (window as any).ethereum;
    }
    return null;
  }

  /**
   * Executes a native Base token payment via Farcaster client actions (Warpcast send sheet)
   */
  public async sendToken(options: {
    token?: string;
    amount?: string;
    recipientAddress?: string;
    recipientFid?: number;
  }): Promise<string | null> {
    try {
      if (sdk?.actions?.sendToken) {
        console.log('[Farcaster] Requesting sdk.actions.sendToken:', options);
        const result = await sdk.actions.sendToken(options);
        if (result.success) {
          console.log('[Farcaster] sendToken succeeded:', result.send.transaction);
          return result.send.transaction;
        }
        if (result.reason === 'rejected_by_user') {
          throw new Error('Payment cancelled by user');
        }
        console.warn('[Farcaster] sendToken unsuccessful:', result);
        throw new Error(result.error?.message || 'Farcaster payment failed');
      }
    } catch (err: any) {
      if (err.message === 'Payment cancelled by user') throw err;
      console.warn('[Farcaster] sendToken failed or unsupported:', err);
      throw err;
    }
    return null;
  }

  /**
   * Launches the native Farcaster cast composer prefilled with text & embeds.
   * If running in standard web browser, opens Warpcast Web composer.
   */
  public async composeCast(options: CastOptions): Promise<void> {
    const { text, embeds = [], channelKey } = options;

    // 1. Try official SDK actions.composeCast
    try {
      if (sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({
          text,
          embeds: embeds.slice(0, 2) as [] | [string] | [string, string],
          channelKey
        });
        return;
      }
    } catch (err) {
      console.warn('[Farcaster] sdk.actions.composeCast failed, falling back to Web URL:', err);
    }

    // 2. Web URL fallback
    const baseUrl = 'https://warpcast.com/~/compose';
    const params = new URLSearchParams();
    params.set('text', text);
    for (const embed of embeds) {
      params.append('embeds[]', embed);
    }
    if (channelKey) {
      params.set('channelKey', channelKey);
    }

    const targetUrl = `${baseUrl}?${params.toString()}`;
    await this.openUrl(targetUrl);
  }

  /**
   * Opens an external link safely using the SDK or window.open
   */
  public async openUrl(url: string): Promise<void> {
    try {
      if (sdk?.actions?.openUrl) {
        await sdk.actions.openUrl(url);
        return;
      }
    } catch (err) {
      console.warn('[Farcaster] sdk.actions.openUrl failed:', err);
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Prompts the user to pin PIM: th3v4ult to their Farcaster action tray / favorites
   */
  public async addMiniApp(): Promise<boolean> {
    try {
      if (sdk?.actions?.addFrame) {
        const result = await sdk.actions.addFrame();
        return !!result;
      }
    } catch (err) {
      console.warn('[Farcaster] sdk.actions.addFrame failed:', err);
    }
    return false;
  }

  /**
   * Checks whether the user has active Farcaster notifications
   */
  public isNotificationsEnabled(): boolean {
    if (this.context?.client?.notificationDetails) return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('pim_fc_notifications_enabled') === 'true') {
      return true;
    }
    return false;
  }

  /**
   * Registers a user notification token to the Supabase backend
   */
  public async registerNotificationToken(
    details: NotificationDetails,
    fid: number
  ): Promise<boolean> {
    try {
      const endpoint = 'https://toemkhrfsbkfkutwcjkd.supabase.co/functions/v1/farcaster-webhook';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          fid,
          notificationDetails: details
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pim_fc_notifications_enabled', 'true');
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Farcaster] Failed registering token:', err);
      return false;
    }
  }

  /**
   * Prompts the user to enable Daily Drop notifications in Warpcast and auto-registers their token
   */
  public async promptEnableNotifications(): Promise<boolean> {
    try {
      if (sdk?.actions?.addFrame) {
        const result: any = await sdk.actions.addFrame();
        console.log('[Farcaster] sdk.actions.addFrame result:', result);
        const details = result?.notificationDetails || (this.context?.client as any)?.notificationDetails;
        const fid = this.context?.user?.fid;
        if (details && fid) {
          await this.registerNotificationToken(details, fid);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('pim_fc_notifications_enabled', 'true');
        }
        return true;
      }
    } catch (err) {
      console.warn('[Farcaster] promptEnableNotifications failed:', err);
    }
    return false;
  }
}

export const farcasterService = new FarcasterService();
