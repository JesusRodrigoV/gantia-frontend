import { Injectable, OnDestroy, signal } from '@angular/core';
import { GloveTelemetry } from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SensorSocket implements OnDestroy {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private readonly WS_URL = `${env.apiUrl}/ws/frontend`;

  public readonly telemetry = signal<GloveTelemetry | null>(null);
  public readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );

  connect(): void {
    if (this.destroyed || this.socket?.readyState === WebSocket.OPEN) return;

    this.clearReconnectTimer();
    this.connectionStatus.set('connecting');
    this.socket = new WebSocket(this.WS_URL);

    this.socket.onopen = () => {
      this.connectionStatus.set('connected');
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as GloveTelemetry;
        if (data && typeof data.accel_x !== 'undefined') {
          this.telemetry.set(data);
        }
      } catch (error) {
        console.warn('[SensorSocket] Failed to parse WebSocket message:', event.data);
      }
    };

    this.socket.onerror = () => {
      this.connectionStatus.set('error');
    };

    this.socket.onclose = () => {
      this.connectionStatus.set('disconnected');
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    };
  }

  disconnect(): void {
    this.destroyed = true;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
