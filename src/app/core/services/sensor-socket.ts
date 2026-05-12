import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { GloveTelemetry, ActionEvent, isActionMessage } from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';
import { AuthStore } from '@core/stores/auth.store';

const MAX_RECENT_ACTIONS = 30;

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
  public readonly actionEvent = signal<ActionEvent | null>(null);
  public readonly recentActions = signal<ActionEvent[]>([]);

  private lastMouseModeValue: unknown = null;
  public readonly mouseModeActive = signal(false);

  connect(): void {
    this.destroyed = false;
    if (this.socket?.readyState === WebSocket.OPEN) return;

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
        const data = JSON.parse(event.data);

        if (isActionMessage(data)) {
          this.actionEvent.set(data);

          this.recentActions.update(prev => [data, ...prev].slice(0, MAX_RECENT_ACTIONS));

          if (data.action === 'mouse_mode') {
            const newVal = data.action_value;
            if (newVal !== this.lastMouseModeValue) {
              this.lastMouseModeValue = newVal;
              this.mouseModeActive.set(newVal === true || newVal === 'ON');
            }
          }

          return;
        }

        if (data && typeof data.accel_x !== 'undefined') {
          this.telemetry.set(data as GloveTelemetry);
        }
      } catch (error) {
        console.warn('[SensorSocket] Failed to parse WebSocket message:', event.data);
      }
    };

    this.socket.onerror = () => {
      this.connectionStatus.set('error');
      this.telemetry.set(null);
    };

    this.socket.onclose = () => {
      this.connectionStatus.set('disconnected');
      this.telemetry.set(null);
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
