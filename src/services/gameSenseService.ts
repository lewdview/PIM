export type GameSenseStatus = 'scanning' | 'connected' | 'disconnected' | 'unavailable';

class GameSenseService {
  private apiBaseUrl: string | null = null;
  private isAvailable: boolean = false;
  private isRegistered: boolean = false;
  private heartbeatInterval: any = null;

  /**
   * Discovers the local Express proxy API by testing common ports.
   */
  async init(): Promise<GameSenseStatus> {
    const isEnabled = localStorage.getItem("opt_gameSenseEnabled") === "true";
    if (!isEnabled) {
      this.isAvailable = false;
      this.stopHeartbeat();
      return 'disconnected';
    }

    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const candidates = isLocal ? [
      "/api/gamesense",
      "http://localhost:3000/api/gamesense",
      "http://localhost:8082/api/gamesense",
      "http://localhost:8080/api/gamesense"
    ] : [
      "/api/gamesense"
    ];

    for (const base of candidates) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);

        const res = await fetch(`${base}/status`, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.status) {
            this.apiBaseUrl = base;
            this.isAvailable = true;
            
            const success = await this.registerGame();
            if (success) {
              this.startHeartbeat();
              return 'connected';
            }
          }
        }
      } catch (e) {
        // Try next candidate
      }
    }

    this.isAvailable = false;
    this.stopHeartbeat();
    return 'unavailable';
  }

  private async registerGame(): Promise<boolean> {
    if (!this.apiBaseUrl || !this.isAvailable) return false;

    try {
      const res = await fetch(`${this.apiBaseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        this.isRegistered = true;
        return true;
      }
    } catch (e) {
      console.warn("Failed to register GameSense game/events:", e);
    }
    return false;
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (!this.isAvailable || !this.apiBaseUrl) return;

    this.heartbeatInterval = setInterval(async () => {
      try {
        await fetch(`${this.apiBaseUrl}/heartbeat`, {
          method: 'POST'
        });
      } catch (e) {
        // Ignore failures
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async sendHit() {
    await this.sendEvent('HIT_EVENT', { value: 100 });
  }

  async sendMiss() {
    await this.sendEvent('MISS_EVENT', { value: 100 });
  }

  async sendCombo(combo: number) {
    const clampedCombo = Math.min(100, Math.max(0, combo));
    await this.sendEvent('COMBO', { value: clampedCombo });
  }

  async sendHealth(missesRemaining: number) {
    const val = Math.min(3, Math.max(0, missesRemaining));
    await this.sendEvent('HEALTH', { value: val });
  }

  async sendPowerup(state: number) {
    await this.sendEvent('POWERUP', { value: state });
  }

  async sendModifier(state: number) {
    await this.sendEvent('MODIFIER', { value: state });
  }

  private async sendEvent(event: string, data: any) {
    if (!this.isAvailable || !this.apiBaseUrl || !this.isRegistered) return;

    try {
      await fetch(`${this.apiBaseUrl}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data })
      });
    } catch (e) {
      // Swallowed
    }
  }

  getStatus(): boolean {
    return this.isAvailable;
  }
}

export const gameSenseService = new GameSenseService();
