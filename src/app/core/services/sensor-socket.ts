import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { GloveTelemetry, ActionEvent, isActionMessage } from '@core/models/glove-telemetry.model';
import { env } from '../../../environments/environment';
import { AuthStore } from '@core/stores/auth.store';

const MAX_RECENT_ACTIONS = 30;
const DATA_TIMEOUT_MS = 3000;

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SensorSocket implements OnDestroy {
  private readonly authStore = inject(AuthStore);
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private dataTimeout: ReturnType<typeof setTimeout> | null = null;
  private waitingTimer: ReturnType<typeof setTimeout> | null = null;
  private refCount = 0;
  private shouldBeConnected = false;

  public readonly telemetry = signal<GloveTelemetry | null>(null);
  public readonly connectionStatus = signal<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected',
  );
  public readonly actionEvent = signal<ActionEvent | null>(null);
  public readonly recentActions = signal<ActionEvent[]>([]);

  private lastMouseModeValue: unknown = null;
  public readonly mouseModeActive = signal(false);
  public readonly currentMode = signal<string>('GLOBAL');
  public readonly dataFlowing = signal(false);
  public readonly waitingForDevice = signal(false);

  private resetDataTimeout(): void {
    if (this.dataTimeout) clearTimeout(this.dataTimeout);
    this.dataFlowing.set(true);
    this.dataTimeout = setTimeout(() => {
      this.dataFlowing.set(false);
    }, DATA_TIMEOUT_MS);
  }

  connect(): void {
    const firstConnection = this.refCount === 0;
    this.refCount++;

    if (!firstConnection) return;

    this.shouldBeConnected = true;
    this.establishConnection();
  }

  private establishConnection(): void {
    const token = this.authStore.token();
    if (!token) {
      console.warn('[SensorSocket] No hay token disponible');
      this.connectionStatus.set('error');
      return;
    }

    if (!this.authStore.isAuthenticated() || isTokenExpired(token)) {
      console.warn('[SensorSocket] Token expirado o sesión cerrada, redirigiendo a login');
      this.authStore.logout();
      return;
    }

    this.clearReconnectTimer();
    this.connectionStatus.set('connecting');
    this.socket = new WebSocket(`${env.wsUrl}/ws/dashboard?token=${token}`);

    this.socket.onopen = () => {
      this.connectionStatus.set('connected');
      this.waitingForDevice.set(false);
      this.waitingTimer = setTimeout(() => {
        if (!this.telemetry()) {
          this.waitingForDevice.set(true);
        }
      }, 7000);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (isActionMessage(data)) {
          if (data.action === 'action_triggered') {
            data = { action: data.action_key, action_value: data.action_value } as ActionEvent;
          }

          this.actionEvent.set(data);

          this.recentActions.update(prev => [data, ...prev].slice(0, MAX_RECENT_ACTIONS));

          if (data.action === 'mouse_mode') {
            const newVal = data.action_value;
            if (newVal !== this.lastMouseModeValue) {
              this.lastMouseModeValue = newVal;
              this.mouseModeActive.set(newVal === true || newVal === 'ON');
            }
          }

          if (data.action === 'mode_changed') {
            this.currentMode.set(String(data.action_value).toUpperCase());
          }

          return;
        }

        if (data && typeof data.accel_x !== 'undefined') {
          this.scheduleTelemetryUpdate(data as GloveTelemetry);
          this.cancelWaitingTimer();
          this.waitingForDevice.set(false);
          this.resetDataTimeout();
        }
      } catch (error) {
        console.warn('[SensorSocket] Failed to parse WebSocket message:', event.data);
      }
    };

    this.socket.onerror = () => {
      this.connectionStatus.set('error');
      this.telemetry.set(null);
      this.dataFlowing.set(false);
    };

    this.socket.onclose = () => {
      this.connectionStatus.set('disconnected');
      this.dataFlowing.set(false);
      this.waitingForDevice.set(false);
      this.cancelWaitingTimer();
      if (this.dataTimeout) clearTimeout(this.dataTimeout);

      if (this.shouldBeConnected && this.authStore.isAuthenticated()) {
        const token = this.authStore.token();
        if (token && isTokenExpired(token)) {
          console.warn('[SensorSocket] Token expirado, redirigiendo a login');
          this.authStore.logout();
          return;
        }
        this.reconnectTimer = setTimeout(() => this.establishConnection(), 5000);
      }
    };
  }

  disconnect(): void {
    if (this.refCount > 0) this.refCount--;

    if (this.refCount > 0) return;

    this.shouldBeConnected = false;
    this.clearReconnectTimer();
    this.cancelWaitingTimer();
    if (this.dataTimeout) clearTimeout(this.dataTimeout);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.connectionStatus.set('disconnected');
  }

  ngOnDestroy(): void {
    this.shouldBeConnected = false;
    this.refCount = 0;
    this.clearReconnectTimer();
    this.cancelWaitingTimer();
    if (this.dataTimeout) clearTimeout(this.dataTimeout);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  private cancelWaitingTimer(): void {
    if (this.waitingTimer !== null) {
      clearTimeout(this.waitingTimer);
      this.waitingTimer = null;
    }
  }

  private lastTelemetryUpdate = 0;
  private readonly TELEMETRY_THROTTLE_MS = 33;

  private scheduleTelemetryUpdate(data: GloveTelemetry): void {
    const now = Date.now();
    if (now - this.lastTelemetryUpdate >= this.TELEMETRY_THROTTLE_MS) {
      this.telemetry.set(data);
      this.lastTelemetryUpdate = now;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
