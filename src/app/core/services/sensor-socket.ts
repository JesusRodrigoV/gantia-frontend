import { Injectable, OnDestroy, signal } from '@angular/core';
import { GloveTelemetry } from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SensorSocket implements OnDestroy {
  private socket: WebSocket | null = null;
  private readonly WS_URL = `wss://${env.apiUrl}/ws/dashboard?token=mi_llave_secreta_123`;

  public readonly telemetry = signal<GloveTelemetry | null>(null);
  public readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );

  constructor() {
    this.connect();
  }

  private connect(): void {
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
      } catch (error) {}
    };

    this.socket.onerror = () => {
      this.connectionStatus.set('error');
    };

    this.socket.onclose = () => {
      this.connectionStatus.set('disconnected');
      setTimeout(() => this.connect(), 5000);
    };
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.close();
    }
  }
}
