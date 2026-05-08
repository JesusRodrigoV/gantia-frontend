import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { GloveTelemetry } from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';
import { AuthStore } from '@core/stores/auth.store';

@Injectable({
  providedIn: 'root',
})
export class SensorSocket implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  public readonly telemetry = signal<GloveTelemetry | null>(null);
  public readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );

  connect(): void {
    if (this.destroyed || this.socket?.readyState === WebSocket.OPEN) return;

    const token = this.authStore.token();
    if (!token) {
      console.warn('[SensorSocket] No hay token disponible');
      this.connectionStatus.set('error');
      return;
    }

    this.clearReconnectTimer();
    this.connectionStatus.set('connecting');
    this.socket = new WebSocket(`${env.wsUrl}/ws/dashboard?token=${token}`);

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
