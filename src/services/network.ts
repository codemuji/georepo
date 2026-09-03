export type NetworkStatusListener = (isOnline: boolean) => void;

export class NetworkMonitorService {
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : false;
  private listeners: Set<NetworkStatusListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleStatusChange(true));
      window.addEventListener('offline', () => this.handleStatusChange(false));
    }
  }

  private handleStatusChange(isOnline: boolean): void {
    this.online = isOnline;
    this.listeners.forEach((listener) => {
      try {
        listener(isOnline);
      } catch (err) {
        console.error('Error in network status listener:', err);
      }
    });
  }

  public isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Call immediately with current status
    listener(this.online);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setSimulatedStatus(isOnline: boolean): void {
    this.handleStatusChange(isOnline);
  }
}

export const networkMonitor = new NetworkMonitorService();
