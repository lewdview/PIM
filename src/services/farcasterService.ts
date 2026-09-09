// ════════════════════════════════════════════════════════════════════════════════
// farcasterService.ts — PIM : th3v4ult Farcaster Mini App (Frames v2) Integration
// Full-spectrum support: Handshake, Base EVM Wallet, Context Sync, Cast Composer
// ════════════════════════════════════════════════════════════════════════════════

import sdk from '@farcaster/frame-sdk';

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

export interface FarcasterClientContext {
  clientFid: number;
  added: boolean;
  safeAreaInsets?: SafeAreaInsets;
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
}

export const farcasterService = new FarcasterService();
